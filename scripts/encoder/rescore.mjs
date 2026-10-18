// PAX2 Encoder and PAX2 Reranker, C0: the Mac's second implementation of the kNN-AUC (rig rule 25) and the
// held-out check run again before publish (rules 21 and 22).
//
// Reads a run's neighbor lists, bench files and pairs-ids.jsonl from s3://nsr-embed-v2/pax2/runs/<run>/,
// and corpus.jsonl and holdout.json from data/generated/model/encoder/. For each arm it rebuilds every
// held-out document's score as the share of its listed neighbors that broke out, recomputes the pooled and
// within-channel AUC with its own tie-averaged rank sum, and requires agreement with the box to three
// decimals. It then checks that no held-out document appears in any pair, and that every neighbor is a
// training document. With --apply it writes a `verified` block (time, corpus rows and hash, the Mac's
// numbers) into each bench file and uploads them back.
//
// Usage: node scripts/encoder/rescore.mjs <run-id> [--apply]
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"

const RUN = process.argv[2]
if (!RUN) throw new Error("usage: rescore.mjs <run-id> [--apply]")
const APPLY = process.argv.includes("--apply")
const S3 = `s3://nsr-embed-v2/pax2/runs/${RUN}`
const DIR = path.join("data/generated/model/encoder/runs", RUN)
fs.mkdirSync(DIR, { recursive: true })
const pull = (f) => {
  const p = path.join(DIR, f)
  if (!fs.existsSync(p)) execFileSync("aws", ["s3", "cp", "--only-show-errors", `${S3}/${f}`, p, "--region", "us-east-1"])
  return p
}

const corpusText = fs.readFileSync("data/generated/model/encoder/corpus.jsonl", "utf8")
const corpus = corpusText.split("\n").filter(Boolean).map((l) => JSON.parse(l))
const byId = new Map(corpus.map((d) => [d.id, d]))
const holdout = JSON.parse(fs.readFileSync("data/generated/model/encoder/holdout.json", "utf8"))
const held = new Set(holdout.ids)
const sha = createHash("sha256").update(corpusText).digest("hex")
if (sha !== holdout.corpus.sha256) throw new Error(`corpus.jsonl hash ${sha} differs from holdout.json's ${holdout.corpus.sha256}`)

function auc(y, s) {
  const idx = s.map((_, i) => i).sort((a, b) => s[a] - s[b])
  const rank = new Array(s.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && s[idx[j + 1]] === s[idx[i]]) j++
    for (let k = i; k <= j; k++) rank[idx[k]] = (i + j) / 2 + 1
    i = j + 1
  }
  const n1 = y.filter((v) => v === 1).length
  const n0 = y.length - n1
  if (!n1 || !n0) return null
  let r1 = 0
  y.forEach((v, i) => v === 1 && (r1 += rank[i]))
  return (r1 - (n1 * (n1 + 1)) / 2) / (n1 * n0)
}

const report = { run: RUN, at: new Date().toISOString(), corpusRows: corpus.length, corpusSha256: sha, arms: {} }
let failed = false
for (const arm of ["stock", "encoder", "reranker"]) {
  let nb, bench
  try {
    nb = JSON.parse(fs.readFileSync(pull(`neighbors-${arm}.json`), "utf8"))
    bench = JSON.parse(fs.readFileSync(pull(`bench-${arm}.json`), "utf8"))
  } catch {
    console.log(`${arm}: no files`)
    continue
  }
  const y = [], s = [], ch = []
  let badNbr = 0
  for (const r of nb.rows) {
    const d = byId.get(r.id)
    if (!held.has(r.id)) throw new Error(`${arm}: ${r.id} is not held out`)
    for (const n of r.nbrs) if (held.has(n) || byId.get(n).group === "paid-ad") badNbr++
    y.push(d.breakout)
    s.push(r.nbrs.reduce((a, n) => a + byId.get(n).breakout, 0) / r.nbrs.length)
    ch.push(d.channelId)
  }
  const pooled = auc(y, s)
  let wsum = 0, w = 0
  for (const c of new Set(ch)) {
    const ks = ch.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0)
    const a = auc(ks.map((i) => y[i]), ks.map((i) => s[i]))
    if (a !== null) (wsum += a * ks.length), (w += ks.length)
  }
  const within = w ? wsum / w : null
  const agree = (a, b) => (a === null && b === null) || (a !== null && b !== null && a.toFixed(3) === b.toFixed(3))
  const ok = agree(pooled, bench.pooled) && agree(within, bench.within) && badNbr === 0 && nb.rows.length === bench.n
  failed ||= !ok
  report.arms[arm] = { n: nb.rows.length, pooled, within, boxPooled: bench.pooled, boxWithin: bench.within, neighborsNotTraining: badNbr, agree: ok }
  console.log(`${arm}: n=${nb.rows.length} pooled mac ${pooled?.toFixed(4)} box ${bench.pooled?.toFixed(4)} | within mac ${within?.toFixed(4)} box ${bench.within?.toFixed(4)} | bad neighbors ${badNbr} | ${ok ? "AGREE" : "DISAGREE"}`)
}

pull("pairs-stats.json")
let pairs = 0, heldInPairs = 0
for (const l of fs.readFileSync(pull("pairs-ids.jsonl"), "utf8").split("\n")) {
  if (!l) continue
  const p = JSON.parse(l)
  pairs++
  for (const id of [p.id, ...p.pos, ...p.neg]) if (held.has(id) || byId.get(id)?.group === "paid-ad") heldInPairs++
}
report.pairs = pairs
report.heldOutInPairs = heldInPairs
console.log(`pairs ${pairs}, held-out or paid documents in them: ${heldInPairs}`)
failed ||= heldInPairs !== 0
fs.writeFileSync(path.join(DIR, "rescore.json"), JSON.stringify(report, null, 1) + "\n")

if (failed) {
  console.log("STOP: the Mac and the box disagree, or the held-out check failed")
  process.exit(1)
}
if (APPLY) {
  for (const arm of Object.keys(report.arms)) {
    const p = path.join(DIR, `bench-${arm}.json`)
    const bench = JSON.parse(fs.readFileSync(p, "utf8"))
    bench.verified = { at: report.at, by: "scripts/encoder/rescore.mjs", corpusRows: corpus.length, corpusSha256: sha, heldOutDocs: holdout.ids.length, pairs, heldOutInPairs: heldInPairs, mac: { pooled: report.arms[arm].pooled, within: report.arms[arm].within } }
    fs.writeFileSync(p, JSON.stringify(bench, null, 1) + "\n")
    execFileSync("aws", ["s3", "cp", "--only-show-errors", p, `${S3}/bench-${arm}.json`, "--region", "us-east-1"])
  }
  console.log("verified blocks written and uploaded")
}
