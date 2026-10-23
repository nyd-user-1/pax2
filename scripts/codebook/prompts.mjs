// Codebook 5K, the prompts (docs/briefs/CODEBOOK-5K.md). One line per video to data/raw/codebook/prompts.jsonl:
// {id, a, b} — a is Swayable's coder prompt, the template in src/lib/evaluate.ts prompt(o) copied verbatim,
// filled with the video's title, its length in seconds and its transcript as the script (no messenger
// is on record for a catalog short, so that line reads "(not given)"); b is the Wesleyan prompt below.
// The box (codebook.py) and the Bedrock cross-check (bedrock.mjs) both read this file, so the two coders
// see identical text.
//   node scripts/codebook/prompts.mjs            the baseline set, data/raw/vqa/set.tsv
//   SET=all node scripts/codebook/prompts.mjs    every transcribed short (the stretch)
// Also writes data/raw/codebook/verify-ids.txt (the 20) on first run: the set's hand-labeled video(s)
// plus a seeded draw of the rest, one per channel.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const OUT = path.join(root, "data/raw/codebook")
fs.mkdirSync(OUT, { recursive: true })

const TRAITS = read("data/generated/swayable-patterns.json").traits
const transcripts = read("data/generated/transcripts.json")
const feed = new Map(read("data/generated/feed-index.json").map((v) => [v.id, v]))
const secs = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0 }

// src/lib/evaluate.ts prompt(o), verbatim.
function promptA(o) {
  return `You are coding a short political video for PAX2. Below is the script its messenger recorded${o.title ? `, titled "${o.title}"` : ""}${o.seconds ? `, ${o.seconds} seconds long` : ""}.

SCRIPT:
${o.text ?? "(no script given)"}

MESSENGER: ${[o.name, o.role, o.town].filter(Boolean).join(", ") || "(not given)"}

For each trait below, decide whether the video carries it (present: true only when the script clearly shows it) and quote the shortest line that shows it. Then, for every trait, write "change": one concrete sentence telling the messenger how to add the trait if it is absent or drop it if it is present, in this script's own terms (name the line to cut or write the new line). Keep it plain; no jargon.

TRAITS (key: meaning):
${TRAITS.map((t) => `${t.key}: ${t.label}`).join("\n")}

Also write "summary": two plain sentences on what the video says and how. And "title": a better short title for the video, under 70 characters.

Reply with JSON only: {"summary": "...", "title": "...", "traits": [{"key": "...", "present": true, "quote": "...", "change": "..."}]}`
}

// Wesleyan Media Project's 2022 Meta codebook, the three columns the glossary names (src/lib/glossary.ts, id wesleyan).
// v2, after the first 20: "persuade" covers criticizing the other side, tone is one of the three, and party is
// the side favored, not the side named (v1 had the open model coding the party a video attacked).
function promptB(o) {
  return `You are coding a short political video on the Wesleyan Media Project's codebook for political ads. Below is the video's title and the transcript of what is said in it.

TITLE: ${o.title || "(no title)"}

TRANSCRIPT:
${o.text}

Code three columns from what the video says:
goal: "persuade" when it takes a side on any candidate, official, party, policy or political issue — arguing for it, praising it, or criticizing the other side; "money" when it asks viewers to donate; "both" when it does both; "neither" only when it takes no side at all (straight news, or entertainment with no political point).
tone: exactly one of three. "promote" when it speaks only of the side it favors, positively; "attack" when it speaks only of an opposing candidate, party or side, negatively; "contrast" when it does both.
party: the party the video is on the side of, which is not the party it criticizes: a video attacking Republicans favors the Democratic side, and one attacking Democrats or "the Left" favors the Republican side. "Democratic", "Republican", or "neither" when it takes no partisan side.

Reply with JSON only: {"goal": "...", "tone": "...", "party": "..."}`
}

let ids
if (process.env.SET === "all") ids = Object.keys(transcripts).filter((id) => transcripts[id]?.text)
else ids = fs.readFileSync(path.join(root, "data/raw/vqa/set.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")[0])
const rows = []
const skipped = []
for (const id of ids) {
  const text = transcripts[id]?.text?.trim()
  if (!text) { skipped.push(id); continue }
  const v = feed.get(id)
  const o = { title: v?.title?.trim() || "", seconds: secs(v?.duration) || undefined, text }
  rows.push({ id, a: promptA(o), b: promptB(o) })
}
const name = process.env.SET === "all" ? "prompts-all.jsonl" : "prompts.jsonl"
fs.writeFileSync(path.join(OUT, name), rows.map((r) => JSON.stringify(r)).join("\n") + "\n")
console.log(`${rows.length} prompts to data/raw/codebook/${name}; no transcript: ${skipped.length}${skipped.length && skipped.length < 10 ? ` (${skipped.join(", ")})` : ""}`)

const VERIFY = path.join(OUT, "verify-ids.txt")
if (process.env.SET !== "all" && !fs.existsSync(VERIFY)) {
  const hand = ["mV0zO4WIWWc", "5LHXjjQW0ug"].filter((id) => rows.some((r) => r.id === id))
  // Seeded draw (mulberry32), one video per channel.
  let s = 20261022
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const chan = new Map(fs.readFileSync(path.join(root, "data/raw/vqa/set.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")))
  const pool = rows.map((r) => r.id).filter((id) => !hand.includes(id)).map((id) => [rnd(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
  const pick = [...hand], seen = new Set(hand.map((id) => chan.get(id)))
  for (const id of pool) { if (pick.length >= 20) break; if (seen.has(chan.get(id))) continue; seen.add(chan.get(id)); pick.push(id) }
  fs.writeFileSync(VERIFY, pick.join("\n") + "\n")
  console.log(`verify ids: ${pick.length} (hand-labeled: ${hand.join(", ") || "none"})`)
}
