// Within-neighborhood win/loss tables (window C, Part 2, 2026-10-20). Every breakout/control pair
// (scripts/composition/pairs.mjs: same channel, nearest publish date) is placed in its breakout's
// cluster on the vector graph (data/generated/model/encoder-map.json). Per cluster with 50+ shorts and
// per composition feature, over the pairs where both sides carry the feature: the breakouts' median,
// the controls' median, the median paired difference, the share of pairs where the breakout runs
// higher, and a two-sided sign test. With ~40 clusters x ~23 features, a finding is a split whose
// Benjamini-Hochberg q is under 0.10 with at least MIN_PAIRS pairs; everything else stays in the file
// as a measured split, not a claim. The whole-catalog row is computed the same way.
//
// Usage: node scripts/composition/findings.mjs   (reads composition.json; run merge.mjs first)
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "./pairs.mjs"

const MIN_PAIRS = 20
const Q = 0.1
const comp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/composition.json"), "utf8"))
const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/encoder-map.json"), "utf8"))
const clusterOf = new Map(map.points.map((p) => [p.id, p.cluster]))
const clusterN = new Map(map.clusters.map((c) => [c.id, c.n]))
const label = new Map(map.clusters.map((c) => [c.id, c.labels[0] ?? `Cluster ${c.id}`]))
const { pairs: ps } = pairs()
const FEATURES = Object.keys(comp.features)

