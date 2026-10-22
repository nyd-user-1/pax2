"use server"

import fs from "node:fs"
import path from "node:path"

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { currentUser } from "@/lib/auth"
import { feedIndex } from "@/lib/feed-data"
import { scoreHeadlinesV1 } from "@/lib/headline-v1"

// The scan screen's checks (the Button door, /lab/<youtube id>). Each stage resolves only when its own
// record answers: media is a live S3 lookup, the headline read a live call to the pax2-headline
// Lambda on the title the feed index holds, and the file-measured stages read data/generated/lab-stages.json, the per-short record
// scripts/accounting.mjs writes from the composition, transcript and index sources. Nothing is timed.

export type Stage = "media" | "cuts" | "loudness" | "text" | "transcript" | "embedding" | "headline" | "neighbors" | "read"
export type Check = { done: boolean; detail?: string }

const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const ID = /^[\w-]{11}$/

type Stages = { order: string[]; ids: Record<string, string> }
let _stages: Stages | null = null
const stagesFile = (): Stages => (_stages ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/lab-stages.json"), "utf8")))
let _lab: Set<string> | null = null
const labTested = (): Set<string> => (_lab ??= new Set(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/lab-tested.json"), "utf8")) as string[]))

/** One bit of the short's measured record: "cuts", "loudness", "text", "transcript" or "index". */
function bit(id: string, name: string): boolean {
  const s = stagesFile()
  const i = s.order.indexOf(name)
  return i >= 0 && s.ids[id]?.[i] === "1"
}

export async function labCheck(id: string, stage: Stage): Promise<Check> {
  if (!(await currentUser())) return { done: false, detail: "Sign in to run the Lab" }
  if (!ID.test(id)) return { done: false, detail: "Not a YouTube id" }
  switch (stage) {
    case "media":
      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `catalog-media/${id}.mp4` }))
        return { done: true, detail: "mp4 in S3" }
      } catch {
        return { done: false, detail: "No file in S3 yet" }
      }
    case "cuts":
      return bit(id, "cuts") ? { done: true } : { done: false, detail: "Not measured from the file yet" }
    case "loudness":
      return bit(id, "loudness") ? { done: true } : { done: false, detail: "Not measured from the file yet" }
    case "text":
      return bit(id, "text") ? { done: true } : { done: false, detail: "Not measured from the file yet" }
    case "transcript":
      return bit(id, "transcript") ? { done: true } : { done: false, detail: "No transcript yet" }
    case "embedding":
      return bit(id, "index") ? { done: true, detail: "in the serving index" } : { done: false, detail: "Not in the serving index" }
    case "neighbors":
      // Neighbors are read from the serving index, so they exist exactly when the embedding does.
      return bit(id, "index") ? { done: true, detail: "read from the serving index" } : { done: false, detail: "Needs the embedding" }
    case "headline": {
      const t = ((await feedIndex()).find((v) => v.id === id)?.title ?? "").trim()
      if (!t) return { done: false, detail: "No title to read" }
      const r = await scoreHeadlinesV1([t]).catch(() => null)
      return r?.[0] ? { done: true, detail: `outscores ${Math.round(r[0].percentile)}% of tested headlines` } : { done: false, detail: "The Headline Ranker did not answer" }
    }
    case "read":
      return labTested().has(id) ? { done: true, detail: "Lab Tested" } : { done: false, detail: "Not every stage is measured" }
  }
}
