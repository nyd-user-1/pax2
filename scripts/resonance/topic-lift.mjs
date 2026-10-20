// The resonant topic: which content neighborhoods lift a short past its own channel's usual pull. For
// each k-means topic on the serving index (encoder-map.json) found in five or more channels, the lift is
// the share of its shorts at 3x their channel's median or more, minus those channels' own usual share,
// in points; the 90% range comes from resampling the topic's channels (2,000 draws, seeded), so one big
// channel can't carry it. Topics in fewer than five channels, or with fewer than three channels of ten
// or more shorts, are one creator's audience under another name and are left out. Names are written by
// hand from each topic's titles. Writes data/generated/model/topic-lift.json.
// Mac, no spend: node scripts/resonance/topic-lift.mjs

import fs from "node:fs"

const map = JSON.parse(fs.readFileSync("data/generated/model/encoder-map.json", "utf8"))

// Plain names, read off each topic's titles (printed below so they can be checked).
const NAMES = {
  0: "Policy explainers",
  1: "Reaction one-liners",
  2: "Podcast clips on Trump",
  7: "Campaign pitches",
  8: "Trump quote clips",
  9: "James Talarico clips",
  11: "Outrage headlines",
  12: "Cable news moments",
  13: "Rule of law and voting rights",
  15: "Michigan reform organizing",
  17: "Reform commentary",
  18: "Calling out Republicans",
  19: "Culture-war questions",
  22: "Ohio campaign trail",
  27: "Interviews and hearings",
  28: "Electoral reform explainers",
  30: "Democrats on fixing democracy",
  36: "Conservative culture clips",
  37: "Trump news",
  38: "Debates and big ideas",
  39: "Thank-yous and home-state pride",
}
// Never shown as a topic's example.
const EXCLUDE = (p) => /Bob Harvie/i.test(p.label)

const pts = map.points.filter((p) => p.breakout != null)
const chan = new Map()
for (const p of pts) {
  const c = chan.get(p.channelId) ?? { n: 0, hits: 0 }
  c.n++
  c.hits += p.breakout
  chan.set(p.channelId, c)
}
const base = (id) => chan.get(id).hits / chan.get(id).n

// Seeded, so the ranges don't move between runs.
let seed = 20261020
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

const plain = (p) => p.label.length >= 8 && p.label.length <= 28 && !/[^\x20-\x7E]/.test(p.label) && !/#/.test(p.label) && !EXCLUDE(p)
const onMessage = (p) => p.family === "Reform" || p.family === "Voting rights"

const topics = []
for (const c of map.clusters) {
  const members = pts.filter((p) => p.cluster === c.id)
  const byChannel = new Map()
  for (const p of members) {
    const g = byChannel.get(p.channelId) ?? { n: 0, excess: 0 }
    g.n++
    g.excess += p.breakout - base(p.channelId)
    byChannel.set(p.channelId, g)
  }
  if (byChannel.size < 5 || [...byChannel.values()].filter((g) => g.n >= 10).length < 3) continue
  const groups = [...byChannel.values()]
  const liftOf = (gs) => (gs.reduce((t, g) => t + g.excess, 0) / gs.reduce((t, g) => t + g.n, 0)) * 100
  const lift = liftOf(groups)
  const draws = Array.from({ length: 2000 }, () => liftOf(groups.map(() => groups[Math.floor(rand() * groups.length)]))).sort((a, b) => a - b)
  const big = groups.filter((g) => g.n >= 10)
  // The example: a short from the topic on the side its lift points to.
  const want = lift >= 0 ? (p) => p.tier === "breakout" : (p) => p.tier === "killed"
  const pool = members.filter((p) => want(p) && plain(p))
  const ex = pool.find(onMessage) ?? pool[0] ?? members.find((p) => plain(p))
  topics.push({
    id: c.id,
    name: NAMES[c.id] ?? c.labels[0],
    lift: +lift.toFixed(1),
    low: +draws[Math.floor(draws.length * 0.05)].toFixed(1),
    high: +draws[Math.floor(draws.length * 0.95)].toFixed(1),
    shorts: members.length,
    channels: byChannel.size,
    channelsUp: big.filter((g) => g.excess > 0).length,
    channelsSized: big.length,
    example: ex ? { id: ex.id, title: ex.label } : null,
  })
}
topics.sort((a, b) => b.lift - a.lift)

fs.writeFileSync(
  "data/generated/model/topic-lift.json",
  JSON.stringify({ built: new Date().toISOString(), source: "data/generated/model/encoder-map.json", run: map.run, minChannels: 5, minSizedChannels: 3, topics }, null, 1) + "\n",
)
for (const t of topics) console.log(`${t.lift > 0 ? "+" : ""}${t.lift} (${t.low} to ${t.high}) ${t.name} · ${t.shorts} shorts · ${t.channels} ch · ${t.channelsUp}/${t.channelsSized} up | ${t.example?.title ?? "-"}`)
