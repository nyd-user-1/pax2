// Each channel's Q. A short's ratio (views over its channel's median) is the dimensionless frequency of
// the universal resonance curve: it takes the channel's size out. It does not take out the channel's
// spread. A tight channel (high Q) rarely strays from its median; a loose one (low Q) swings wide, so
// 3x is a rare event on the first and routine on the second. For channels with 100+ settled shorts:
// - spread: the middle half of the channel's ratios, as a multiple (75th percentile over 25th);
// - curve: how its shorts spread over the chart's log axis (0.1x to 10x), smoothed (a Gaussian of 0.08
//   decades in log ratio) and scaled to peak at 1, the way the universal curve is;
// - q: the Q whose universal curve is as wide at half height as the channel's own, measured from its
//   peak — the response falls to half where |x - 1/x| = sqrt(3)/Q;
// - shorts: up to 60 of its shorts with one-line titles, spread across its ratios, for the tooltip.
// Writes data/generated/model/channel-q.json. Mac, no spend: node scripts/resonance/channel-q.mjs

import fs from "node:fs"

const rows = fs.readFileSync("data/generated/model/training-set.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.ratio > 0)
const by = new Map()
for (const r of rows) {
  const c = by.get(r.channelId) ?? { name: r.channel, family: r.family, rows: [] }
  c.rows.push(r)
  by.set(r.channelId, c)
}
const at = (a, p) => a[Math.floor(p * (a.length - 1))]
const GRID = Array.from({ length: 121 }, (_, i) => -1 + (i * 2) / 120)
const BW = 0.08
const plain = (t) => t.length >= 8 && t.length <= 28 && !/[^\x20-\x7E]/.test(t) && !/#/.test(t) && !/Bob Harvie/i.test(t)

const channels = [...by]
  .filter(([, c]) => c.rows.length >= 100)
  .map(([id, c]) => {
    const logs = c.rows.map((r) => Math.log10(r.ratio)).sort((x, y) => x - y)
    const spread = 10 ** (at(logs, 0.75) - at(logs, 0.25))
    const dens = GRID.map((g) => logs.reduce((t, x) => t + Math.exp(-0.5 * ((g - x) / BW) ** 2), 0))
    const top = Math.max(...dens)
    const curve = dens.map((d) => +(d / top).toFixed(4))
    const pk = curve.indexOf(1)
    let lo = pk
    while (lo > 0 && curve[lo] > 0.5) lo--
    let hi = pk
    while (hi < GRID.length - 1 && curve[hi] > 0.5) hi++
    const peak = 10 ** GRID[pk]
    const u = (x) => x / peak
    const width = (u(10 ** GRID[hi]) - 1 / u(10 ** GRID[hi]) + (1 / u(10 ** GRID[lo]) - u(10 ** GRID[lo]))) / 2
    const titled = c.rows.filter((r) => plain(r.title)).sort((a, b) => a.ratio - b.ratio)
    const step = Math.max(1, Math.floor(titled.length / 60))
    return {
      id,
      name: c.name,
      family: c.family,
      count: logs.length,
      spread: +spread.toFixed(2),
      p10: +(10 ** at(logs, 0.1)).toFixed(2),
      p90: +(10 ** at(logs, 0.9)).toFixed(2),
      at3x: +((logs.filter((x) => x >= Math.log10(3)).length / logs.length) * 100).toFixed(1),
      peak: +peak.toFixed(2),
      q: +(Math.sqrt(3) / width).toFixed(2),
      curve,
      shorts: titled.filter((_, i) => i % step === 0).map((r) => ({ id: r.id, title: r.title, ratio: r.ratio })),
    }
  })
  .sort((a, b) => a.spread - b.spread)

fs.writeFileSync("data/generated/model/channel-q.json", JSON.stringify({ built: new Date().toISOString(), source: "data/generated/model/training-set.jsonl", minShorts: 100, grid: GRID.map((g) => +(10 ** g).toFixed(4)), channels }) + "\n")
for (const c of channels) console.log(`${c.name.padEnd(30)} ${String(c.count).padStart(5)}  Q ${c.q}  middle half ×${c.spread}  at 3×+ ${c.at3x}%  ${c.shorts.length} titled`)
