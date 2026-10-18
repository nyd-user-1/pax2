// Transcripts without video files: YouTube's own captions for a list of shorts, read through
// youtubei.js from this machine (YouTube answers a home connection and blocks AWS). Network only,
// a few kilobytes a video, so it is the one YouTube job that runs on the Mac. Writes
// data/generated/transcripts.json as { "<youtube id>": { text, source, at } } and skips ids already
// there, so a rerun only fetches what is missing.
//
// Usage: node scripts/yt-transcripts.mjs [--ids a,b,c] [--from data/raw/voter-freedom.json] [--max 500]
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { Innertube } from "youtubei.js"

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const OUT = "data/generated/transcripts.json"
const max = Number(opt("--max", 500))
let ids = opt("--ids", "").split(",").filter(Boolean)
const from = opt("--from", ids.length ? "" : "data/raw/voter-freedom.json")
if (from) ids = JSON.parse(readFileSync(from, "utf8")).videos.map((v) => v.id)
const have = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
const todo = ids.filter((id) => !(id in have)).slice(0, max)
console.log(`${ids.length} ids, ${Object.keys(have).length} already held, ${todo.length} to fetch`)

const yt = await Innertube.create()
let got = 0
let none = 0
let failed = 0
for (const id of todo) {
  try {
    const info = await yt.getInfo(id)
    const t = await info.getTranscript()
    const segs = t?.transcript?.content?.body?.initial_segments ?? []
    const text = segs.map((s) => s.snippet?.text ?? "").join(" ").replace(/\s+/g, " ").trim()
    if (!text) {
      have[id] = { text: null, source: "youtube-captions", at: new Date().toISOString() }
      none++
    } else {
      have[id] = { text, source: "youtube-captions", at: new Date().toISOString() }
      got++
    }
  } catch (e) {
    have[id] = { text: null, source: "youtube-captions", at: new Date().toISOString(), error: String(e.message ?? e).slice(0, 120) }
    failed++
  }
  writeFileSync(OUT, JSON.stringify(have, null, 1))
  await new Promise((r) => setTimeout(r, 400))
}
console.log(`done: ${got} transcripts, ${none} without captions, ${failed} failed; ${Object.keys(have).length} held in ${OUT}`)
