// The lab videos' content vectors, from the serving index already synced to
// data/raw/composition/index (run in meta.json): per id, the 1,024-dimension embedding and the
// outlier share of its 20 nearest index shorts from other channels. Merges into
// data/generated/model/viometric-vectors.json; existing entries keep every field they carry.
//
// Usage: node scripts/viometrics/vectors.mjs <id> [<id> ...]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const DIR = path.join(ROOT, "data/raw/composition/index")
const ids = process.argv.slice(2)
if (!ids.length) throw new Error("ids required")

const meta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"))
const rows = JSON.parse(fs.readFileSync(path.join(DIR, "rows.json"), "utf8"))
const buf = fs.readFileSync(path.join(DIR, "embeddings.npy"))
const hlen = buf.readUInt16LE(8)
const header = buf.subarray(10, 10 + hlen).toString()
if (!header.includes("'<f2'")) throw new Error(`unexpected npy header ${header}`)
const dims = +header.match(/\((\d+),\s*(\d+)\)/)[2]
// Half-precision on disk (embed.mjs's decoding), normalized after widening.
const f16 = new Uint16Array(buf.buffer.slice(buf.byteOffset + 10 + hlen, buf.byteOffset + 10 + hlen + rows.length * dims * 2))
const half = (h) => {
  const s = h & 0x8000 ? -1 : 1
  const e = (h >> 10) & 0x1f
  const m = h & 0x3ff
  if (e === 0) return s * 2 ** -14 * (m / 1024)
  if (e === 31) return m ? NaN : s * Infinity
  return s * 2 ** (e - 15) * (1 + m / 1024)
}
const vec = (i) => {
  const out = new Float32Array(dims)
  let s = 0
  for (let d = 0; d < dims; d++) {
    out[d] = half(f16[i * dims + d])
    s += out[d] ** 2
  }
  const inv = 1 / Math.sqrt(s || 1)
  for (let d = 0; d < dims; d++) out[d] *= inv
  return out
}

const file = path.join(ROOT, "data/generated/model/viometric-vectors.json")
let store = {}
try {
  store = JSON.parse(fs.readFileSync(file, "utf8"))
} catch {}

for (const id of ids) {
  const at = rows.findIndex((r) => r.id === id)
  if (at < 0) {
    console.log(id, "not in the index; skipped")
    continue
  }
  const q = vec(at)
  // Cosine to every other-channel row; the embeddings are L2-normalized, so the dot is the cosine.
  const sims = []
  for (let i = 0; i < rows.length; i++) {
    if (i === at || rows[i].channelId === rows[at].channelId) continue
    const w = vec(i)
    let s = 0
    for (let d = 0; d < dims; d++) s += q[d] * w[d]
    sims.push([s, i])
  }
  sims.sort((a, b) => b[0] - a[0])
  const top = sims.slice(0, 20)
  const share = top.filter(([, i]) => rows[i].breakout === 1).length / top.length
  store[id] = { ...(store[id] ?? {}), run: meta.run, vector: [...q].map((x) => Math.round(x * 1e6) / 1e6), neighborOutlierShare: share }
  console.log(id, "vector", dims, "neighborOutlierShare", share.toFixed(2))
}
fs.writeFileSync(file, JSON.stringify(store))
