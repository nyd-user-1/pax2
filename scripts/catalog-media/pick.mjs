// The breakout reverse-engineering set: every settled breakout in the catalog paired with a
// same-channel non-breakout control (nearest publish date, each control used once), ordered by the
// breakout's views ratio descending, pair-interleaved — so any prefix of the list is a balanced,
// strongest-first sample. Written 2026-10-19 at Brendan's direction: the content model's training
// data, fetched from the Mac because YouTube answers a home connection and blocks AWS.
//
// Usage: node scripts/catalog-media/pick.mjs
// Reads  data/velocity/catalog.json and data/raw/videos/archive.txt (ids already fetched)
// Writes data/raw/videos/targets.txt, one id per line, breakout then its control
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")
const OUT = path.join(ROOT, "data/raw/videos")
fs.mkdirSync(OUT, { recursive: true })
const archivePath = path.join(OUT, "archive.txt")
const done = new Set(fs.existsSync(archivePath) ? fs.readFileSync(archivePath, "utf8").split("\n").filter(Boolean) : [])

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data/velocity/catalog.json"), "utf8"))
const settled = catalog.videos.filter((v) => v.tier && v.tier !== "unsettled")
const breakouts = settled.filter((v) => v.tier === "breakout").sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
const byChannel = new Map()
for (const v of settled) {
  if (v.tier === "breakout") continue
  if (!byChannel.has(v.channelId)) byChannel.set(v.channelId, [])
  byChannel.get(v.channelId).push(v)
}

const used = new Set()
const lines = []
let noControl = 0
for (const b of breakouts) {
  const pool = (byChannel.get(b.channelId) ?? []).filter((c) => !used.has(c.id))
  const control = pool.sort((x, y) => Math.abs(new Date(x.published) - new Date(b.published)) - Math.abs(new Date(y.published) - new Date(b.published)))[0]
  if (!done.has(b.id)) lines.push(b.id)
  if (control) {
    used.add(control.id)
    if (!done.has(control.id)) lines.push(control.id)
  } else noControl++
}
fs.writeFileSync(path.join(OUT, "targets.txt"), lines.join("\n") + "\n")
console.log(`${breakouts.length} breakouts, ${used.size} controls, ${noControl} without a same-channel control, ${done.size} already fetched; ${lines.length} ids to targets.txt`)
