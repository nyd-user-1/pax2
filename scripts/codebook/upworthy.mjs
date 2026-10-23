// Codebook 5K, Pass C (no GPU): every catalog title (data/generated/feed-index.json, 19,057) read against
// Upworthy's headline patterns with the app's own tests — PATTERN_TESTS in src/lib/headline-patterns.ts,
// the code titlePatterns runs for originals in evaluate.ts and for the UpworthyBlock — loaded from that file's
// source so no second copy exists. Carries data/raw/vqa/headline-scores.json's scalar alongside where the
// id has one (the 5,379 baseline). Writes data/raw/codebook/upworthy.json: id -> {patterns: [keys], score?}.
// Usage: node scripts/codebook/upworthy.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const src = fs.readFileSync(path.join(root, "src/lib/headline-patterns.ts"), "utf8")
const body = src.match(/export const PATTERN_TESTS[^\n]*?> = (\{[\s\S]*?\n\})/)?.[1]
if (!body) throw new Error("PATTERN_TESTS not found in src/lib/headline-patterns.ts")
const TESTS = new Function(`return (${body})`)()
const KEYS = read("data/generated/upworthy-top.json").patterns.map((p) => p.key)
if (KEYS.some((k) => !TESTS[k])) throw new Error("a pattern in upworthy-top.json has no test")
const scores = read("data/raw/vqa/headline-scores.json")
const out = {}
let titled = 0, scored = 0
for (const v of read("data/generated/feed-index.json")) {
  const title = v.title ?? ""
  if (title) titled++
  const row = { patterns: KEYS.filter((k) => TESTS[k](title)) }
  if (scores[v.id] != null) { row.score = scores[v.id]; scored++ }
  out[v.id] = row
}
fs.writeFileSync(path.join(root, "data/raw/codebook/upworthy.json"), JSON.stringify(out) + "\n")
const n = Object.keys(out).length
const carry = Object.values(out).filter((r) => r.patterns.length).length
console.log(`${n} titles coded (${titled} non-empty), ${carry} carry at least one pattern, ${scored} with the headline score`)
