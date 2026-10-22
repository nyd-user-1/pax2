// The winning modes, refit on craft axes only (docs/briefs/WINNING-MODES.md, docs/RESONANCE.md).
// The template behind docs/RESONANCE-COMPARE.html carried the outlier multiple and the classifier
// forecast; both leave it here (docs/RESONANCE-EVAL.md). Pure CPU over files on disk.
//
// Population: settled catalog shorts with media-measured composition (data/generated/model/
// composition.json, cutsPerSec present). Label: views at or over 3x the channel median.
// Template: each craft axis as a within-channel mid-rank percentile (0..1); a missing value sits at 0.5.
//
// Protocol, fixed before the run:
//   1. Channels split 70/30 by a hash of the channel id: train and test.
//   2. k in 3..8 chosen on train alone by 5-fold channel-grouped cross-validation: k-means over the
//      outperformers' templates of four folds; each mode's share over 3x among the four folds' videos
//      nearest it (smoothed toward base, 20 pseudo-videos); scored on the fifth fold by log loss against
//      the base rate. Lowest mean held-out log loss wins; ties go to the smaller k.
//   3. Final modes fit on all train outperformers at that k. Each mode's lift re-measured on the test
//      channels: the share over 3x among test videos nearest it. A mode survives only if the 90%
//      channel-bootstrap interval of (lift - test base rate) lies above zero. The rest are named and dropped.
//   4. Mode-match: distance to the nearest surviving mode, scored 0..100 as the share of the
//      label-blind baseline sample (video-blind-sample.json) lying farther away.
//
// Variants: "full" uses every craft axis named in the brief, engagement profile included; "preRelease"
// drops the engagement axes, which only exist after publication. Both are reported; the file serves full.
//
// Usage: node scripts/winning-modes.mjs
// Writes data/generated/model/winning-modes.json
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const comp = read("data/generated/model/composition.json").shorts
const catalog = read("data/velocity/catalog.json")
const blindIds = new Set(read("data/generated/model/video-blind-sample.json").ids)

// ---------- the craft axes ----------
const AXES = [
  // composition
  ["cutsPerSec", "cuts per second", "comp"],
  ["firstCutSec", "seconds to first cut", "comp"],
  ["cutsHook", "cuts in the first 2 s", "comp"],
  ["visualActivity", "visual activity", "comp"],
  ["loudnessLufs", "loudness", "comp"],
  ["loudnessRange", "loudness range", "comp"],
  ["hookLoudnessDelta", "hook loudness over the whole", "comp"],
  ["textWordsPerFrame", "on-screen words per frame", "comp"],
  ["textFrameShare", "share of frames with text", "comp"],
  ["textHook", "on-screen words in the first 2 s", "comp"],
  ["brightness", "brightness", "comp"],
  ["saturation", "saturation", "comp"],
  // speech timing
  ["speechWps", "spoken words per second", "speech"],
  ["firstWordSec", "seconds to first spoken word", "speech"],
  ["wordsHook", "spoken words in the first 2 s", "speech"],
  ["speechShare", "share of seconds with speech", "speech"],
  // length deviation: the short's length against its own channel
  ["durationSec", "length against the channel", "length"],
  // title traits
  ["titleWords", "title words", "title"],
  ["titleQuestion", "title asks a question", "title"],
  ["titleNumber", "title carries a number", "title"],
  ["titleCapsRun", "all-caps run in the title", "title"],
  ["titleEmoji", "title carries an emoji", "title"],
  // engagement profile (post-publication)
  ["likeRate", "likes per view", "engagement"],
  ["commentRate", "comments per view", "engagement"],
]

// ---------- population ----------
const all = catalog.videos.filter((v) => comp[v.id]?.cutsPerSec != null)
const valueOf = (v, key) => {
  if (key === "likeRate") return v.views > 0 ? (v.likes ?? 0) / v.views : null
  if (key === "commentRate") return v.views > 0 ? (v.comments ?? 0) / v.views : null
  const x = comp[v.id]?.[key]
  return x == null ? null : x
}
const settled = all.filter((v) => v.tier !== "unsettled" && v.ratio != null && v.ratio > 0)
const y = (v) => (v.ratio >= 3 ? 1 : 0)

