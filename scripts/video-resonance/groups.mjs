// PAX2 Video Resonance, Stage 1 (window MM-B, docs/briefs/MM-B-video-resonance-train.md): the behavioral
// training groups for a projection head on frozen stock VideoPrism embeddings — the resonance recipe
// (scripts/plum/co-occurrence.mjs, con_pairs.py) ported to the media set.
//
// Media set: every short with measured video in data/generated/model/composition.json (cutsPerSec present,
// the definition behind its pairsBothSidesVideo 2,481) that is a settled non-paid row of the training set.
// Splits, by channel:
//   held   the encoder's 10 held-out channels (data/generated/model/encoder/holdout.json, the file
//          scripts/composition/fit.mjs reads), never in any group as anchor, positive or negative
//   val    training channels carved for variant selection: channels in seeded order, each taken while the
//          running total stays under 15% of training media, until it reaches 10%; never in any group
//   train  the rest; the only shorts any group contains
// Behavioral neighbors, within train only:
//   co-outlier  same channel, both settled outliers (training-set breakout = 1, ratio at least 3x the
//               channel median), published within 45 days
//   co-surge    the text recipe's measured co-surge (co-occurrence.mjs signal bm): both shorts reached
//               the channel median at a crossing the velocity poller measured (publish + the first of
//               1/6/24/72 h at which views reached it), in the same ISO week, in the same cluster of the
//               cluster map (data/plum/map.json)
// Groups: anchor = every train short with a neighbor; positives = up to 3, co-outlier nearest in time
// first, then co-surge; negatives = 7 train media shorts drawn at random (seed 20261020), not the anchor
// and not among its neighbors. Semantic groups need MM-A's embeddings and are mined on the box (train.py).
// The M1 pairs (scripts/composition/pairs.mjs with video on both sides) are written alongside with their
// split, so the box scores exactly the pairs the Composition Ranker and MM-A read.
//
// Usage: node scripts/video-resonance/groups.mjs
// Writes data/generated/model/video-resonance/groups.json
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "../composition/pairs.mjs"

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))
const SEED = 20261020
const WINDOW_DAYS = 45
const DAY = 86400e3
const VAL_MIN = 0.1
const VAL_MAX = 0.15

