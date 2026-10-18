// PAX2 Classifier v2's transcript features for the catalog, computed here so the box never re-implements
// them (rig rule 15): src/lib/transcript-features.ts over data/generated/transcripts.json, joined to the
// settled rows of data/generated/model/training-set.jsonl by YouTube id.
//
// The vocabulary, fixed before any label is seen: unigrams and bigrams in at least 20 transcripts and at
// most half of them, the 400 most frequent; idf = ln((1 + N) / (1 + df)) + 1 over the N transcripts.
// A transcript counts when it has at least 10 words.
//
// Usage: node --experimental-strip-types scripts/classifier/transcript-features.mjs
// Writes data/generated/model/transcript-features.json: { builtAt, rule, counts, vocab, rows: { <id>: features } }
import fs from "node:fs"

import { terms, tokens, transcriptFeatures } from "../../src/lib/transcript-features.ts"

const MIN_DF = 20
const MAX_SHARE = 0.5
const TERMS = 400
const MIN_WORDS = 10

const transcripts = JSON.parse(fs.readFileSync("data/generated/transcripts.json", "utf8"))
const rows = fs
  .readFileSync("data/generated/model/training-set.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.breakout != null && r.group !== "paid-ad")

const withText = rows.filter((r) => transcripts[r.id]?.text && tokens(transcripts[r.id].text).length >= MIN_WORDS)
const df = new Map()
for (const r of withText) for (const t of new Set(terms(tokens(transcripts[r.id].text)))) df.set(t, (df.get(t) ?? 0) + 1)
const N = withText.length
const kept = [...df]
  .filter(([, n]) => n >= MIN_DF && n <= MAX_SHARE * N)
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .slice(0, TERMS)
const vocab = { terms: kept.map(([t]) => t), idf: kept.map(([, n]) => Math.round((Math.log((1 + N) / (1 + n)) + 1) * 1e6) / 1e6) }

const out = {}
for (const r of withText) {
  const tr = transcripts[r.id]
  const f = transcriptFeatures({ text: tr.text, timed: tr.words, title: r.title, durationSec: r.durationSec }, vocab)
  for (const k of Object.keys(f)) f[k] = Math.round(f[k] * 1e6) / 1e6
  out[r.id] = f
}

const byFamily = {}
for (const r of rows) {
  const b = (byFamily[r.family] ??= { rows: 0, withTranscript: 0 })
  b.rows++
  if (out[r.id]) b.withTranscript++
}
const file = {
  builtAt: new Date().toISOString(),
  rule: `src/lib/transcript-features.ts; vocabulary: unigrams and bigrams in at least ${MIN_DF} transcripts and at most ${MAX_SHARE * 100}% of them, the ${TERMS} most frequent; idf ln((1+N)/(1+df))+1; a transcript counts at ${MIN_WORDS} words or more`,
  counts: { settledRows: rows.length, transcripts: Object.values(transcripts).filter((t) => t.text).length, withTranscript: N, vocabulary: vocab.terms.length, byFamily },
  vocab,
  rows: out,
}
fs.writeFileSync("data/generated/model/transcript-features.json", JSON.stringify(file))
console.log(`${N} of ${rows.length} settled rows with a transcript of ${MIN_WORDS}+ words; vocabulary ${vocab.terms.length} terms (top: ${vocab.terms.slice(0, 8).join(", ")})`)
console.log(JSON.stringify(byFamily))
