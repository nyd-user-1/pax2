// Codebook 5K, the merge: the box's per-video outputs (s3 codebook/raw/<TAG>-a|b/, synced to
// data/raw/codebook/box/) and Pass C (data/raw/codebook/upworthy.json) into data/generated/codebook.json —
// id -> the Codes shape of src/components/codebook-blocks.tsx:
//   swayable       the trait keys coded present, in swayable-patterns.json order (evaluate.ts's filter)
//   wesleyan       the goal; wesleyanTone, wesleyanParty beside it
//   upworthy       {patterns, score?} for every catalog title
// A Swayable reply whose JSON does not parse keeps its present flags read off the text by pattern
// (verify.mjs presentOf); a reply with neither is left uncoded. Only model outputs enter: no sample codes.
// Usage: TAG=qwen3-8b-v1 node scripts/codebook/merge.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const TAG = process.env.TAG ?? "qwen3-8b-v1"
const BOX = path.join(root, "data/raw/codebook/box")
for (const p of ["a", "b"]) execFileSync("aws", ["s3", "sync", "--only-show-errors", `s3://pax-2-638175140432/codebook/raw/${TAG}-${p}/`, path.join(BOX, `${TAG}-${p}`)], { stdio: "inherit" })

function presentOf(coded, raw) {
  if (coded?.traits) return Object.fromEntries(coded.traits.map((t) => [t.key, !!t.present]))
  const m = {}
  for (const x of (raw ?? "").matchAll(/"key"\s*:\s*"(\w+)"\s*[,:]\s*"present"\s*:\s*(true|false)/g)) m[x[1]] = x[2] === "true"
  return Object.keys(m).length ? m : null
}
const KEYS = read("data/generated/swayable-patterns.json").traits.map((t) => t.key)
const GOAL = ["persuade", "money", "both", "neither"], TONE = ["attack", "contrast", "promote"], PARTY = ["Democratic", "Republican", "neither"]
const out = {}
const n = { swayable: 0, swayableByPattern: 0, swayableFailed: 0, wesleyan: 0, wesleyanFailed: 0, upworthy: 0 }
const files = (p) => (fs.existsSync(path.join(BOX, `${TAG}-${p}`)) ? fs.readdirSync(path.join(BOX, `${TAG}-${p}`)).filter((f) => f.endsWith(".json")) : [])
for (const f of files("a")) {
  const r = JSON.parse(fs.readFileSync(path.join(BOX, `${TAG}-a`, f), "utf8"))
  const pr = presentOf(r.coded, r.raw)
  if (!pr) { n.swayableFailed++; continue }
  if (!r.coded?.traits) n.swayableByPattern++
  ;(out[r.id] ??= {}).swayable = KEYS.filter((k) => pr[k])
  n.swayable++
}
for (const f of files("b")) {
  const r = JSON.parse(fs.readFileSync(path.join(BOX, `${TAG}-b`, f), "utf8"))
  const c = r.coded
  if (!c || !GOAL.includes(c.goal)) { n.wesleyanFailed++; continue }
  const o = (out[r.id] ??= {})
  o.wesleyan = c.goal
  if (TONE.includes(c.tone)) o.wesleyanTone = c.tone
  if (PARTY.includes(c.party)) o.wesleyanParty = c.party
  n.wesleyan++
}
for (const [id, u] of Object.entries(read("data/raw/codebook/upworthy.json"))) { (out[id] ??= {}).upworthy = u; n.upworthy++ }
const file = path.join(root, "data/generated/codebook.json")
fs.writeFileSync(file, JSON.stringify(out) + "\n")
console.log(JSON.stringify(n), `${Object.keys(out).length} ids, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`)
