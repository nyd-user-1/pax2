// The question bank's precomputed joins, one entry per baseline short, from the stores that are not
// committed (the velocity catalog, the per-short composition files, the transcript corpus, the serving
// index). Everything committed (census, codebook, craft, modes, topics, registry, policy) is read at render
// by src/lib/question-resolver.ts. Writes data/generated/question-bank.json.
//   node scripts/question-bank/build.mjs
import fs from "node:fs"
import { execFileSync } from "node:child_process"

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"))
const round2 = (x) => Math.round(x * 100) / 100
const census = read("data/generated/model/vqa-census.json").shorts
const ids = Object.keys(census).sort()
const idx = new Map(ids.map((id, i) => [id, i]))

const catalog = new Map(read("data/velocity/catalog.json").videos.map((v) => [v.id, v]))
const comp = read("data/generated/model/composition.json").shorts
const tx = read("data/generated/transcripts.json")
const points = read("data/generated/model/encoder-map.json").points
const neighbors = JSON.parse(
  execFileSync("python3", ["scripts/question-bank/neighbors.py"], { input: ids.join("\n"), maxBuffer: 1 << 28 }).toString(),
)

const r1 = (x) => Math.round(x * 10) / 10

const entries = {}
let rawMissing = 0
for (const id of ids) {
  const c = catalog.get(id)
  const e = {}
  if (c) Object.assign(e, { t: c.title, ch: c.channelId, v: c.views, m: c.channelMedian, r: c.ratio, tier: c.tier, lk: c.likes, cm: c.comments, d: c.durationSec, pub: c.published })

  const t = tx[id]
  if (t?.text) {
    const words = t.words?.length ? t.words.map((w) => w.w) : t.text.split(/\s+/)
    e.n = words.length
    e.last = words.slice(-8).join(" ")
  }

  const rawPath = `data/raw/composition/raw/${id}.json`
  if (fs.existsSync(rawPath)) {
    const raw = read(rawPath)
    const frames = raw.frames ?? []
    const tail = (raw.loudness?.perSecond ?? []).slice(-3)
    e.h3 = frames.filter((f) => f.t < 3).reduce((s, f) => s + f.words, 0)
    e.end = { text: frames.filter((f) => f.t >= raw.durationSec - 3 && f.words >= 2).length, lufs: tail.length ? r1(tail.reduce((s, x) => s + x, 0) / tail.length) : null }
  } else rawMissing++

  e.nb = (neighbors[id] ?? []).map(([nid, s]) => [idx.get(nid), s])
  entries[id] = e
}

// Field quantiles over the baseline, 0..100, for the "against the baseline" lines.
const quant = (key) => {
  const xs = ids.map((id) => comp[id]?.[key]).filter((x) => x != null).sort((a, b) => a - b)
  return Array.from({ length: 101 }, (_, p) => round2(xs[Math.min(xs.length - 1, Math.round((p / 100) * (xs.length - 1)))]))
}
const clusters = read("data/generated/model/encoder-map.json").clusters.map((c) => ({ id: c.id, n: c.n, label: c.labels?.[0] ?? "" }))
const family = {}
for (const p of points) if (p.channelId && p.family && !family[p.channelId]) family[p.channelId] = p.family

const bank = {
  builtAt: new Date().toISOString(),
  source: "scripts/question-bank/build.mjs: data/velocity/catalog.json, data/raw/composition/raw/, data/generated/transcripts.json, the serving index (data/raw/composition/index)",
  keys: {
    t: "title", ch: "channelId", v: "views", m: "channel median views", r: "Outlier Score (views over channel median)", tier: "catalog tier",
    lk: "likes", cm: "comments", d: "duration s", pub: "published", n: "transcript words", last: "last 8 words",
    h3: "OCR words in the first three sampled seconds", end: "last 3 s: sampled seconds with 2+ OCR words, mean LUFS",
    nb: "[index into ids, cosine] for the 20 nearest baseline shorts from other channels in the serving index",
  },
  ids,
  quantiles: Object.fromEntries(["loudnessLufs", "titleChars"].map((k) => [k, quant(k)])),
  family,
  clusters,
  shorts: entries,
}
const json = JSON.stringify(bank)
fs.writeFileSync("data/generated/question-bank.json", json + "\n")
console.log(`question-bank.json: ${ids.length} shorts, ${(json.length / 1048576).toFixed(2)} MB, ${rawMissing} without a composition file`)
