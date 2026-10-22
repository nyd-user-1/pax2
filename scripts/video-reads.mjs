// The video page's per-video reads, in one compact file: each short's craft template (the winning-
// modes definition exactly: within-channel mid-rank percentiles referenced to the channel's settled
// shorts, the pooled population when a channel has fewer than 8 values, a missing value at the middle)
// and its topic cluster from the serving index's map. The template code is scripts/winning-modes.mjs'
// own, copied, so the polygon on the page sits on the same scale as the mode centers it is drawn against.
//
// Usage: node scripts/video-reads.mjs
// Reads  data/generated/model/composition.json, data/velocity/catalog.json, data/generated/model/encoder-map.json
// Writes data/generated/video-reads.json  { builtAt, axes, templates: { id: [0..100 per axis] }, topic: { id: cluster } }
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const comp = read("data/generated/model/composition.json").shorts
const catalog = read("data/velocity/catalog.json")
const map = read("data/generated/model/encoder-map.json")

const AXES = ["cutsPerSec", "firstCutSec", "cutsHook", "visualActivity", "loudnessLufs", "loudnessRange", "hookLoudnessDelta", "textWordsPerFrame", "textFrameShare", "textHook", "brightness", "saturation", "speechWps", "firstWordSec", "wordsHook", "speechShare", "durationSec", "titleWords", "titleQuestion", "titleNumber", "titleCapsRun", "titleEmoji", "likeRate", "commentRate"]

const all = catalog.videos.filter((v) => comp[v.id]?.cutsPerSec != null)
const valueOf = (v, key) => {
  if (key === "likeRate") return v.views > 0 ? (v.likes ?? 0) / v.views : null
  if (key === "commentRate") return v.views > 0 ? (v.comments ?? 0) / v.views : null
  const x = comp[v.id]?.[key]
  return x == null ? null : x
}
const settled = all.filter((v) => v.tier !== "unsettled" && v.ratio != null && v.ratio > 0)
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

const templates = {}
for (const v of all) templates[v.id] = AXES.map((key) => { const x = valueOf(v, key); return Math.round((x == null ? 0.5 : midrank(ref(v.channelId, key), x)) * 100) })

const topic = {}
for (const p of map.points) if (p.cluster != null) topic[p.id] = p.cluster

fs.writeFileSync(path.join(root, "data/generated/video-reads.json"), JSON.stringify({ builtAt: new Date().toISOString(), axes: AXES, templates, topic }) + "\n")
console.log(`video-reads.json: ${Object.keys(templates).length} templates, ${Object.keys(topic).length} topics`)
