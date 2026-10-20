// The resonant length: across the settled shorts, the share that outperform (3x their channel's median
// or more, tier "breakout") and the share that underperform (half the median or less, tier "killed"), by length.
// Measured two ways: pooled, and within channel — each short scored against its own channel's rates, so
// a channel that posts short videos and happens to do well can't make the crossing on its own. Writes
// data/generated/model/length-crossing.json, with an outperformer and an underperformer from each length band for the
// chart's tooltips. Mac, no spend: node scripts/resonance/length-crossing.mjs

import fs from "node:fs"

const rows = fs.readFileSync("data/generated/model/training-set.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l))
const feed = new Set(JSON.parse(fs.readFileSync("data/generated/home-feed.json", "utf8")).map((v) => v.id))

const EDGES = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120, 181]
const up = (r) => (r.tier === "breakout" ? 1 : 0)
const down = (r) => (r.tier === "killed" ? 1 : 0)

// Each channel's own outperform and underperform rates.
const byChannel = new Map()
for (const r of rows) {
  const c = byChannel.get(r.channelId) ?? { n: 0, up: 0, down: 0 }
  c.n++
  c.up += up(r)
  c.down += down(r)
  byChannel.set(r.channelId, c)
}
const overall = { up: rows.reduce((s, r) => s + up(r), 0) / rows.length, down: rows.reduce((s, r) => s + down(r), 0) / rows.length }

// A tooltip short: a one-line title (8 to 24 characters, plain text), from the reform and voting-rights
// channels where the band has one, then the home feed, then any.
const short = (r) => r.title.length >= 8 && r.title.length <= 24 && !/[^\x20-\x7E]/.test(r.title) && !/#/.test(r.title)
const onMessage = (r) => r.family === "Reform" || r.family === "Voting rights"
const pick = (band, test, by) => {
  const ok = band.filter((r) => test(r) && short(r)).sort(by)
  return ok.find(onMessage) ?? ok.find((r) => feed.has(r.id)) ?? ok[0] ?? null
}
const card = (r) => r && { id: r.id, title: r.title, channel: r.channel, family: r.family, ratio: r.ratio, seconds: r.durationSec }

const bins = []
for (let i = 0; i < EDGES.length - 1; i++) {
  const band = rows.filter((r) => r.durationSec >= EDGES[i] && r.durationSec < EDGES[i + 1])
  if (!band.length) continue
  const n = band.length
  const pooledUp = band.reduce((s, r) => s + up(r), 0) / n
  const pooledDown = band.reduce((s, r) => s + down(r), 0) / n
  // Within channel: the overall rate, moved by how far this band's shorts sit from their own channel's rate.
  const withinUp = overall.up + band.reduce((s, r) => { const c = byChannel.get(r.channelId); return s + (up(r) - c.up / c.n) }, 0) / n
  const withinDown = overall.down + band.reduce((s, r) => { const c = byChannel.get(r.channelId); return s + (down(r) - c.down / c.n) }, 0) / n
  bins.push({
    from: EDGES[i],
    to: EDGES[i + 1],
    mid: (EDGES[i] + Math.min(EDGES[i + 1], 180)) / 2,
    n,
    channels: new Set(band.map((r) => r.channelId)).size,
    pooled: { outperform: +(pooledUp * 100).toFixed(2), underperform: +(pooledDown * 100).toFixed(2) },
    within: { outperform: +(withinUp * 100).toFixed(2), underperform: +(withinDown * 100).toFixed(2) },
    outperformShort: card(pick(band, (r) => r.tier === "breakout", (a, b) => b.ratio - a.ratio)),
    underperformShort: card(pick(band, (r) => r.tier === "killed", (a, b) => a.ratio - b.ratio)),
  })
}

// Where the outperform curve first falls below the underperform curve, interpolated between band midpoints.
const crossing = (key) => {
  for (let i = 1; i < bins.length; i++) {
    const a = bins[i - 1][key], b = bins[i][key]
    const ga = a.outperform - a.underperform, gb = b.outperform - b.underperform
    if (ga > 0 && gb <= 0) {
      const t = ga / (ga - gb)
      const seconds = bins[i - 1].mid + t * (bins[i].mid - bins[i - 1].mid)
      return { seconds: +seconds.toFixed(1), share: +(a.outperform + t * (b.outperform - a.outperform)).toFixed(2) }
    }
  }
  return null
}

const out = {
  built: new Date().toISOString(),
  source: "data/generated/model/training-set.jsonl",
  shorts: rows.length,
  channels: byChannel.size,
  definitions: { outperform: "3x the channel's median views or more (tier breakout)", underperform: "half the channel's median or less (tier killed)" },
  overall: { outperform: +(overall.up * 100).toFixed(2), underperform: +(overall.down * 100).toFixed(2) },
  crossing: { pooled: crossing("pooled"), within: crossing("within") },
  bins,
}
fs.writeFileSync("data/generated/model/length-crossing.json", JSON.stringify(out, null, 1) + "\n")
console.log(JSON.stringify(out.crossing), out.overall)
for (const b of bins) console.log(`${b.from}-${b.to}s n=${b.n} ch=${b.channels} pooled ${b.pooled.outperform}/${b.pooled.underperform} within ${b.within.outperform}/${b.within.underperform} | ${b.outperformShort?.title ?? "-"} | ${b.underperformShort?.title ?? "-"}`)
