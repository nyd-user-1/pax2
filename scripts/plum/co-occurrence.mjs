// PLUM, Part 2: the behavioral signal table — for each short, the shorts audiences treated alike, by
// signals PAX2 actually holds (PLUM's co-occurrence, arXiv 2510.07784 eq. 1, without watch logs).
//
//   (a) co-outlier   same channel, published within 45 days of each other (scripts/pairwise/train.mjs's
//                    window), both settled outliers (training-set breakout = 1). Settled rows are the
//                    training set's non-paid rows with a ratio, the rows src/lib/pairwise.ts's fit read.
//   (b) co-surge     both shorts reached their channel's 1x line (views at least the channel median) in
//                    the same ISO week, in the same cluster of the cluster map (k=40 on serving index
//                    20261019-094112-train), any channel. The crossing date is measured for shorts the
//                    poller read (publish + the first of 1/6/24/72 h at which views reached the median,
//                    velocity-features.json); for the rest of the catalog it is the publish date, a proxy
//                    (the settled ratio says the short crossed, not when) — counted separately.
//   (c) co-commenter same-commenter overlap. No commenter identities are stored anywhere in PAX2: the
//                    app reads YouTube comment threads live for display only. Coverage 0, said plainly.
//
// Each short keeps at most CAP neighbors per signal, nearest in publish time first. The held-out channels
// (data/generated/model/plum/holdout.json: the holdout run 20261019-094112-train was judged on, pinned from
// git 2910dbb because corpus rebuilds rewrite encoder/holdout.json) are marked; a pair touching one is
// never a training pair.
//
// Usage: node scripts/plum/co-occurrence.mjs
// Reads  data/generated/model/training-set.jsonl, velocity-features.json, plum/holdout.json,
//        data/plum/map.json (aws s3 cp from the index prefix)
// Writes data/generated/model/co-occurrence.json
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))
const WINDOW_DAYS = 45
const CAP = 10
const DAY = 86400e3

const rows = fs
  .readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
const settled = rows.filter((r) => r.group !== "paid-ad" && r.ratio != null && r.channelId && r.published)
const held = new Set(read("data/generated/model/plum/holdout.json").ids)
const heldChannels = new Set(settled.filter((r) => held.has(r.id)).map((r) => r.channelId))
const vel = read("data/generated/model/velocity-features.json").byId
const map = read("data/plum/map.json")
const cluster = new Map(map.points.map((p) => [p.id, p.cluster]))
const t = (r) => new Date(r.published).getTime()

const nbrs = new Map() // id -> { a, b, bm: co-surge pairs whose two crossings are both measured }
const add = (sig, x, y) => {
  for (const [p, q] of [[x, y], [y, x]]) {
    if (!nbrs.has(p.id)) nbrs.set(p.id, { a: [], b: [], bm: [] })
    nbrs.get(p.id)[sig].push({ id: q.id, dt: Math.abs(t(p) - t(q)) })
  }
}

// (a) co-outlier
const byChannel = new Map()
for (const r of settled) {
  if (!byChannel.has(r.channelId)) byChannel.set(r.channelId, [])
  byChannel.get(r.channelId).push(r)
}
let aPairs = 0
for (const vids of byChannel.values()) {
  const outs = vids.filter((r) => r.breakout === 1).sort((x, y) => t(x) - t(y))
  for (let i = 0; i < outs.length; i++)
    for (let j = i + 1; j < outs.length && t(outs[j]) - t(outs[i]) <= WINDOW_DAYS * DAY; j++) {
      add("a", outs[i], outs[j])
      aPairs++
    }
}

// (b) co-surge
const isoWeek = (ms) => {
  const d = new Date(ms)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const y = d.getUTCFullYear()
  const w1 = new Date(Date.UTC(y, 0, 4))
  return `${y}-W${String(1 + Math.round(((d - w1) / DAY - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`
}
const crossing = new Map() // id -> { ms, measured }
let measured = 0, proxied = 0, polledNoCross = 0
for (const r of settled) {
  if (!cluster.has(r.id) || !(r.channelMedian > 0)) continue
  const v = vel[r.id]
  if (v) {
    const h = [1, 6, 24, 72].find((h) => v[`views${h}h`] != null && v[`views${h}h`] >= r.channelMedian)
    if (h != null) {
      crossing.set(r.id, { ms: t(r) + h * 3600e3, measured: true })
      measured++
      continue
    }
    // Read by the poller and short of the line by 72 h; it may cross later, at an unmeasured date.
    if (r.ratio >= 1) polledNoCross++
    continue
  }
  if (r.ratio >= 1) {
    crossing.set(r.id, { ms: t(r), measured: false })
    proxied++
  }
}
const buckets = new Map()
const byId = new Map(settled.map((r) => [r.id, r]))
for (const [id, c] of crossing) {
  const k = `${isoWeek(c.ms)}|${cluster.get(id)}`
  if (!buckets.has(k)) buckets.set(k, [])
  buckets.get(k).push(byId.get(id))
}
let bPairs = 0, bPairsMeasured = 0, bCrossChannel = 0
for (const vids of buckets.values())
  for (let i = 0; i < vids.length; i++)
    for (let j = i + 1; j < vids.length; j++) {
      add("b", vids[i], vids[j])
      bPairs++
      if (crossing.get(vids[i].id).measured && crossing.get(vids[j].id).measured) {
        add("bm", vids[i], vids[j])
        bPairsMeasured++
      }
      if (vids[i].channelId !== vids[j].channelId) bCrossChannel++
    }

