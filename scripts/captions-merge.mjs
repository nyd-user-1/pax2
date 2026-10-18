// Fold data/raw/captions/*.en.json3 (yt-dlp auto-captions) into data/generated/transcripts.json as
// { "<youtube id>": { text, words: [{ t, w }], source: "youtube-captions", at } }, keeping any entry
// already there from another source. Usage: node scripts/captions-merge.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"

const DIR = "data/raw/captions"
const OUT = "data/generated/transcripts.json"
const have = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
let added = 0
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".en.json3"))) {
  const id = f.slice(0, -".en.json3".length)
  if (have[id]?.text) continue
  const j = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))
  const words = []
  for (const e of j.events ?? []) for (const s of e.segs ?? []) {
    const w = (s.utf8 ?? "").trim()
    if (w && w !== "\n") words.push({ t: Math.round(((e.tStartMs ?? 0) + (s.tOffsetMs ?? 0)) / 10) / 100, w })
  }
  const text = words.map((w) => w.w).join(" ").replace(/\s+/g, " ").trim()
  have[id] = { text: text || null, words: text ? words : [], source: "youtube-captions", at: new Date().toISOString() }
  added++
}
// Entries that failed earlier stay as they were unless a caption file now exists.
writeFileSync(OUT, JSON.stringify(have, null, 1))
const withText = Object.values(have).filter((v) => v.text).length
console.log(`${added} merged, ${withText} with text of ${Object.keys(have).length} in ${OUT}`)