// How each feature reads in a sentence: [unit formatter, noun phrase]
const SAY = {
  durationSec: [(v) => `${v.toFixed(0)} s`, "run"],
  cutsPerSec: [(v) => `${v.toFixed(2)} cuts/s`, "cut at"],
  firstCutSec: [(v) => `${v.toFixed(1)} s`, "make the first cut at"],
  cutsHook: [(v) => `${v.toFixed(1)}`, "cut in the first 2 s, median"],
  visualActivity: [(v) => v.toFixed(4), "move on screen at a scene score of"],
  loudnessLufs: [(v) => `${v.toFixed(1)} LUFS`, "mix at"],
  loudnessRange: [(v) => `${v.toFixed(1)} LU`, "swing in loudness by"],
  hookLoudnessDelta: [(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} LU`, "open louder than their average by"],
  textWordsPerFrame: [(v) => `${v.toFixed(1)} words`, "carry on-screen text at"],
  textFrameShare: [(v) => `${Math.round(v * 100)}%`, "show on-screen text in"],
  textHook: [(v) => `${v.toFixed(0)} words`, "put on-screen text in the first 2 s at"],
  brightness: [(v) => v.toFixed(0), "run at a brightness of"],
  saturation: [(v) => v.toFixed(0), "run at a saturation of"],
  speechWps: [(v) => `${v.toFixed(2)} words/s`, "talk at"],
  firstWordSec: [(v) => `${v.toFixed(1)} s`, "speak the first word at"],
  wordsHook: [(v) => `${v.toFixed(0)} words`, "speak in the first 2 s"],
  speechShare: [(v) => `${Math.round(v * 100)}%`, "fill audible seconds with speech at"],
  titleChars: [(v) => `${v.toFixed(0)} characters`, "title at"],
  titleWords: [(v) => `${v.toFixed(0)} words`, "title at"],
  titleQuestion: [(v) => `${Math.round(v * 100)}%`, "ask a question in the title at"],
  titleNumber: [(v) => `${Math.round(v * 100)}%`, "put a number in the title at"],
  titleCapsRun: [(v) => v.toFixed(1), "run all-caps words in the title, mean"],
  titleEmoji: [(v) => `${Math.round(v * 100)}%`, "put an emoji in the title at"],
}
const BINARY = new Set(["titleQuestion", "titleNumber", "titleEmoji"])
const MEAN = new Set([...BINARY, "titleCapsRun", "cutsHook"])

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
// two-sided exact sign test via log-binomial terms
function signP(k, n) {
  if (n === 0) return 1
  const lf = [0]
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1] + Math.log(i)
  const pk = (i) => Math.exp(lf[n] - lf[i] - lf[n - i] - n * Math.LN2)
  const lo = Math.min(k, n - k)
  let p = 0
  for (let i = 0; i <= lo; i++) p += pk(i)
  return Math.min(1, 2 * p)
}

function split(group, feature) {
  const rows = group
    .map((p) => [comp.shorts[p.breakout.id]?.[feature], comp.shorts[p.control.id]?.[feature]])
    .filter(([a, b]) => a != null && b != null)
  if (!rows.length) return null
  const agg = MEAN.has(feature) ? mean : median
  const up = rows.filter(([a, b]) => a > b).length
  const down = rows.filter(([a, b]) => a < b).length
  return {
    feature,
    pairs: rows.length,
    breakout: Math.round(agg(rows.map((r) => r[0])) * 1e4) / 1e4,
    control: Math.round(agg(rows.map((r) => r[1])) * 1e4) / 1e4,
    medianDelta: Math.round(median(rows.map(([a, b]) => a - b)) * 1e4) / 1e4,
    breakoutHigher: up + down ? Math.round((up / (up + down)) * 1000) / 1000 : null,
    untied: up + down,
    p: signP(up, up + down),
  }
}

function sentence(where, s) {
  const [fmt, verb] = SAY[s.feature]
  const dir = s.breakoutHigher >= 0.5 ? "higher" : "lower"
  return `${where}: breakouts ${verb} ${fmt(s.breakout)} vs ${fmt(s.control)} for their same-channel controls (${s.pairs} pairs; the breakout runs ${dir} in ${Math.round(Math.max(s.breakoutHigher, 1 - s.breakoutHigher) * 100)}% of the pairs that differ)`
}

const groups = new Map()
for (const p of ps) {
  const c = clusterOf.get(p.breakout.id)
  if (c == null || (clusterN.get(c) ?? 0) < 50) continue
  if (!groups.has(c)) groups.set(c, [])
  groups.get(c).push(p)
}

const tests = []
const overall = FEATURES.map((f) => split(ps, f)).filter(Boolean)
for (const s of overall) tests.push({ scope: "all", ...s })
const clusters = []
for (const [c, group] of [...groups].sort((a, b) => a[0] - b[0])) {
  const splits = FEATURES.map((f) => split(group, f)).filter(Boolean)
  clusters.push({ cluster: c, n: clusterN.get(c), label: label.get(c), pairs: group.length, channels: new Set(group.map((p) => p.breakout.channelId)).size, splits })
  for (const s of splits) if (s.pairs >= MIN_PAIRS) tests.push({ scope: c, ...s })
}

// Benjamini-Hochberg over every eligible test, overall and per cluster together
const eligible = tests.filter((t) => t.pairs >= MIN_PAIRS)
eligible.sort((a, b) => a.p - b.p)
let minQ = 1
for (let i = eligible.length - 1; i >= 0; i--) {
  minQ = Math.min(minQ, (eligible[i].p * eligible.length) / (i + 1))
  eligible[i].q = minQ
}
const qOf = new Map(eligible.map((t) => [`${t.scope}:${t.feature}`, t.q]))
for (const s of overall) s.q = qOf.get(`all:${s.feature}`) ?? null
for (const c of clusters) for (const s of c.splits) s.q = qOf.get(`${c.cluster}:${s.feature}`) ?? null

const findings = eligible
  .filter((t) => t.q < Q)
  .map((t) => ({
    scope: t.scope,
    clusterLabel: t.scope === "all" ? null : label.get(t.scope),
    feature: t.feature,
    pairs: t.pairs,
    breakout: t.breakout,
    control: t.control,
    medianDelta: t.medianDelta,
    breakoutHigher: t.breakoutHigher,
    p: Number(t.p.toPrecision(3)),
    q: Number(t.q.toPrecision(3)),
    channels: t.scope === "all" ? new Set(ps.map((p) => p.breakout.channelId)).size : clusters.find((c) => c.cluster === t.scope).channels,
    line: sentence(t.scope === "all" ? "Across the catalog" : `Cluster ${t.scope} (${clusters.find((c) => c.cluster === t.scope).channels} channel${clusters.find((c) => c.cluster === t.scope).channels === 1 ? "" : "s"})`, t),
  }))
  .sort((a, b) => a.q - b.q)

const out = {
  builtAt: new Date().toISOString(),
  version: "composition-findings-1",
  map: map.run,
  composition: comp.builtAt,
  rule: `Pairs placed in the breakout's cluster; clusters of 50+ shorts; per feature over pairs where both sides are measured. A finding is a split with ${MIN_PAIRS}+ pairs and Benjamini-Hochberg q < ${Q} over all ${eligible.length} eligible tests (two-sided sign test on the paired difference). Medians, except means for binary traits, all-caps runs and cuts in the first 2 s.`,
  tests: eligible.length,
  pairs: ps.length,
  pairsInClusters: [...groups.values()].reduce((a, g) => a + g.length, 0),
  findings,
  overall,
  clusters,
}
fs.writeFileSync(path.join(ROOT, "data/generated/model/composition-findings.json"), JSON.stringify(out, null, 1))
console.log(`${eligible.length} tests, ${findings.length} findings at q < ${Q}`)
for (const f of findings.slice(0, 40)) console.log(`q ${f.q}  ${f.line}`)
