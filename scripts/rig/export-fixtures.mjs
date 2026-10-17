// The TypeScript definitions the rig's Python must agree with (rule 15), exported as JSON beside the
// jobs before every launch, so the box never re-implements them:
//   families.json        GROUP_FAMILY from src/lib/video-features.ts
//   feature-defs.json    FEATURE_DEFS from the same file
//   poll-x.json          extract() for every video the velocity poller has metadata for (meta.json,
//                        then data/velocity/catalog.json), with the channel's group and baseline
//                        median, the description cut to 600 characters as the catalog cuts it
//   headline-fixture.json PATTERN_TESTS from src/lib/headline-patterns.ts applied to the Upworthy top
//                        headlines, the training set's titles and a few edge cases
// Usage: node --experimental-strip-types scripts/rig/export-fixtures.mjs <out dir> <meta.json> <baselines.json>
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { extract, FEATURE_DEFS, GROUP_FAMILY } from "../../src/lib/video-features.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const [out, metaPath, basePath] = process.argv.slice(2)
if (!out || !metaPath || !basePath) throw new Error("usage: export-fixtures.mjs <out dir> <meta.json> <baselines.json>")
fs.mkdirSync(out, { recursive: true })
const write = (name, obj) => fs.writeFileSync(path.join(out, name), JSON.stringify(obj))

write("families.json", GROUP_FAMILY)
write("feature-defs.json", FEATURE_DEFS)

const channels = JSON.parse(fs.readFileSync(path.join(root, "lambda/velocity/channels.json"), "utf8"))
const groupOf = Object.fromEntries(channels.map((c) => [c.id, c.group]))
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
const base = JSON.parse(fs.readFileSync(basePath, "utf8"))
const px = {}
for (const [id, m] of Object.entries(meta)) {
  if (!m) continue
  px[id] = extract({ title: m.title, description: (m.description ?? "").slice(0, 600), tags: m.tags ?? [], durationSec: m.durationSec, published: m.published, group: groupOf[m.channelId] ?? "", channelMedian: base[m.channelId]?.median ?? null })
}
// The catalog (data/velocity/catalog.json) carries every short of the last 18 months, unsettled ones
// included, so it fills in polled videos the poller's meta.json never backfilled.
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/velocity/catalog.json"), "utf8"))
let fromCatalog = 0
for (const v of catalog.videos) {
  if (px[v.id]) continue
  px[v.id] = extract({ title: v.title, description: v.description ?? "", tags: v.tags ?? [], durationSec: v.durationSec, published: v.published, group: v.group, channelMedian: base[v.channelId]?.median ?? v.channelMedian ?? null })
  fromCatalog++
}
console.log(`export-fixtures: x from meta.json for ${Object.keys(px).length - fromCatalog}, from the catalog for ${fromCatalog}`)
write("poll-x.json", px)

// headline-patterns.ts imports a JSON file plain Node cannot load; its PATTERN_TESTS block is taken
// from the source verbatim and evaluated on its own.
const src = fs.readFileSync(path.join(root, "src/lib/headline-patterns.ts"), "utf8")
const block = src.slice(src.indexOf("export const PATTERN_TESTS"), src.indexOf("/** A title read against"))
const tmp = path.join(out, "pattern-tests.ts")
fs.writeFileSync(tmp, block)
const { PATTERN_TESTS } = await import(pathToFileURL(tmp).href)
fs.rmSync(tmp)
const upworthy = JSON.parse(fs.readFileSync(path.join(root, "data/generated/upworthy-top.json"), "utf8")).rows.map((r) => r.h)
const titles = fs.readFileSync(path.join(root, "data/generated/model/training-set.jsonl"), "utf8").split("\n").filter(Boolean).filter((_, i) => i % 40 === 0).map((l) => JSON.parse(l).title)
const edge = ["This Is Why", "these kids", "What You're Missing", "you’re next", "I'm done… really", "My MOM said — no", "Watch: \"quoted\" here", "“Curly” quotes", "THE END", "AB CD", "Ünïcode ÉLAN", "a - b", "Me, myself and I", "Why?", "How 3 people", "listen up", "seeing is believing", "I’m here", "HOW-TO GUIDE"]
const fixture = [...upworthy, ...titles, ...edge].map((text) => ({ text, flags: Object.fromEntries(Object.entries(PATTERN_TESTS).map(([k, f]) => [k, f(text)])) }))
write("headline-fixture.json", fixture)
console.log(`export-fixtures: ${Object.keys(GROUP_FAMILY).length} groups, ${FEATURE_DEFS.length} feature defs, x for ${Object.keys(px).length} polled videos, headline fixture of ${fixture.length} texts -> ${out}`)
