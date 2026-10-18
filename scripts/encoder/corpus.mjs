// PAX2 Encoder and PAX2 Reranker, Part A: the corpus and the held-out channels.
//
// One document per row of the Model Training Library. This file is the only definition of a document's
// text (rig rule 15): the GPU box reads corpus.jsonl and never rebuilds text.
//
//   text   = title, then description, then the transcript's text when the row has content features,
//            each non-empty part on its own line, capped at 1,200 characters
//   fields = id, channelId, family, tier, breakout, group, text
//
// Held-out channels, fixed by rule: within each family, sort the family's channel ids by their last
// hexadecimal-looking character (0-9, a-f, case-folded; ties by the full id) and hold out every channel
// ranked above seven eighths of the family, ceil(n / 8) channels, at least one. Paid-ad rows are never
// held out and never positives.
//
// Usage: node scripts/encoder/corpus.mjs [--upload]
// Reads  data/generated/model/training-set.jsonl, data/generated/features.json
// Writes data/generated/model/encoder/corpus.jsonl (gitignored, 20 MB) and holdout.json;
//        --upload copies both to s3://nsr-embed-v2/pax2/corpus/
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT = path.join(root, "data/generated/model/encoder")
const CAP = 1200
const PAID = "paid-ad"

const rows = fs
  .readFileSync(path.join(root, "data/generated/model/training-set.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
const features = JSON.parse(fs.readFileSync(path.join(root, "data/generated/features.json"), "utf8"))

export function docText(row) {
  const transcript = row.content ? (features[`yt-${row.id}`]?.transcript?.text ?? "") : ""
  return [row.title, row.description, transcript]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, CAP)
}

const docs = rows.map((r) => ({
  id: r.id,
  channelId: r.channelId,
  family: r.family,
  tier: r.tier ?? null,
  breakout: r.group === PAID ? null : r.breakout,
  group: r.group,
  text: docText(r),
}))

// Held-out channels.
const lastHex = (id) => {
  const m = id.match(/[0-9a-f](?=[^0-9a-f]*$)/i)
  return m ? parseInt(m[0], 16) : -1
}
const byFamily = new Map()
const channelName = new Map()
for (const r of rows) {
  if (r.group === PAID) continue
  if (!byFamily.has(r.family)) byFamily.set(r.family, new Set())
  byFamily.get(r.family).add(r.channelId)
  channelName.set(r.channelId, r.channel)
}
const heldChannels = new Set()
const families = {}
for (const [family, set] of [...byFamily].sort(([a], [b]) => a.localeCompare(b))) {
  const sorted = [...set].sort((a, b) => lastHex(a) - lastHex(b) || a.localeCompare(b))
  const k = Math.max(1, Math.ceil(sorted.length / 8))
  const held = sorted.slice(sorted.length - k)
  held.forEach((c) => heldChannels.add(c))
  families[family] = {
    channels: sorted.length,
    heldOut: held.map((c) => {
      const mine = docs.filter((d) => d.channelId === c && d.group !== PAID)
      return { channelId: c, channel: channelName.get(c), lastHex: lastHex(c).toString(16), docs: mine.length, breakouts: mine.filter((d) => d.breakout === 1).length }
    }),
  }
}
const heldIds = docs.filter((d) => d.group !== PAID && heldChannels.has(d.channelId)).map((d) => d.id)

fs.mkdirSync(OUT, { recursive: true })
const corpusText = docs.map((d) => JSON.stringify(d)).join("\n") + "\n"
fs.writeFileSync(path.join(OUT, "corpus.jsonl"), corpusText)
const holdout = {
  builtAt: new Date().toISOString(),
  rule: "Within each family, the family's channel ids sorted by their last hexadecimal-looking character (0-9, a-f, case-folded; ties by the full id); every channel ranked above seven eighths of the family is held out, ceil(n / 8) channels and at least one. Paid-ad rows are never held out.",
  corpus: {
    file: "corpus.jsonl",
    rows: docs.length,
    sha256: createHash("sha256").update(corpusText).digest("hex"),
    textRecipe: "title, description, transcript text when content is present; non-empty parts joined by newlines; first 1,200 characters (scripts/encoder/corpus.mjs)",
  },
  paidRows: docs.filter((d) => d.group === PAID).length,
  heldOutChannels: heldChannels.size,
  heldOutDocs: heldIds.length,
  heldOutBreakouts: docs.filter((d) => heldChannels.has(d.channelId) && d.breakout === 1).length,
  trainingDocs: docs.filter((d) => d.group !== PAID && !heldChannels.has(d.channelId)).length,
  families,
  ids: heldIds,
}
fs.writeFileSync(path.join(OUT, "holdout.json"), JSON.stringify(holdout, null, 1) + "\n")

console.log(`corpus: ${docs.length} documents, ${docs.filter((d) => d.text.length >= CAP).length} capped at ${CAP}, ${docs.filter((d) => !d.text).length} empty, ${docs.filter((d) => d.group !== PAID && rows.find((r) => r.id === d.id)?.content).length} with transcript`)
console.log(`holdout: ${heldChannels.size} channels, ${heldIds.length} documents (${holdout.heldOutBreakouts} breakouts); training ${holdout.trainingDocs}; paid ${holdout.paidRows}`)
for (const [f, v] of Object.entries(families)) console.log(`  ${f}: ${v.heldOut.map((h) => `${h.channel} (${h.docs}, ${h.breakouts} breakouts)`).join("; ")} of ${v.channels}`)

if (process.argv.includes("--upload")) {
  for (const f of ["corpus.jsonl", "holdout.json"]) {
    execFileSync("aws", ["s3", "cp", "--only-show-errors", path.join(OUT, f), `s3://nsr-embed-v2/pax2/corpus/${f}`, "--region", "us-east-1"], { stdio: "inherit" })
  }
  console.log("uploaded: s3://nsr-embed-v2/pax2/corpus/")
}