// Cap, nearest in publish time first, and the coverage counts.
const out = {}
const cov = { a: 0, b: 0, bm: 0, any: 0, aTrain: 0, bTrain: 0, bmTrain: 0, anyTrain: 0, aHeld: 0, bHeld: 0, bmHeld: 0 }
const kept = { a: 0, b: 0, bm: 0 }
for (const r of settled) {
  const n = nbrs.get(r.id)
  if (!n) continue
  const isHeld = held.has(r.id)
  const e = {}
  for (const s of ["a", "b", "bm"]) {
    if (!n[s].length) continue
    const list = n[s].sort((x, y) => x.dt - y.dt || x.id.localeCompare(y.id)).slice(0, CAP).map((x) => x.id)
    e[s] = list
    kept[s] += list.length
    cov[s]++
    if (isHeld) cov[`${s}Held`]++
    // A training pair needs both ends outside the held-out channels.
    if (!isHeld && list.some((id) => !held.has(id))) cov[`${s}Train`]++
  }
  if (Object.keys(e).length) {
    out[r.id] = e
    cov.any++
    if (!isHeld && [...(e.a ?? []), ...(e.b ?? [])].some((id) => !held.has(id))) cov.anyTrain++
  }
}
const trainingShorts = settled.filter((r) => !held.has(r.id)).length

const result = {
  builtAt: new Date().toISOString(),
  settledShorts: settled.length,
  trainingShorts,
  heldOutShorts: settled.length - trainingShorts,
  heldOutChannels: heldChannels.size,
  capPerSignal: CAP,
  signals: {
    a: {
      name: "co-outlier",
      definition: `same channel, published within ${WINDOW_DAYS} days, both settled outliers`,
      outliers: settled.filter((r) => r.breakout === 1).length,
      pairs: aPairs,
      shortsWithNeighbor: cov.a,
      trainingShortsWithTrainingNeighbor: cov.aTrain,
      heldOutShortsWithNeighbor: cov.aHeld,
      neighborsKept: kept.a,
    },
    b: {
      name: "co-surge",
      definition: "both reached the channel median in the same ISO week, same cluster-map cluster (k=40), any channel",
      crossingsMeasured: measured,
      crossingsProxied: proxied,
      polledShortOf1xBy72h: polledNoCross,
      buckets: buckets.size,
      pairs: bPairs,
      pairsBothMeasured: bPairsMeasured,
      pairsCrossChannel: bCrossChannel,
      shortsWithNeighbor: cov.b,
      trainingShortsWithTrainingNeighbor: cov.bTrain,
      heldOutShortsWithNeighbor: cov.bHeld,
      neighborsKept: kept.b,
      measuredOnly: { shortsWithNeighbor: cov.bm, trainingShortsWithTrainingNeighbor: cov.bmTrain, heldOutShortsWithNeighbor: cov.bmHeld, neighborsKept: kept.bm, note: "bm in neighbors: the subset of b whose two crossings the poller measured" },
      caveat: "crossing date is measured only for poller-read shorts; elsewhere it is the publish date",
    },
    c: {
      name: "co-commenter",
      definition: "same-commenter overlap",
      shortsWithNeighbor: 0,
      caveat: "no commenter identities are stored in PAX2; comment threads are read live for display only",
    },
  },
  shortsWithAnyNeighbor: cov.any,
  trainingShortsWithAnyTrainingNeighbor: cov.anyTrain,
  neighbors: out,
}
fs.writeFileSync(path.join(ROOT, "data/generated/model/co-occurrence.json"), JSON.stringify(result))
const { neighbors, ...summary } = result
console.log(JSON.stringify(summary, null, 1))
