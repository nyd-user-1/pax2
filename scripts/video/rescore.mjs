// Window MM-A, the Mac's second scorer (the scripts/classifier/rescore.mjs pattern): recomputes every Gate M1
// and M2 number from the box's uploaded predictions with its own small implementation and prints it beside
// the box's bench. Bootstrap intervals are recomputed on the box's own channel draws (shipped in each
// bench), so every number, point or interval, must agree to 0.001. A gap is a bug.
//
// Usage: node scripts/video/rescore.mjs [dir]   (default data/generated/model)
//   reads bench-m1.json, video-pair-predictions.jsonl, bench-m2.json, predictions-v3v.jsonl
// Exit 0 when every number agrees, 1 otherwise.
import fs from "node:fs"

const dir = process.argv[2] ?? "data/generated/model"
const jl = (f) => fs.readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
const m1 = JSON.parse(fs.readFileSync(`${dir}/bench-m1.json`, "utf8"))
const m2 = JSON.parse(fs.readFileSync(`${dir}/bench-m2.json`, "utf8"))
const pairs = jl("video-pair-predictions.jsonl")
const rows = jl("predictions-v3v.jsonl")
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4)
let ok = true
const check = (label, box, mac, tol) => {
  const agree = (box == null && mac == null) || (box != null && mac != null && Math.abs(box - mac) <= tol)
  ok &&= agree
  console.log(`${label.padEnd(44)} box ${String(box).padEnd(8)} Mac ${String(r4(mac)).padEnd(8)}${agree ? "" : "  DISAGREE"}`)
}
const bootstrap = (draws) => (items, stat) => {
  const by = new Map()
  for (const it of items) by.set(it.channelId, [...(by.get(it.channelId) ?? []), it])
  const vals = []
  for (const pick of draws.picks) {
    const s = pick.flatMap((i) => by.get(draws.channels[i]) ?? [])
    const v = s.length ? stat(s) : null
    if (v != null) vals.push(v)
  }
  return [pct(vals, 0.025), pct(vals, 0.975)]
}

// ── M1 ──
const acc = (ps, arm) => (ps.length ? ps.reduce((s, p) => s + (p[arm] > 0 ? 1 : p[arm] === 0 ? 0.5 : 0), 0) / ps.length : null)
const held = pairs.filter((p) => p.heldOut)
console.log(`Gate M1: ${pairs.length} pairs, ${held.length} held out (bench says ${m1.pairs.all} / ${m1.pairs.heldOut}); bar ${m1.bar}`)
ok &&= pairs.length === m1.pairs.all && held.length === m1.pairs.heldOut
for (const [arm, b] of Object.entries(m1.arms)) {
  for (const [key, sub] of [["heldOut", held], ["heldOut5x", held.filter((p) => (p.breakoutRatio ?? 0) >= 5)], ["heldOut10x", held.filter((p) => (p.breakoutRatio ?? 0) >= 10)]]) {
    ok &&= sub.length === b[key].n
    const a = acc(sub, arm)
    check(`${arm} ${key} accuracy (n=${sub.length})`, b[key].accuracy, a, 0.001)
    const [lo, hi] = bootstrap(m1.bootstrap)(sub, (s) => acc(s, arm))
    check(`${arm} ${key} interval low`, b[key].interval[0], lo, 0.001)
    check(`${arm} ${key} interval high`, b[key].interval[1], hi, 0.001)
  }
  const pass = acc(held, arm) >= m1.bar
  ok &&= pass === b.pass
  console.log(`${arm}: Gate M1 box ${b.pass ? "PASS" : "fail"}, Mac ${pass ? "PASS" : "fail"}`)
}

// ── M2 ──
function auc(ys, ps) {
  const n = ys.length
  const pos = ys.reduce((a, b) => a + b, 0)
  if (!n || !pos || pos === n) return null
  const idx = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b])
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
const H = rows.filter((r) => r.heldOut)
const HM = H.filter((r) => r.media)
console.log(`\nGate M2 (arm ${m2.arm}): ${H.length} held-out rows, ${HM.length} with media`)
const readSet = (label, rs, lab, b) => {
  ok &&= rs.length === b.n
  for (const k of ["metadata", "full", "fullvideo"]) {
    check(`${label} ${k} AUC (n=${rs.length})`, b[k], auc(rs.map(lab), rs.map((r) => r[k])), 0.001)
    const [lo, hi] = bootstrap(m2.bootstrap)(rs, (s) => auc(s.map(lab), s.map((r) => r[k])))
    check(`${label} ${k} interval low`, b[`${k}Interval`][0], lo, 0.001)
    check(`${label} ${k} interval high`, b[`${k}Interval`][1], hi, 0.001)
  }
  const [dlo, dhi] = bootstrap(m2.bootstrap)(rs, (s) => { const a = auc(s.map(lab), s.map((r) => r.fullvideo)); const c = auc(s.map(lab), s.map((r) => r.full)); return a == null || c == null ? null : a - c })
  check(`${label} delta interval low`, b.deltaInterval[0], dlo, 0.001)
  check(`${label} delta interval high`, b.deltaInterval[1], dhi, 0.001)
  return auc(rs.map(lab), rs.map((r) => r.fullvideo)) - auc(rs.map(lab), rs.map((r) => r.full))
}
const y3 = (r) => r.y
readSet("held-out", H, y3, m2.heldOut)
const d = readSet("held-out media", HM, y3, m2.heldOutMedia)
check("held-out media delta (bar +0.02)", m2.heldOutMedia.delta, d, 0.001)
for (const t of [5, 10]) {
  const lab = (r) => ((r.ratio ?? 0) >= t ? 1 : 0)
  readSet(`${t}x held-out`, H, lab, m2.secondary[`${t}x`].heldOut)
  readSet(`${t}x held-out media`, HM, lab, m2.secondary[`${t}x`].heldOutMedia)
}
const pass = d >= 0.02
ok &&= pass === m2.pass
console.log(`Gate M2: box ${m2.pass ? "PASS" : "fail"}, Mac ${pass ? "PASS" : "fail"}`)
console.log(ok ? "scorers agree" : "SCORERS DISAGREE")
process.exit(ok ? 0 : 1)
