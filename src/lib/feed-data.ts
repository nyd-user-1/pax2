import "server-only"

import fs from "node:fs"

import labTested from "../../data/generated/lab-tested.json"
import type { FeedVideo } from "@/components/record/feed"
import { tagsFor } from "@/lib/tags"

// The full feed index (scripts/feed-index.mjs, every catalog short), loaded once per server and
// decorated with delivery tags and the Lab Tested flag. Pages ship only a first page of it; the
// rest arrives through /api/feed as the reader scrolls or searches. The file itself ships to S3,
// not into the build (6.9 MB against Amplify's 220 MB bundle cap); a local copy serves development.
// The path is assembled, not a literal, so the build's file tracer cannot bundle it anyway.

const LOCAL = [process.cwd(), "data", "generated", "feed-index.json"].join("/")

let ALL: Promise<FeedVideo[]> | null = null

async function load(): Promise<FeedVideo[]> {
  let raw: string
  if (fs.existsSync(LOCAL)) raw = fs.readFileSync(LOCAL, "utf8")
  else {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3")
    const r = await new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" }).send(
      new GetObjectCommand({ Bucket: process.env.PAX2_BUCKET ?? "pax-2-638175140432", Key: "app/feed-index.json" }),
    )
    raw = (await r.Body!.transformToString()) as string
  }
  const lab = new Set(labTested as string[])
  return (JSON.parse(raw) as FeedVideo[]).map((v) => {
    const tags = [...new Set([...(v.tags ?? []), ...tagsFor(`yt-${v.id}`)])]
    return { ...v, ...(tags.length && { tags }), ...(lab.has(v.id) && { lab: true }) }
  })
}

export function feedIndex(): Promise<FeedVideo[]> {
  if (!ALL) ALL = load()
  return ALL
}

/** The refine menu's channel and tag lists, from the whole index. */
export async function feedFacets(): Promise<{ channels: string[]; tags: string[] }> {
  const all = await feedIndex()
  return {
    channels: [...new Set(all.map((v) => v.channel))].sort((a, b) => a.localeCompare(b)),
    tags: [...new Set(all.flatMap((v) => v.tags ?? []))].sort((a, b) => a.localeCompare(b)),
  }
}

/** The page the server renders: the Lab Tested videos (the pinned row's seed), then the newest.
 *  `cursor` is how far into the newest-first index the page reaches; the client pages on from it. */
export async function firstPage(size = 48): Promise<{ initial: FeedVideo[]; total: number; cursor: number }> {
  const all = await feedIndex()
  const lab = all.filter((v) => v.lab)
  const seen = new Set(lab.map((v) => v.id))
  const rest: FeedVideo[] = []
  let cursor = 0
  while (rest.length < Math.max(0, size - lab.length) && cursor < all.length) {
    const v = all[cursor++]
    if (!seen.has(v.id)) rest.push(v)
  }
  return { initial: [...lab, ...rest], total: all.length, cursor }
}