// Within-channel mid-rank percentiles, referenced to the channel's settled population; a channel with
// fewer than 8 values for an axis uses the pooled population for it.
const byChannel = new Map()
for (const v of settled) byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v])
const refCache = new Map()
function ref(channelId, key) {
  const ck = channelId + "|" + key
  if (refCache.has(ck)) return refCache.get(ck)
  let xs = (byChannel.get(channelId) ?? []).map((v) => valueOf(v, key)).filter((x) => x != null)
  if (xs.length < 8) xs = settled.map((v) => valueOf(v, key)).filter((x) => x != null)
  xs.sort((a, b) => a - b)
  refCache.set(ck, xs)
  return xs
}
function midrank(xs, x) {
  let lo = 0, hi = xs.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m }
  const below = lo
  let eq = 0
  while (below + eq < xs.length && xs[below + eq] === x) eq++
  return (below + eq / 2) / Math.max(1, xs.length)
}
const fullTemplate = (v) => AXES.map(([key]) => { const x = valueOf(v, key); return x == null ? 0.5 : midrank(ref(v.channelId, key), x) })

// ---------- utilities ----------
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s }

function kmeans(points, k, seed, restarts = 10, iters = 100) {
  const r = rng(seed)
  let best = null
  for (let rs = 0; rs < restarts; rs++) {
    // k-means++ seeding
    const cents = [points[Math.floor(r() * points.length)].slice()]
    while (cents.length < k) {
      const ds = points.map((p) => Math.min(...cents.map((c) => d2(p, c))))
      const tot = ds.reduce((a, b) => a + b, 0)
      let u = r() * tot, i = 0
      while (i < ds.length - 1 && (u -= ds[i]) > 0) i++
      cents.push(points[i].slice())
    }
    let assign = new Array(points.length).fill(-1)
    for (let it = 0; it < iters; it++) {
      let moved = false
      for (let p = 0; p < points.length; p++) {
        const a = nearestOf(cents, points[p])
        if (a !== assign[p]) { assign[p] = a; moved = true }
      }
      for (let c = 0; c < k; c++) {
        const mine = points.filter((_, p) => assign[p] === c)
        if (mine.length) cents[c] = mine[0].map((_, j) => mine.reduce((s, q) => s + q[j], 0) / mine.length)
      }
      if (!moved) break
    }
    const inertia = points.reduce((s, p, i) => s + d2(p, cents[assign[i]]), 0)
    if (!best || inertia < best.inertia) best = { cents, inertia }
  }
  return best.cents
}
function nearestOf(cents, t) {
  let bi = 0, bd = Infinity
  for (let i = 0; i < cents.length; i++) { const d = d2(cents[i], t); if (d < bd) { bd = d; bi = i } }
  return bi
}
const logloss = (p, yy) => -(yy ? Math.log(p) : Math.log(1 - p))
const clamp = (p) => Math.min(1 - 1e-4, Math.max(1e-4, p))

function auc(scores, labels) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b])
  let rank = 0, sumPos = 0, nPos = 0
  for (let i = 0; i < idx.length;) {
    let j = i
    while (j < idx.length && scores[idx[j]] === scores[idx[i]]) j++
    const mid = (i + j + 1) / 2
    for (let t = i; t < j; t++) if (labels[idx[t]]) { sumPos += mid; nPos++ }
    i = j
  }
  const nNeg = labels.length - nPos
  return nPos && nNeg ? (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : null
}
function withinAuc(rows) {
  // pairs within channel: an outperformer against a non-outperformer of the same channel
  let win = 0, n = 0
  const by = new Map()
  for (const r of rows) by.set(r.ch, [...(by.get(r.ch) ?? []), r])
  for (const list of by.values()) {
    const pos = list.filter((r) => r.y), neg = list.filter((r) => !r.y)
    for (const p of pos) for (const q of neg) { n++; win += p.s > q.s ? 1 : p.s === q.s ? 0.5 : 0 }
  }
  return n ? { auc: win / n, pairs: n } : null
}

