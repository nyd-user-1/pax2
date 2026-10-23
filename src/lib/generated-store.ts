import "server-only"

import fs from "node:fs"

// Large generated JSON read at request time, never bundled: a static import inlines the file into every
// route chunk that renders it, and a literal fs path gets traced into the build (Amplify's 220 MB cap).
// The path below is assembled, so the file tracer cannot follow it; a local copy serves development and
// production reads s3://pax-2-638175140432/generated/<name>.json (scripts/upload-generated.mjs).
// One read per server, cached.

export const GENERATED = {
  "question-bank": ["data", "generated", "question-bank.json"],
  codebook: ["data", "generated", "codebook.json"],
  "vqa-census": ["data", "generated", "model", "vqa-census.json"],
} as const
export type GeneratedName = keyof typeof GENERATED

const cache = new Map<GeneratedName, Promise<unknown>>()

async function read(name: GeneratedName): Promise<unknown> {
  const local = [process.cwd(), ...GENERATED[name]].join("/")
  try {
    if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"))
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3")
    const r = await new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" }).send(
      new GetObjectCommand({ Bucket: process.env.PAX2_BUCKET ?? "pax-2-638175140432", Key: `generated/${name}.json` }),
    )
    return JSON.parse((await r.Body!.transformToString()) as string)
  } catch {
    // A failed read is not cached, so the next request tries again.
    cache.delete(name)
    return null
  }
}

export function generatedJson<T>(name: GeneratedName): Promise<T | null> {
  let p = cache.get(name)
  if (!p) cache.set(name, (p = read(name)))
  return p as Promise<T | null>
}
