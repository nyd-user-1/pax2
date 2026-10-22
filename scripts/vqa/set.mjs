// Window Q's set: the complete-baseline shorts, rebuilt from scripts/accounting.mjs's own sources —
// transcript (data/generated/transcripts.json), media in S3 (the live catalog-media listing),
// composition measured from the file (composition.json, cutsPerSec present) and a serving-index
// embedding (data/raw/composition/index/rows.json). The vision model needs the picture, so the set
// is the baseline shorts whose .mp4 is in S3; a baseline short with audio only is counted, not asked.
//
// Usage: node scripts/vqa/set.mjs
// Writes data/raw/vqa/set.tsv (id, channel) and data/raw/vqa/set.json (the counts).
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const universe = read("data/generated/feed-index.json")
const transcripts = new Set(Object.keys(read("data/generated/transcripts.json")))
const compAll = read("data/generated/model/composition.json")
const compRows = compAll.shorts ?? compAll.videos
const composition = new Set(Object.keys(compRows).filter((k) => compRows[k].cutsPerSec != null))
const index = new Set(read("data/raw/composition/index/rows.json").map((r) => r.id))
const files = execSync("aws s3 ls s3://pax-2-638175140432/catalog-media/ --region us-east-1", { maxBuffer: 64 * 1024 * 1024 })
  .toString()
  .split("\n")
  .map((l) => l.trim().split(/\s+/).pop() ?? "")
  .filter(Boolean)
const media = new Set(files.map((f) => f.replace(/\.(mp4|m4a)$/, "")))
const mp4 = new Set(files.filter((f) => f.endsWith(".mp4")).map((f) => f.slice(0, -4)))

const baseline = universe.filter((v) => transcripts.has(v.id) && media.has(v.id) && composition.has(v.id) && index.has(v.id))
// Hash order, so the first 20 (the verification) and any prefix are an unbiased sample.
const h = (id) => createHash("sha1").update(id).digest("hex")
const set = baseline.filter((v) => mp4.has(v.id)).sort((a, b) => h(a.id).localeCompare(h(b.id)))
const clean = (s) => String(s ?? "").replace(/[\t\n]/g, " ")
fs.mkdirSync(path.join(root, "data/raw/vqa"), { recursive: true })
fs.writeFileSync(path.join(root, "data/raw/vqa/set.tsv"), set.map((v) => `${v.id}\t${clean(v.channel)}`).join("\n") + "\n")
const counts = { builtAt: new Date().toISOString(), catalog: universe.length, baseline: baseline.length, withMp4: set.length, audioOnly: baseline.length - set.length }
fs.writeFileSync(path.join(root, "data/raw/vqa/set.json"), JSON.stringify(counts, null, 1) + "\n")
console.log(counts)
