// Window MM-A, the label-blind media sample (Brendan's approval, 2026-10-21): 2,500 settled shorts drawn
// from PAX2 Classifier's population (training-set.jsonl, 18,544 rows, 64 channels, the 10 held-out
// included), allocated to channels in proportion to their row counts (largest remainder) and drawn
// uniformly within each channel by a seeded shuffle. No outcome field (breakout, ratio, tier, views) is
// read, so the set answers the survey's check 2: whether the media set's label-picked selection is what
// the stock reads saw.
//
// Usage: node scripts/video/blind-sample.mjs
// Writes data/generated/model/video-blind-sample.json and data/raw/videos/blind-targets.txt (fetch order
// shuffled so every fleet box gets a spread of channels)
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")
const N = 2500
let seed = 20261021
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const rows = fs.readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8").split("\n").filter(Boolean)
  .map((l) => { const r = JSON.parse(l); return { id: r.id, channelId: r.channelId, group: r.group, ok: r.breakout != null && r.group !== "paid-ad" } })
  .filter((r) => r.ok)
const byCh = new Map()
for (const r of rows) byCh.set(r.channelId, [...(byCh.get(r.channelId) ?? []), r.id])
const chans = [...byCh.keys()].sort()
const quota = chans.map((c) => (N * byCh.get(c).length) / rows.length)
const take = quota.map(Math.floor)
const order = chans.map((_, i) => i).sort((a, b) => quota[b] - take[b] - (quota[a] - take[a]) || a - b)
const deficit = N - take.reduce((s, x) => s + x, 0)
for (let k = 0; k < deficit; k++) take[order[k]]++
const ids = []
const perChannel = {}
chans.forEach((c, i) => {
  const pick = shuffle([...byCh.get(c)].sort()).slice(0, take[i])
  ids.push(...pick)
  perChannel[c] = { rows: byCh.get(c).length, sampled: pick.length }
})
const media = new Set(fs.existsSync(process.argv[2] ?? "") ? fs.readFileSync(process.argv[2], "utf8").split("\n").map((l) => l.trim().split(/\s+/).pop()).filter((f) => f?.endsWith(".mp4")).map((f) => f.slice(0, -4)) : [])
const out = { builtAt: new Date().toISOString(), rule: "2,500 of training-set.jsonl's settled non-paid rows, channel quotas proportional to rows (largest remainder), uniform within channel, seed 20261021; no outcome field read", population: { rows: rows.length, channels: chans.length }, n: ids.length, alreadyInMedia: ids.filter((i) => media.has(i)).length, perChannel, ids: [...ids].sort() }
fs.writeFileSync(path.join(ROOT, "data/generated/model/video-blind-sample.json"), JSON.stringify(out, null, 1))
fs.mkdirSync(path.join(ROOT, "data/raw/videos"), { recursive: true })
fs.writeFileSync(path.join(ROOT, "data/raw/videos/blind-targets.txt"), shuffle([...ids]).join("\n") + "\n")
console.log({ n: out.n, population: out.population, alreadyInMedia: out.alreadyInMedia, channelsSampled: Object.values(perChannel).filter((p) => p.sampled).length })
