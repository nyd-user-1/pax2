// Metadata lift: which pre-publish traits — the ones visible in the API without downloading a
// video — go with a short being pushed past its channel's seed round. Every comparison is
// within a channel (its videos with the trait against its own without), then pooled across
// channels; no channel contributes more than CAP videos; ranges come from resampling channels.
// Reads data/velocity/catalog.json, writes data/velocity/metadata-lift.json.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIR = path.join(root, "data/velocity")
const CAP = 300
const DRAWS = 1000

const GROUP = {
  "reform-core": "Reform", reform: "Reform", "reform-opposition": "Reform",
  "voting-rights": "Voting rights",
  "media-nonpartisan": "Nonpartisan media", "independent-media": "Nonpartisan media",
  "official-D": "Candidates & officials", "official-R": "Candidates & officials", "candidate-D": "Candidates & officials", "candidate-R": "Candidates & officials", "candidate-independent": "Candidates & officials", "party-D": "Candidates & officials", "party-R": "Candidates & officials",
  "media-D": "Partisan media", "media-R": "Partisan media",
  uk: "UK",
}

const ANGER = /\b(lie|lies|lying|liar|corrupt|rigged|destroy|destroys|destroyed|slam|slams|outrage|outrageous|disgrace|disgraceful|furious|insane|crazy|shocking|unhinged|meltdown|scam|fraud|evil|traitor|disaster|pathetic|humiliat\w*|wrecks?|torch\w*|eviscerat\w*|explod\w*)\b/i
const CTA = /\b(subscribe|donate|chip in|sign (up|the|our)|join us|volunteer|register|vote (yes|no|for|early)|link in (bio|description)|learn more)\b/i
const etHour = (iso) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(iso))) % 24
const etDay = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(iso))
const words = (t) => t.replace(/#\w+/g, "").trim().split(/\s+/).filter(Boolean)

const FEATURES = [
  ["question", "Title asks a question", (v) => v.title.includes("?")],
  ["exclaim", "Exclamation mark in the title", (v) => v.title.includes("!")],
  ["number", "A number in the title", (v) => /\d/.test(v.title)],
  ["firstPerson", "First person in the title (I, my, I'm)", (v) => /\b(I|my|me|I'm|I've|I'll)\b/.test(v.title)],
  ["you", "Addresses the viewer (you, your)", (v) => /\b(you|your|you're)\b/i.test(v.title)],
  ["caps", "A word in ALL CAPS", (v) => words(v.title).some((w) => /^[A-Z]{4,}[!?.,]*$/.test(w))],
  ["anger", "Combative words in the title (lies, corrupt, slams…)", (v) => ANGER.test(v.title)],
  ["quote", "Quotation in the title", (v) => /["“”]/.test(v.title)],
  ["shortTitle", "Title of six words or fewer", (v) => words(v.title).length <= 6],
  ["longTitle", "Title of fifteen words or more", (v) => words(v.title).length >= 15],
  ["emoji", "Emoji in the title", (v) => /\p{Extended_Pictographic}/u.test(v.title)],
  ["hashtagTitle", "Hashtag in the title", (v) => /#\w/.test(v.title)],
  ["trump", "Names Trump", (v) => /\btrump\b/i.test(v.title)],
  ["under20", "20 seconds or shorter", (v) => v.durationSec > 0 && v.durationSec <= 20],
  ["under35", "35 seconds or shorter", (v) => v.durationSec > 0 && v.durationSec <= 35],
  ["over60", "Longer than a minute", (v) => v.durationSec > 60],
  ["weekend", "Posted on a weekend", (v) => ["Sat", "Sun"].includes(etDay(v.published))],
  ["morning", "Posted 6–11am Eastern", (v) => { const h = etHour(v.published); return h >= 6 && h < 12 }],
  ["evening", "Posted 6–11pm Eastern", (v) => { const h = etHour(v.published); return h >= 18 && h < 24 }],
  ["cta", "Call to action in the description", (v) => CTA.test(v.description)],
  ["link", "Link in the description", (v) => /https?:\/\//.test(v.description)],
  ["noDescription", "No description", (v) => v.description.trim().length === 0],
  ["tags", "Has tags", (v) => v.tags.length > 0],
]

const { videos } = JSON.parse(fs.readFileSync(path.join(DIR, "catalog.json"), "utf8"))
const pool = videos.filter((v) => v.tier !== "unsettled" && GROUP[v.group])
const byChannel = new Map()
for (const v of pool) byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v])
for (const [id, vs] of byChannel) byChannel.set(id, vs.sort((a, b) => b.published.localeCompare(a.published)).slice(0, CAP))

const pushed = (v) => (v.tier === "breakout" ? 1 : 0)
const mean = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length

// Seeded resampling so the ranges are stable run to run.
let seed = 20261006
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

function effect(channelIds, test) {
  const parts = []
  for (const id of channelIds) {
    const vs = byChannel.get(id) ?? []
    const a = vs.filter(test)
    const b = vs.filter((v) => !test(v))
    if (a.length < 3 || b.length < 3) continue
    parts.push({ d: mean(a.map(pushed)) - mean(b.map(pushed)), w: (2 * a.length * b.length) / (a.length + b.length), n: a.length, base: mean(b.map(pushed)) })
  }
  if (parts.length < 2) return null
  const wavg = (ps) => ps.reduce((t, p) => t + p.d * p.w, 0) / ps.reduce((t, p) => t + p.w, 0)
  const est = wavg(parts)
  const boots = []
  for (let i = 0; i < DRAWS; i++) boots.push(wavg(Array.from({ length: parts.length }, () => parts[Math.floor(rnd() * parts.length)])))
  boots.sort((x, y) => x - y)
  const r = (x) => Math.round(x * 1000) / 10
  return { points: r(est), low: r(boots[Math.floor(DRAWS * 0.05)]), high: r(boots[Math.floor(DRAWS * 0.95)]), channels: parts.length, videos: parts.reduce((t, p) => t + p.n, 0), basePushed: r(mean(parts.map((p) => p.base))) }
}

const groups = [...new Set(Object.values(GROUP))]
const channelsIn = (g) => [...byChannel.keys()].filter((id) => GROUP[byChannel.get(id)[0].group] === g)
const all = [...byChannel.keys()]
const rows = FEATURES.map(([key, label, test]) => ({
  key,
  label,
  prevalence: Math.round((pool.filter(test).length / pool.length) * 1000) / 10,
  all: effect(all, test),
  byGroup: Object.fromEntries(groups.map((g) => [g, effect(channelsIn(g), test)])),
}))

const out = {
  builtAt: new Date().toISOString(),
  method: `Within-channel difference in the share of shorts pushed (3x the channel median or more), percentage points; channels weighted by the balance of their with/without counts; at most ${CAP} recent shorts per channel; 90% ranges from ${DRAWS} resamples of channels.`,
  videos: [...byChannel.values()].reduce((t, vs) => t + vs.length, 0),
  channels: byChannel.size,
  pushedShare: Math.round(mean([...byChannel.values()].flat().map(pushed)) * 1000) / 10,
  rows,
}
fs.writeFileSync(path.join(DIR, "metadata-lift.json"), JSON.stringify(out, null, 1) + "\n")

const fmt = (e) => (e ? `${e.points >= 0 ? "+" : ""}${e.points} (${e.low} to ${e.high})` : "—")
console.log(`${out.videos} shorts, ${out.channels} channels, ${out.pushedShare}% pushed\n`)
console.log(["Trait", "Has it", "All channels", ...groups].join(" | "))
for (const r of [...rows].sort((a, b) => (b.all?.points ?? 0) - (a.all?.points ?? 0)))
  console.log([r.label, `${r.prevalence}%`, fmt(r.all), ...groups.map((g) => fmt(r.byGroup[g]))].join(" | "))