function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(SEED)
const shuffle = (xs) => {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const comp = read("data/generated/model/composition.json")
const holdout = read("data/generated/model/encoder/holdout.json")
const heldChannels = new Set(Object.values(holdout.families).flatMap((f) => f.heldOut.map((h) => h.channelId)))
const vel = read("data/generated/model/velocity-features.json").byId
const cluster = new Map(read("data/plum/map.json").points.map((p) => [p.id, p.cluster]))
const rows = fs
  .readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
const hasVideo = (id) => comp.shorts[id]?.cutsPerSec != null
const media = rows.filter((r) => hasVideo(r.id) && r.group !== "paid-ad" && r.ratio != null && r.channelId && r.published)
const t = (r) => new Date(r.published).getTime()

// validation channels
const trainPool = media.filter((r) => !heldChannels.has(r.channelId))
const perChannel = new Map()
for (const r of trainPool) perChannel.set(r.channelId, (perChannel.get(r.channelId) ?? 0) + 1)
const valChannels = new Set()
let valN = 0
for (const ch of shuffle([...perChannel.keys()].sort())) {
  if (valN >= VAL_MIN * trainPool.length) break
  const n = perChannel.get(ch)
  if (valN + n > VAL_MAX * trainPool.length) continue
  valChannels.add(ch)
  valN += n
}
const split = (ch) => (heldChannels.has(ch) ? "held" : valChannels.has(ch) ? "val" : "train")
const train = media.filter((r) => split(r.channelId) === "train")
const trainIds = new Set(train.map((r) => r.id))

// co-outlier
const nb = new Map(train.map((r) => [r.id, { a: [], bm: [] }]))
const byChannel = new Map()
for (const r of train) {
  if (!byChannel.has(r.channelId)) byChannel.set(r.channelId, [])
  byChannel.get(r.channelId).push(r)
}
let aPairs = 0
for (const vids of byChannel.values()) {
  const outs = vids.filter((r) => r.breakout === 1).sort((x, y) => t(x) - t(y))
  for (let i = 0; i < outs.length; i++)
    for (let j = i + 1; j < outs.length && t(outs[j]) - t(outs[i]) <= WINDOW_DAYS * DAY; j++) {
      const dt = t(outs[j]) - t(outs[i])
      nb.get(outs[i].id).a.push({ id: outs[j].id, dt })
      nb.get(outs[j].id).a.push({ id: outs[i].id, dt })
      aPairs++
    }
}

// co-surge, measured crossings only
const isoWeek = (ms) => {
  const d = new Date(ms)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const y = d.getUTCFullYear()
  const w1 = new Date(Date.UTC(y, 0, 4))
  return `${y}-W${String(1 + Math.round(((d - w1) / DAY - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`
}
const crossings = []
let polled = 0
for (const r of train) {
  const v = vel[r.id]
  if (!v) continue
  polled++
  if (!(r.channelMedian > 0) || !cluster.has(r.id)) continue
  const h = [1, 6, 24, 72].find((h) => v[`views${h}h`] != null && v[`views${h}h`] >= r.channelMedian)
  if (h != null) crossings.push({ r, ms: t(r) + h * 3600e3 })
}
const buckets = new Map()
for (const c of crossings) {
  const k = `${isoWeek(c.ms)}|${cluster.get(c.r.id)}`
  if (!buckets.has(k)) buckets.set(k, [])
  buckets.get(k).push(c.r)
}
let bmPairs = 0
for (const vids of buckets.values())
  for (let i = 0; i < vids.length; i++)
    for (let j = i + 1; j < vids.length; j++) {
      const dt = Math.abs(t(vids[i]) - t(vids[j]))
      nb.get(vids[i].id).bm.push({ id: vids[j].id, dt })
      nb.get(vids[j].id).bm.push({ id: vids[i].id, dt })
      bmPairs++
    }

// groups
const trainList = train.map((r) => r.id).sort()
const groups = []
const posBySignal = { a: 0, bm: 0 }
for (const id of trainList) {
  const e = nb.get(id)
  const order = (xs) => xs.sort((x, y) => x.dt - y.dt || x.id.localeCompare(y.id)).map((x) => x.id)
  const a = order(e.a)
  const bm = order(e.bm).filter((x) => !a.includes(x))
  if (!a.length && !bm.length) continue
  const pos = [...a, ...bm].slice(0, 3)
  for (const x of pos) posBySignal[a.includes(x) ? "a" : "bm"]++
  const taken = new Set([id, ...a, ...bm])
  const neg = []
  while (neg.length < 7) {
    const x = trainList[Math.floor(rng() * trainList.length)]
    if (!taken.has(x)) {
      neg.push(x)
      taken.add(x)
    }
  }
  groups.push({ anchor: id, pos, neg, src: pos.map((x) => (a.includes(x) ? "a" : "bm")) })
}

// M1 pairs, video on both sides
const { pairs: ps } = pairs()
const m1 = ps
  .filter((p) => hasVideo(p.breakout.id) && hasVideo(p.control.id))
  .map((p) => ({ winner: p.breakout.id, loser: p.control.id, channelId: p.breakout.channelId, winnerRatio: p.breakout.ratio, split: split(p.breakout.channelId) }))

// the held-out check, the house pattern: every id in every group against the held-out channels
const chOf = new Map(media.map((r) => [r.id, r.channelId]))
let heldInGroups = 0
let valInGroups = 0
let outsideTrain = 0
for (const g of groups)
  for (const x of [g.anchor, ...g.pos, ...g.neg]) {
    if (heldChannels.has(chOf.get(x))) heldInGroups++
    if (valChannels.has(chOf.get(x))) valInGroups++
    if (!trainIds.has(x)) outsideTrain++
  }
if (heldInGroups || valInGroups || outsideTrain) throw new Error(`held ${heldInGroups} val ${valInGroups} outside ${outsideTrain} in groups`)

const out = {
  builtAt: new Date().toISOString(),
  seed: SEED,
  rule: fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(2, 21).map((l) => l.slice(3)).join(" "),
  media: {
    shorts: media.length,
    train: train.length,
    val: media.filter((r) => split(r.channelId) === "val").length,
    held: media.filter((r) => split(r.channelId) === "held").length,
    trainChannels: new Set(train.map((r) => r.channelId)).size,
    valChannels: [...valChannels],
    heldChannels: [...heldChannels],
  },
  signals: {
    coOutlier: { pairs: aPairs, trainShortsWithNeighbor: train.filter((r) => nb.get(r.id).a.length).length },
    coSurge: { trainShortsPolled: polled, measuredCrossings: crossings.length, pairs: bmPairs, trainShortsWithNeighbor: train.filter((r) => nb.get(r.id).bm.length).length },
  },
  behavioralGroups: groups.length,
  positivesBySignal: posBySignal,
  heldOutCheck: { rule: "every anchor, positive and negative id checked against the held-out and validation channels and the train split", heldOutIdsInGroups: heldInGroups, valIdsInGroups: valInGroups, idsOutsideTrain: outsideTrain, pass: true },
  pairs: { all: m1.length, train: m1.filter((p) => p.split === "train").length, val: m1.filter((p) => p.split === "val").length, held: m1.filter((p) => p.split === "held").length },
  shorts: media.map((r) => ({ id: r.id, channelId: r.channelId, tier: r.tier, breakout: r.breakout, ratio: r.ratio, published: r.published, split: split(r.channelId) })),
  groups,
  m1Pairs: m1,
}
fs.mkdirSync(path.join(ROOT, "data/generated/model/video-resonance"), { recursive: true })
fs.writeFileSync(path.join(ROOT, "data/generated/model/video-resonance/groups.json"), JSON.stringify(out))
const { shorts, groups: _g, m1Pairs: _p, rule, ...summary } = out
console.log(JSON.stringify(summary, null, 1))
