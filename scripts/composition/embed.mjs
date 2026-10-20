// Embedding evidence for the combined PAX2 Composition Ranker (window C, Part 4, 2026-10-20): for
// every short in a breakout/control pair, what its nearest neighbors in the passing encoder's serving
// index (s3://pax-2-638175140432/model/encoder-index/<run>/, pointer current.json) say about it.
// The neighbor pool is labeled shorts from the encoder's training channels only, and never the
// short's own channel, so no held-out label and no channel's own baseline leaks into the evidence.
//   knnShare      share of outliers among the 20 nearest pool shorts by cosine (Gate E's statistic)
//   outlierMargin mean cosine to the 20 nearest pool outliers minus to the 20 nearest non-outliers
// Writes data/generated/model/composition-embed.json (id -> { knnShare, outlierMargin }).
// Usage: node scripts/composition/embed.mjs   (pulls the index to data/raw/composition/index first)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "./pairs.mjs"

const K = 20
const DIR = path.join(ROOT, "data/raw/composition/index")
const cur = JSON.parse(execFileSync("aws", ["s3", "cp", "s3://pax-2-638175140432/model/encoder-index/current.json", "-", "--region", "us-east-1"]).toString())
fs.mkdirSync(DIR, { recursive: true })
execFileSync("aws", ["s3", "sync", "--only-show-errors", `s3://pax-2-638175140432/model/encoder-index/${cur.run}/`, DIR, "--exclude", "map.json", "--region", "us-east-1"], { stdio: "inherit" })

const meta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"))
const rows = JSON.parse(fs.readFileSync(path.join(DIR, "rows.json"), "utf8"))
const buf = fs.readFileSync(path.join(DIR, "embeddings.npy"))
const hlen = buf.readUInt16LE(8)
const header = buf.subarray(10, 10 + hlen).toString()
if (!header.includes("'<f2'") || !header.includes(`(${meta.n}, ${meta.dim})`)) throw new Error(`unexpected npy header ${header}`)
const D = meta.dim
const f16 = new Uint16Array(buf.buffer.slice(buf.byteOffset + 10 + hlen, buf.byteOffset + 10 + hlen + meta.n * D * 2))
const half = (h) => {
  const s = h & 0x8000 ? -1 : 1
  const e = (h >> 10) & 0x1f
  const m = h & 0x3ff
  if (e === 0) return s * 2 ** -14 * (m / 1024)
  if (e === 31) return m ? NaN : s * Infinity
  return s * 2 ** (e - 15) * (1 + m / 1024)
}
const E = new Float32Array(meta.n * D)
for (let i = 0; i < E.length; i++) E[i] = half(f16[i])
for (let r = 0; r < meta.n; r++) {
  let s = 0
  for (let j = 0; j < D; j++) s += E[r * D + j] ** 2
  const inv = 1 / Math.sqrt(s || 1)
  for (let j = 0; j < D; j++) E[r * D + j] *= inv
}

const holdout = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/encoder/holdout.json"), "utf8"))
const held = new Set(Object.values(holdout.families).flatMap((f) => f.heldOut.map((h) => h.channelId)))
const rowOf = new Map(rows.map((r, i) => [r.id, i]))
const pool = rows.map((r, i) => i).filter((i) => rows[i].breakout != null && !held.has(rows[i].channelId))

const { pairs: ps } = pairs()
const ids = [...new Set(ps.flatMap((p) => [p.breakout.id, p.control.id]))].filter((id) => rowOf.has(id))
const out = {}
const t0 = Date.now()
const top = (arr, k) => arr.sort((a, b) => b - a).slice(0, k)
for (const [n, id] of ids.entries()) {
  const q = rowOf.get(id)
  const ch = rows[q].channelId
  const all = []
  const pos = []
  const neg = []
  for (const i of pool) {
    if (rows[i].channelId === ch) continue
    let s = 0
    const a = q * D
    const b = i * D
    for (let j = 0; j < D; j++) s += E[a + j] * E[b + j]
    all.push([s, rows[i].breakout])
    ;(rows[i].breakout ? pos : neg).push(s)
  }
  all.sort((x, y) => y[0] - x[0])
  const nn = all.slice(0, K)
  const mean = (xs) => xs.reduce((u, v) => u + v, 0) / xs.length
  out[id] = {
    knnShare: Math.round((nn.filter((x) => x[1]).length / K) * 1000) / 1000,
    outlierMargin: Math.round((mean(top(pos, K)) - mean(top(neg, K))) * 1e5) / 1e5,
  }
  if ((n + 1) % 500 === 0) console.log(`${n + 1}/${ids.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
fs.writeFileSync(
  path.join(ROOT, "data/generated/model/composition-embed.json"),
  JSON.stringify({ builtAt: new Date().toISOString(), run: cur.run, k: K, pool: pool.length, heldOutChannels: [...held], rule: "neighbors from labeled training-channel shorts only, never the short's own channel", shorts: out }),
)
console.log(`${ids.length} of ${new Set(ps.flatMap((p) => [p.breakout.id, p.control.id])).size} pair ids in the index; pool ${pool.length}; ${((Date.now() - t0) / 1000).toFixed(0)}s`)
