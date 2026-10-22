// The comparator behind the take read: for each client channel, its last 20 media-measured shorts
// (a composition row with cutsPerSec present), newest first, with the composition features the
// pairwise breakout picker (PAX2 Composition Ranker) scores. Small by design so the app imports it
// directly; rebuild after a composition merge.
//
// Usage: node scripts/take-baseline.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))

const CHANNELS = ["Voter Freedom", "Unite America"]
const comp = read("data/generated/model/composition.json")
const S = comp.shorts ?? comp.videos
const cat = read("data/velocity/catalog.json")
const vids = Array.isArray(cat) ? cat : cat.videos

const out = {}
for (const ch of CHANNELS) {
  out[ch] = vids
    .filter((v) => v.channel === ch && S[v.id] && typeof S[v.id].cutsPerSec === "number")
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, 20)
    .map((v) => ({ id: v.id, title: v.title, published: v.published, features: S[v.id] }))
}
fs.writeFileSync(path.join(ROOT, "data/generated/model/take-baseline.json"), JSON.stringify({ builtAt: new Date().toISOString(), channels: out }))
console.log("take-baseline.json:", Object.entries(out).map(([c, l]) => `${c} ${l.length}`).join(" · "))
