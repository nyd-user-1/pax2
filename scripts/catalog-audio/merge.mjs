// Fold the Whisper box's catalog transcripts (s3://pax-2-638175140432/catalog-media-transcripts/) into
// data/generated/transcripts.json beside the caption entries, never overwriting an id that already has
// text. Word times come from Whisper itself, so these are the richest transcripts in the file.
// Usage: node scripts/catalog-audio/merge.mjs   (syncs from S3 first; rerun any time)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")
const DIR = path.join(ROOT, "data/raw/whisper-transcripts")
const OUT = path.join(ROOT, "data/generated/transcripts.json")
fs.mkdirSync(DIR, { recursive: true })
execFileSync("aws", ["s3", "sync", "--only-show-errors", "s3://pax-2-638175140432/catalog-media-transcripts/", DIR, "--region", "us-east-1"], { stdio: "inherit" })

const have = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {}
let added = 0
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const id = f.slice(0, -".json".length)
  if (have[id]?.text) continue
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"))
  if (!j.text) continue
  have[id] = { text: j.text, words: j.words ?? [], source: "whisper-catalog", at: j.at ?? new Date().toISOString() }
  added++
}
fs.writeFileSync(OUT, JSON.stringify(have, null, 1))
const withText = Object.values(have).filter((v) => v.text).length
console.log(`${added} merged, ${withText} with text of ${Object.keys(have).length} in ${OUT}`)
