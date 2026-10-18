// The second scorer of rig rule 25 for PAX2 Classifier v2: re-computes each model's pooled and within-
// channel AUC from the box's held-out predictions (predictions-v2.jsonl, every row's leave-one-channel-out
// probability under each model) with its own small implementation, and prints them beside the numbers the
// box wrote in var-model-v2.json, then re-derives Gate C. Agreement validates both; a gap is a bug.
//
// Usage: node scripts/classifier/rescore.mjs [dir]   (default data/generated/model)
// Exit 0 when every number agrees to 0.001, 1 otherwise.
import fs from "node:fs"

const dir = process.argv[2] ?? "data/generated/model"
const model = JSON.parse(fs.readFileSync(`${dir}/var-model-v2.json`, "utf8"))
const rows = fs.readFileSync(`${dir}/predictions-v2.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))

// AUC as the probability a random Hit outranks a random non-Hit, ties counting half: average ranks.
function auc(ys, ps) {
  const n = ys.length
  const pos = ys.reduce((a, b) => a + b, 0)
  if (!n || !pos || pos === n) return null
  const idx = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b])
  let sum = 0
  for (let i = 0; i < n; ) {
    let j = i
    while (j + 1 < n && ps[idx[j + 1]] === ps[idx[i]]) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) if (ys[idx[k]] === 1) sum += rank
    i = j + 1
  }
  return (sum - (pos * (pos + 1)) / 2) / (pos * (n - pos))
}

// Within channel: channels with 20+ rows and 3+ of each outcome, weighted by rows.
function within(rs, key) {
  const by = new Map()
  for (const r of rs) by.set(r.channelId, [...(by.get(r.channelId) ?? []), r])
  let num = 0
  let den = 0
  for (const g of by.values()) {
    const pos = g.filter((r) => r.y === 1).length
    if (g.length < 20 || pos < 3 || g.length - pos < 3) continue
    num += auc(g.map((r) => r.y), g.map((r) => r[key])) * g.length
    den += g.length
  }
  return den ? num / den : null
}

const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000)
const kinds = ["metadata", "tfidf", "rate", "overlap"]
const boxOf = (k) => (k === "metadata" ? model.metadata : model.variants?.[k])?.metrics.leaveOneChannelOut
let ok = rows.length === model.rows.trainingSet
console.log(`rows: predictions ${rows.length}, model file ${model.rows.trainingSet}, with a transcript ${rows.filter((r) => r.transcript).length} (model file ${model.rows.withTranscript})`)
console.log("model      pooled AUC box / Mac     within-channel AUC box / Mac     transcript rows AUC box / Mac")
const mac = {}
for (const k of kinds) {
  const b = boxOf(k)
  if (!b) continue
  const seg = rows.filter((r) => r.transcript)
  mac[k] = { auc: r3(auc(rows.map((r) => r.y), rows.map((r) => r[k]))), within: r3(within(rows, k)), seg: r3(auc(seg.map((r) => r.y), seg.map((r) => r[k]))) }
  const agree = [[b.auc, mac[k].auc], [b.withinChannelAuc, mac[k].within], [b.bySegment?.withTranscript?.auc ?? null, mac[k].seg]].every(([x, y]) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) <= 0.001))
  ok &&= agree
  console.log(`${k.padEnd(10)} ${String(b.auc).padStart(6)} / ${String(mac[k].auc).padEnd(14)} ${String(b.withinChannelAuc).padStart(6)} / ${String(mac[k].within).padEnd(22)} ${String(b.bySegment?.withTranscript?.auc ?? null).padStart(6)} / ${mac[k].seg}${agree ? "" : "   DISAGREE"}`)
}
const g = model.gates.transcript
const c = mac[g.candidate]
const passMac = c != null && c.auc >= 0.624 && c.within != null && c.within >= 0.55
console.log(`Gate C (candidate ${g.candidate}): box ${g.passed ? "PASSED" : "FAILED"}, Mac ${passMac ? "PASSED" : "FAILED"} at pooled ${c?.auc} (needs 0.624) and within-channel ${c?.within} (needs 0.55)`)
ok &&= passMac === g.passed
console.log(ok ? "scorers agree" : "SCORERS DISAGREE")
process.exit(ok ? 0 : 1)
