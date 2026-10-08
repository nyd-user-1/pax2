// The ecosystem baseline for WAR: every tracked short's views across all followed channels.
// Usage: node scripts/war-baseline.mjs   (reads data/velocity/catalog.json, the poller's catalog)
// Writes data/generated/war-baseline.json. iWAR divides a video's views by its own channel's median;
// WAR divides them by this one median of every channel's shorts together.
import { readFileSync, writeFileSync } from "node:fs"

const cat = JSON.parse(readFileSync(new URL("../data/velocity/catalog.json", import.meta.url), "utf8"))
const views = cat.videos.map((v) => v.views).filter((x) => x != null).sort((a, b) => a - b)
const at = (p) => views[Math.floor(p * (views.length - 1))]
const out = { asOf: cat.fetchedAt, shorts: views.length, channels: new Set(cat.videos.map((v) => v.channelId)).size, median: at(0.5), p20: at(0.2) }
writeFileSync(new URL("../data/generated/war-baseline.json", import.meta.url), JSON.stringify(out, null, 1) + "\n")
console.log(out)
