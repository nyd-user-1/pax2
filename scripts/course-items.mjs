// The item pools for Teach a Model's exercises (src/lib/courses.ts), drawn once and frozen so an
// answer written to DynamoDB always points at the same item. Reads the settled shorts of the
// lookback catalog (data/velocity/catalog.json: breakout at 3x the channel median or more, killed at
// 0.5x or less, baseline between) and the script library (data/library.json). Each item lists the
// videos shown; their outcomes sit apart under `facts`, which only the server reads.
// Writes data/generated/course-items.json. Rerunning with the same seed reproduces it exactly.
// Usage: node --experimental-strip-types scripts/course-items.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { familyOf } from "../src/lib/video-features.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const OUT = path.join(root, "data/generated/course-items.json")

let a = 20261018
const rand = () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (xs) => xs[Math.floor(rand() * xs.length)]
const shuffle = (xs) => {
  const o = [...xs]
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[o[i], o[j]] = [o[j], o[i]]
  }
  return o
}

const catalog = read("data/velocity/catalog.json")
const settled = catalog.videos
  .map((v) => ({ ...v, family: familyOf(v.group) }))
  .filter((v) => ["breakout", "baseline", "killed"].includes(v.tier) && v.family && v.family !== "UK" && v.title?.trim() && v.durationSec > 0 && v.durationSec <= 180 && v.channelMedian > 0)
const byChannel = new Map()
for (const v of settled) (byChannel.get(v.channelId) ?? byChannel.set(v.channelId, []).get(v.channelId)).push(v)
const byFamily = new Map()
for (const v of settled) (byFamily.get(v.family) ?? byFamily.set(v.family, []).get(v.family)).push(v)
const families = [...byFamily.keys()].sort()
const channels = [...byChannel.values()]

const used = new Map()
const use = (v) => (used.set(v.id, v), v.id)
const draw = (n, make) => {
  const out = []
  const seen = new Set()
  for (let tries = 0; out.length < n && tries < n * 50; tries++) {
    const ids = make()
    if (!ids) continue
    const key = ids.map((v) => v.id).sort().join()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ids)
  }
  return out
}
const fromFamily = (k) => {
  const f = pick(families)
  const vs = byFamily.get(f)
  const out = new Set()
  while (out.size < k) out.add(pick(vs))
  return [...out]
}
const items = (prefix, rows) => rows.map((v, i) => ({ id: `${prefix}-${i}`, v: v.map(use) }))

// One breakout and one non-breakout from the same channel, in random order.
const pairsSame = draw(240, () => {
  const ch = pick(channels)
  const b = ch.filter((v) => v.tier === "breakout")
  const n = ch.filter((v) => v.tier !== "breakout")
  if (!b.length || !n.length) return null
  return shuffle([pick(b), pick(n)])
})
// Two shorts of one family from different channels.
const pairsFamily = draw(240, () => {
  const [x, y] = fromFamily(2)
  return x.channelId === y.channelId ? null : [x, y]
})
const quads = draw(160, () => {
  const q = fromFamily(4)
  return new Set(q.map((v) => v.ratio)).size === 4 ? q : null
})
const triplets = draw(240, () => fromFamily(3))
const channelTriples = draw(160, () => {
  const ch = pick(channels.filter((c) => c.length >= 6))
  const out = new Set()
  while (out.size < 3) out.add(pick(ch))
  return [...out]
})
const retrieval = draw(160, () => fromFamily(5))
const singles = draw(400, () => [pick(settled)])
// Balanced across outcomes, so a guess of the commonest answer scores no better than chance.
const tierPool = (tiers, n) => draw(n, () => [pick(settled.filter((v) => v.tier === tiers[Math.floor(rand() * tiers.length)]))])
const pushStop = tierPool(["breakout", "killed"], 240)
const hitMiss = tierPool(["breakout", "baseline", "killed"], 240)
const campaign = settled.filter((v) => ["Reform", "Voting rights", "Nonpartisan media"].includes(v.family))
const feed = draw(400, () => [pick(campaign)])
const watch = draw(160, () => [pick(campaign.filter((v) => v.durationSec <= 90))])

const familyRates = families.map((f) => {
  const vs = byFamily.get(f)
  return { id: `fam-${f.toLowerCase().replace(/[^a-z]+/g, "-")}`, family: f, shorts: vs.length, breakoutShare: Math.round((vs.filter((v) => v.tier === "breakout").length / vs.length) * 1000) / 1000 }
})

const lib = read("data/library.json").scripts
const lines = lib.flatMap((s) => s.text.split("\n").map((t, i) => ({ id: `ln-${s.id}-${i}`, script: s.id, line: i, text: t.trim() })).filter((l) => l.text))
const openings = lib.map((s) => ({ script: s.id, text: s.text.split("\n")[0].trim(), next: s.text.split("\n")[1]?.trim() ?? "" }))
const openingPairs = []
for (let i = 0; i < openings.length; i++) for (let j = i + 1; j < openings.length; j++) openingPairs.push({ id: `op-${openings[i].script}-${openings[j].script}`, scripts: rand() < 0.5 ? [openings[i].script, openings[j].script] : [openings[j].script, openings[i].script] })


const out = {
  builtAt: new Date().toISOString(),
  source: `data/velocity/catalog.json (${catalog.source}, fetched ${catalog.fetchedAt}), ${settled.length} settled shorts under 3 minutes outside the UK family; data/library.json`,
  pools: {
    pairsSame: items("ps", pairsSame),
    pairsFamily: items("pf", pairsFamily),
    quads: items("q", quads),
    triplets: items("t", triplets),
    channelTriples: items("ct", channelTriples),
    retrieval: items("r", retrieval),
    singles: items("s", singles),
    pushStop: items("pp", pushStop),
    hitMiss: items("hm", hitMiss),
    feed: items("f", feed),
    watch: items("w", watch),
  },
  familyRates,
  lines,
  openings,
  openingPairs,
}
out.facts = Object.fromEntries([...used.values()].sort((x, y) => x.id.localeCompare(y.id)).map((v) => [v.id, { title: v.title, channel: v.channel, family: v.family, durationSec: v.durationSec, views: v.views, median: v.channelMedian, ratio: v.ratio, tier: v.tier }]))
fs.writeFileSync(OUT, JSON.stringify(out) + "\n")
console.log(`${settled.length} settled shorts; ${Object.keys(out.facts).length} videos used; pools: ${Object.entries(out.pools).map(([k, v]) => `${k} ${v.length}`).join(", ")}; ${lines.length} script lines, ${openingPairs.length} opening pairs`)
console.log(`breakout share by family: ${familyRates.map((f) => `${f.family} ${f.breakoutShare} of ${f.shorts}`).join("; ")}`)
console.log(`${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)
