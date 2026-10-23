/**
 * transcripts.mjs — the timed transcript lines of the videos in the partner's paid export, for the /paid
 * pages: data/generated/paid-transcripts.json. transcripts.json (147 MB, git-ignored, kept in S3) holds
 * YouTube's caption words with their start times; each line here closes at a sentence's end or after 14
 * words. A video whose captions failed carries its error instead of lines.
 *
 *   node scripts/paid/transcripts.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"

const paid = JSON.parse(readFileSync("data/generated/voter-freedom-paid.json", "utf8"))
const ids = [...new Set(paid.creatives.map((c) => c.videoId))]
const T = JSON.parse(readFileSync("data/generated/transcripts.json", "utf8"))
const out = {}
for (const id of ids) {
  const r = T[id]
  if (!r?.words?.length) {
    out[id] = { source: r?.source ?? null, lines: [], error: r?.error ?? "no transcript" }
    continue
  }
  const lines = []
  let cur = null
  for (const w of r.words) {
    if (!cur) cur = { t: w.t, text: [] }
    cur.text.push(w.w)
    if (/[.?!]["”']?$/.test(w.w) || cur.text.length >= 14) {
      lines.push({ t: Math.round(cur.t * 10) / 10, text: cur.text.join(" ") })
      cur = null
    }
  }
  if (cur) lines.push({ t: Math.round(cur.t * 10) / 10, text: cur.text.join(" ") })
  out[id] = { source: r.source, lines }
}
writeFileSync("data/generated/paid-transcripts.json", JSON.stringify(out))
console.log(`wrote data/generated/paid-transcripts.json: ${Object.values(out).filter((x) => x.lines.length).length} of ${ids.length} with lines`)
