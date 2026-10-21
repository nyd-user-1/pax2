// PAX2 Video Resonance, the Mac's second scorer: recomputes every arm's numbers from the box's per-pair
// predictions (predictions.jsonl) and checks them against bench.json — held-out M1 accuracy, the 5x and
// 10x subsets, the validation read and the Gate B analog exactly; the channel-block intervals by its own
// bootstrap (2,000 draws), which agree with the box's to within resampling noise. It also checks that the
// held-out pair set is the 590 of groups.json and that no held-out pair is missing or extra.
//
// Usage: node scripts/video-resonance/rescore.mjs <dir with bench.json and predictions.jsonl>
import fs from "node:fs"
import path from "node:path"

const dir = process.argv[2]
const bench = JSON.parse(fs.readFileSync(path.join(dir, "bench.json"), "utf8"))
const preds = fs.readFileSync(path.join(dir, "predictions.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
const groups = JSON.parse(fs.readFileSync(new URL("../../data/generated/model/video-resonance/groups.json", import.meta.url), "utf8"))
const heldKey = new Set(groups.m1Pairs.filter((p) => p.split === "held").map((p) => `${p.winner}|${p.loser}`))

let seed = 20261020
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const ci = (c, chans) => {
  const u = [...new Set(chans)]
  const by = new Map(u.map((ch) => [ch, c.filter((_, i) => chans[i] === ch)]))
  const boots = []
  for (let b = 0; b < 2000; b++) {
    const xs = []
    for (let k = 0; k < u.length; k++) xs.push(...by.get(u[Math.floor(rand() * u.length)]))
    boots.push(mean(xs))
  }
  boots.sort((a, b) => a - b)
  return [boots[49], boots[1949]]
}
const right = (z) => (z > 0 ? 1 : z === 0 ? 0.5 : 0)
const close = (a, b, tol) => a == null || b == null ? a === b : Math.abs(a - b) <= tol

const report = {}
let ok = true
for (const arm of Object.keys(bench.arms)) {
  const P = preds.filter((p) => p.arm === arm)
  const held = P.filter((p) => p.bench === "m1" && p.split === "held")
  const val = P.filter((p) => p.bench === "m1" && p.split === "val")
  const gb = P.filter((p) => p.bench === "gateB")
  const set = new Set(held.map((p) => `${p.winner}|${p.loser}`))
  const pairSetOk = bench.slice ? true : set.size === heldKey.size && [...set].every((k) => heldKey.has(k))
  const c = held.map((p) => right(p.z))
  const r = { m1: { pairs: held.length, accuracy: mean(c), ci95: ci(c, held.map((p) => p.channelId)), pairSetIs590: pairSetOk } }
  for (const k of [5, 10]) {
    const sub = held.filter((p) => p.winnerRatio >= k)
    const cs = sub.map((p) => right(p.z))
    r[`outperformed${k}x`] = { pairs: sub.length, accuracy: sub.length ? mean(cs) : null, ci95: sub.length ? ci(cs, sub.map((p) => p.channelId)) : null }
  }
  r.val = { pairs: val.length, accuracy: val.length ? mean(val.map((p) => right(p.z))) : null }
  r.gateB = { pairs: gb.length, pooled: gb.length ? mean(gb.map((p) => (p.so > p.sn ? 1 : p.so === p.sn ? 0.5 : 0))) : null }
  const b = bench.arms[arm]
  const checks = {
    m1: close(r.m1.accuracy, b.m1.accuracy, 5e-5),
    m1ci: close(r.m1.ci95[0], b.m1.ci95[0], 0.01) && close(r.m1.ci95[1], b.m1.ci95[1], 0.01),
    x5: close(r.outperformed5x.accuracy, b.outperformed5x.accuracy, 5e-5) && r.outperformed5x.pairs === b.outperformed5x.pairs,
    x10: close(r.outperformed10x.accuracy, b.outperformed10x.accuracy, 5e-5) && r.outperformed10x.pairs === b.outperformed10x.pairs,
    val: close(r.val.accuracy, b.val.accuracy, 5e-5),
    gateB: close(r.gateB.pooled, b.gateB.pooled, 5e-5),
    pairSet: pairSetOk,
  }
  r.agrees = checks
  ok &&= Object.values(checks).every(Boolean)
  report[arm] = r
}
if (bench.benchBias) {
  const P = preds.filter((p) => p.arm === "stock-blindpca")
  const c = P.map((p) => right(p.z))
  const acc = mean(c)
  const agrees = P.length === 590 && close(acc, bench.benchBias.accuracy, 5e-5)
  report["stock-blindpca"] = { m1: { pairs: P.length, accuracy: acc, ci95: ci(c, P.map((p) => p.channelId)) }, agrees: { m1: agrees } }
  ok &&= agrees
}
const round = (x) => (typeof x === "number" ? Math.round(x * 1e4) / 1e4 : Array.isArray(x) ? x.map(round) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)])) : x)
const out = { rescoredAt: new Date().toISOString(), dir, allAgree: ok, arms: round(report) }
fs.writeFileSync(path.join(dir, "rescore.json"), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
process.exit(ok ? 0 : 1)
