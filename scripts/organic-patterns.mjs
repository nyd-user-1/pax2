// What the shorts that beat their channel's median share — codes, hooks, pace and length,
// above-median vs below-median on the Organic scale (views/day over channel median,
// ranked across all tracked shorts). Forty videos: pattern-reading, not proof.
// Usage: node scripts/organic-patterns.mjs
// Output: data/generated/organic-patterns.json

import { readFileSync, writeFileSync } from "node:fs"

const shorts = JSON.parse(readFileSync("data/raw/yt-shorts.json", "utf8"))
const features = JSON.parse(readFileSync("data/generated/features.json", "utf8"))
const codes = JSON.parse(readFileSync("data/generated/model/organic-codes.json", "utf8")).scripts

const asOf = shorts.fetchedAt.slice(0, 10)
const perDay = (v) => v.views / Math.max(1, (Date.parse(asOf) - Date.parse(v.published)) / 864e5)
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

const byChannel = {}
for (const v of shorts.videos) if (v.views != null) (byChannel[v.channelId] = byChannel[v.channelId] ?? []).push(v)
const chMedian = Object.fromEntries(Object.entries(byChannel).map(([c, vs]) => [c, median(vs.map(perDay))]))
const ratios = shorts.videos.filter((v) => v.views != null && chMedian[v.channelId] > 0).map((v) => perDay(v) / chMedian[v.channelId])

const rows = []
for (const v of shorts.videos) {
  const id = `yt-${v.id}`
  const f = features[id]
  const c = codes[id]
  if (!f || !c?.codes || v.views == null) continue
  const mine = perDay(v) / chMedian[v.channelId]
  const organic = Math.round((100 * (ratios.filter((r) => r < mine).length + 0.5 * ratios.filter((r) => r === mine).length)) / ratios.length)
  const firstSentence = (f.transcript?.text ?? "").match(/[^.!?]+[.!?]/)?.[0] ?? ""
  rows.push({
    id,
    channel: v.channel,
    title: v.title,
    organic,
    codes: c.codes,
    prior: c.prior?.votechoice?.expected ?? null,
    question: firstSentence.trim().endsWith("?"),
    wpm: f.transcript?.wpm ?? null,
    durationSec: f.audio?.durationSec ?? null,
  })
}

// The batch is already each channel's top 10 by views, so nearly every row beats its
// channel median; the split that discriminates inside this set is its own middle.
const setMedian = median(rows.map((r) => r.organic))
const above = rows.filter((r) => r.organic >= setMedian)
const below = rows.filter((r) => r.organic < setMedian)
const share = (xs, f) => (xs.length ? Math.round((100 * xs.filter(f).length) / xs.length) : null)
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null)

const CODE_PATTERNS = [
  ["explicit_vote_for", "Asks for something outright"],
  ["narration_personal_story", "Personal story"],
  ["technique_plain_folks", "Plain-folks delivery"],
  ["messenger_every_people", "Everyday messenger"],
  ["messenger_politician", "Politician on screen"],
  ["narration_explain_facts", "Explains facts"],
  ["fact_new_yes", "Offers an unfamiliar fact"],
  ["fact_cite_yes", "Cites a source"],
  ["emotion_anger", "Anger"],
  ["emotion_humor", "Humor"],
  ["tone_negative", "Negative tone"],
  ["tone_contrast", "Contrast"],
  ["style_text_on_screen", "Text on screen"],
  ["how_scripted", "Sounds scripted"],
  ["production_value_high", "High production value"],
]

const patterns = CODE_PATTERNS.map(([key, label]) => ({
  key,
  label,
  above: share(above, (r) => (r.codes[key] ?? 0) >= 0.5),
  below: share(below, (r) => (r.codes[key] ?? 0) >= 0.5),
}))
patterns.push({ key: "question_hook", label: "Opens with a question", above: share(above, (r) => r.question), below: share(below, (r) => r.question) })

const out = {
  built: new Date().toISOString().slice(0, 10),
  method: "Forty top shorts from five reform channels; split at the set's own median Organic score, since every pick already beats its channel. Codes from transcript + video review, threshold 0.5.",
  counts: { above: above.length, below: below.length },
  means: {
    wpm: { above: mean(above.map((r) => r.wpm).filter(Boolean)), below: mean(below.map((r) => r.wpm).filter(Boolean)) },
    durationSec: { above: mean(above.map((r) => r.durationSec).filter(Boolean)), below: mean(below.map((r) => r.durationSec).filter(Boolean)) },
    votechoicePrior: { above: mean(above.map((r) => r.prior).filter((x) => x != null)), below: mean(below.map((r) => r.prior).filter((x) => x != null)) },
  },
  patterns,
  rows: rows.sort((a, b) => b.organic - a.organic).map(({ codes: _c, ...r }) => r),
}
writeFileSync("data/generated/organic-patterns.json", JSON.stringify(out, null, 1))
console.log(`${rows.length} coded shorts | above ${above.length}, below ${below.length}`)
for (const p of out.patterns) console.log(`${p.label}: above ${p.above}% vs below ${p.below}%`)
console.log("wpm", JSON.stringify(out.means.wpm), "| duration", JSON.stringify(out.means.durationSec), "| prior", JSON.stringify(out.means.votechoicePrior))