// ---------- split ----------
const channels = [...byChannel.keys()].sort()
const isTest = (ch) => hash("winning-modes|" + ch) % 100 < 30
const trainCh = channels.filter((c) => !isTest(c))
const testCh = channels.filter(isTest)
const foldOf = (ch) => hash("fold|" + ch) % 5

function run(axisIdx, label) {
  const tpl = (v) => { const t = fullTemplate(v); return axisIdx.map((i) => t[i]) }
  const rows = settled.map((v) => ({ v, ch: v.channelId, y: y(v), t: tpl(v), blind: blindIds.has(v.id) }))
  const train = rows.filter((r) => !isTest(r.ch))
  const test = rows.filter((r) => isTest(r.ch))

  // 2. k on train channels
  const kTable = []
  for (let k = 3; k <= 8; k++) {
    let ll = 0, llBase = 0, n = 0
    for (let f = 0; f < 5; f++) {
      const fit = train.filter((r) => foldOf(r.ch) !== f)
      const held = train.filter((r) => foldOf(r.ch) === f)
      if (!held.length) continue
      const cents = kmeans(fit.filter((r) => r.y).map((r) => r.t), k, 1000 * k + f)
      const base = fit.reduce((s, r) => s + r.y, 0) / fit.length
      const pos = new Array(k).fill(0), cnt = new Array(k).fill(0)
      for (const r of fit) { const m = nearestOf(cents, r.t); cnt[m]++; pos[m] += r.y }
      const p = cnt.map((c, i) => clamp((pos[i] + 20 * base) / (c + 20)))
      for (const r of held) { ll += logloss(p[nearestOf(cents, r.t)], r.y); llBase += logloss(clamp(base), r.y); n++ }
    }
    kTable.push({ k, heldOutLogLoss: +(ll / n).toFixed(5), baseLogLoss: +(llBase / n).toFixed(5), gain: +((llBase - ll) / n).toFixed(5) })
  }
  const bestK = [...kTable].sort((a, b) => a.heldOutLogLoss - b.heldOutLogLoss || a.k - b.k)[0].k

  // 3. final modes on train, lifts re-measured on test channels
  const cents = kmeans(train.filter((r) => r.y).map((r) => r.t), bestK, 424242)
  const trainBase = train.reduce((s, r) => s + r.y, 0) / train.length
  const testBase = test.reduce((s, r) => s + r.y, 0) / test.length
  const blindTest = test.filter((r) => r.blind)
  const testBlindBase = blindTest.reduce((s, r) => s + r.y, 0) / Math.max(1, blindTest.length)
  const assignTest = test.map((r) => nearestOf(cents, r.t))
  const assignTrain = train.map((r) => nearestOf(cents, r.t))
  const winnersPer = new Array(bestK).fill(0)
  for (const r of train) if (r.y) winnersPer[nearestOf(cents, r.t)]++

  const r = rng(77)
  const byCh = new Map()
  test.forEach((row, i) => byCh.set(row.ch, [...(byCh.get(row.ch) ?? []), i]))
  const chList = [...byCh.keys()]
  const B = 1000
  const diffs = Array.from({ length: bestK }, () => [])
  for (let b = 0; b < B; b++) {
    const pos = new Array(bestK).fill(0), cnt = new Array(bestK).fill(0)
    let bp = 0, bn = 0
    for (let c = 0; c < chList.length; c++) {
      for (const i of byCh.get(chList[Math.floor(r() * chList.length)])) { cnt[assignTest[i]]++; pos[assignTest[i]] += test[i].y; bp += test[i].y; bn++ }
    }
    for (let m = 0; m < bestK; m++) if (cnt[m]) diffs[m].push(pos[m] / cnt[m] - bp / bn)
  }
  const q = (xs, p) => { const a = [...xs].sort((x, z) => x - z); return a[Math.min(a.length - 1, Math.floor(p * a.length))] }

  const modes = cents.map((c, m) => {
    const mineTest = test.filter((_, i) => assignTest[i] === m)
    const mineTrain = train.filter((_, i) => assignTrain[i] === m)
    const lift = mineTest.length ? mineTest.reduce((s, x) => s + x.y, 0) / mineTest.length : null
    const lo = diffs[m].length ? q(diffs[m], 0.05) : null, hi = diffs[m].length ? q(diffs[m], 0.95) : null
    const blindMine = mineTest.filter((x) => x.blind)
    const survived = lo != null && lo > 0
    // name: the three axes furthest from the channel's middle
    const order = c.map((x, j) => [j, x]).sort((a, b) => Math.abs(b[1] - 0.5) - Math.abs(a[1] - 0.5)).slice(0, 3)
    const name = order.map(([j, x]) => `${x > 0.5 ? "high" : "low"} ${AXES[axisIdx[j]][1]}`).join(", ")
    return {
      id: m + 1,
      name,
      center: Object.fromEntries(c.map((x, j) => [AXES[axisIdx[j]][0], Math.round(100 * x)])),
      trainOutperformers: winnersPer[m],
      trainLift: mineTrain.length ? +(mineTrain.reduce((s, x) => s + x.y, 0) / mineTrain.length).toFixed(3) : null,
      heldOut: {
        videos: mineTest.length,
        channels: new Set(mineTest.map((x) => x.ch)).size,
        lift: lift == null ? null : +lift.toFixed(3),
        base: +testBase.toFixed(3),
        liftOverBase90: lo == null ? null : [+lo.toFixed(3), +hi.toFixed(3)],
        blindSample: { videos: blindMine.length, lift: blindMine.length ? +(blindMine.reduce((s, x) => s + x.y, 0) / blindMine.length).toFixed(3) : null, base: +testBlindBase.toFixed(3) },
      },
      survived,
      ...(!survived && { dropped: lift == null ? "no held-out video lies nearest it" : lift <= testBase ? `held-out lift ${lift.toFixed(3)} at or below base ${testBase.toFixed(3)}` : `held-out lift ${lift.toFixed(3)} over base ${testBase.toFixed(3)}, but the 90% interval of the difference reaches ${lo.toFixed(3)}` }),
    }
  })

  // 4. mode-match against the label-blind baseline
  const keep = cents.filter((_, m) => modes[m].survived)
  const dist = (t) => (keep.length ? Math.sqrt(Math.min(...keep.map((c) => d2(c, t)))) : null)
  const baseline = rows.filter((x) => x.blind).map((x) => dist(x.t)).filter((x) => x != null).sort((a, b) => a - b)
  const score = (t) => {
    const d = dist(t)
    if (d == null) return null
    const farther = baseline.length - midrank(baseline, d) * baseline.length
    return Math.round((100 * farther) / baseline.length)
  }
  const testScored = test.map((x) => ({ ch: x.ch, y: x.y, s: score(x.t) })).filter((x) => x.s != null)
  const blindTestScored = test.filter((x) => x.blind).map((x) => ({ y: x.y, s: score(x.t) })).filter((x) => x.s != null)
  const evalAuc = keep.length
    ? {
        note: "test channels, which also decided which modes survive; read as an upper bound",
        pooled: +auc(testScored.map((x) => x.s), testScored.map((x) => x.y)).toFixed(3),
        withinChannel: (() => { const w = withinAuc(testScored); return w && { auc: +w.auc.toFixed(3), pairs: w.pairs } })(),
        blindSamplePooled: blindTestScored.length ? +auc(blindTestScored.map((x) => x.s), blindTestScored.map((x) => x.y)).toFixed(3) : null,
      }
    : null

  console.log(`\n[${label}] axes ${axisIdx.length}; train ${train.length} videos / ${trainCh.length} channels (base ${trainBase.toFixed(3)}); test ${test.length} / ${testCh.length} (base ${testBase.toFixed(3)})`)
  console.table(kTable)
  console.log(`k = ${bestK}`)
  for (const m of modes) console.log(`  mode ${m.id} ${m.survived ? "SURVIVES" : "dropped "} lift ${m.heldOut.lift} base ${m.heldOut.base} diff90 ${JSON.stringify(m.heldOut.liftOverBase90)} n=${m.heldOut.videos} blind=${JSON.stringify(m.heldOut.blindSample)} | ${m.name}`)
  console.log("  match AUC", JSON.stringify(evalAuc))

  console.log(`  blind-sample test base ${testBlindBase.toFixed(3)} over ${blindTest.length} videos`)
  return { label, axisIdx, kTable, k: bestK, trainBase, testBase, testBlindBase, train, test, modes, score, evalAuc, keep }
}

const fullIdx = AXES.map((_, i) => i)
const preIdx = AXES.map((a, i) => [a, i]).filter(([a]) => a[2] !== "engagement").map(([, i]) => i)
const full = run(fullIdx, "full")
const pre = run(preIdx, "preRelease")

const summarize = (R) => ({
  axes: R.axisIdx.map((i) => AXES[i][0]),
  kSelection: R.kTable,
  k: R.k,
  base: { train: +R.trainBase.toFixed(3), test: +R.testBase.toFixed(3), testBlindSample: +R.testBlindBase.toFixed(3) },
  modes: R.modes,
  surviving: R.modes.filter((m) => m.survived).length,
  matchAuc: R.evalAuc,
})

// Scores: every media-measured short, settled or not, in the full variant.
const scores = {}, scoresPreRelease = {}
for (const v of all) {
  const t = fullTemplate(v)
  const s = full.score(t)
  if (s != null) scores[v.id] = s
  const sp = pre.score(preIdx.map((i) => t[i]))
  if (sp != null) scoresPreRelease[v.id] = sp
}

const out = {
  builtAt: new Date().toISOString(),
  version: "winning-modes-1",
  definition: "A winning mode is a recurring craft configuration among shorts that outperformed 3x their channel median, kept only where its lift re-measures above the base rate on held-out channels. A short's mode-match is how close its craft template sits to the nearest surviving mode, 0 to 100 against the label-blind baseline sample.",
  protocol: "Channels split 70/30 by hash. k in 3..8 chosen on train channels by 5-fold channel-grouped CV (held-out log loss of the nearest-mode share over 3x, smoothed with 20 pseudo-videos at base). Final k-means (k-means++, 10 restarts) on train outperformers; lift re-measured on test channels; a mode survives when the 90% channel-bootstrap interval (1,000 draws) of lift minus base lies above zero.",
  population: {
    rule: "settled catalog shorts with media-measured composition; label = views at or over 3x the channel median",
    videos: settled.length,
    channels: channels.length,
    trainChannels: trainCh.length,
    testChannels: testCh.length,
    note: "the media set was fetched mostly in outperformer/control pairs, so its base rate runs far above the catalog's; every lift is read against the base of the same population, and the label-blind sample is reported beside it",
  },
  axes: Object.fromEntries(AXES.map(([k, label, group]) => [k, { label, group }])),
  removed: ["outlier multiple", "classifier forecast"],
  full: summarize(full),
  preRelease: summarize(pre),
  serves: "full",
  scores,
  scoresPreRelease,
}
const file = path.join(root, "data/generated/model/winning-modes.json")
fs.writeFileSync(file, JSON.stringify(out) + "\n")
console.log(`\nwrote ${path.relative(root, file)}: ${Object.keys(scores).length} scores, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`)
