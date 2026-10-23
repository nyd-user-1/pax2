// The video page's Analytics: every metric in docs/HOUSE.html and docs/DATA-API.html that the platform
// holds, or derives from what it holds, for the 5,379 baseline shorts (data/raw/vqa/set.tsv). Per short:
// its value on each per-video metric and that value's percentile within its channel's baseline shorts;
// per channel: its channel-level figures (from the whole catalog) and its medians of the per-video
// metrics; across the baseline: each per-video metric's median.
//
// The transcript metrics, fixed rules: sentences end at . ! ? or …; a word is a run of letters or
// digits; the hook is the first sentence; question-led = the hook ends in "?"; first person = I, me,
// my, we, us or our in the first two sentences; a concrete number = a digit or a number word; an
// explicit ask = vote, sign, share, subscribe, follow, donate, call, join, register, text, visit, tell,
// click or comment in the last two sentences; repetition = a three-word phrase, not all common words,
// said twice or more. The expected-views residual: actual over expected views, expected from a least-
// squares fit of log views on log channel median and log days since publish, across the baseline.
//
// Writes data/generated/analytics.json (read at request time through src/lib/generated-store.ts; run
// node scripts/upload-generated.mjs after rebuilding).
//   node scripts/analytics/build.mjs

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const ids = fs.readFileSync(path.join(root, "data/raw/vqa/set.tsv"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0])
const all = read("data/velocity/catalog.json").videos
const cat = new Map(all.map((v) => [v.id, v]))
const subs = read("data/generated/channel-subscribers.json")
const transcripts = read("data/generated/transcripts.json")
const comp = read("data/generated/model/composition.json").shorts
const scores = read("data/generated/model/resonance-formula.json").scores ?? {}
const topicOf = read("data/generated/video-reads.json").topic ?? {}
const topicLift = new Map(read("data/generated/model/topic-lift.json").topics.map((t) => [t.id, t.lift]))
const globalMedian = read("data/generated/war-baseline.json").median
const NOW = Date.now()

const r = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d)
const median = (xs) => {
  const s = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const days = (iso) => Math.max(1, (NOW - Date.parse(iso)) / 86_400_000)

// ---------- the transcript rules
const COMMON = new Set("the a an and or but of to in on at for is it this that with as be are was were by from we you i they he she our my your their its not so do have has".split(" "))
const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent|half|third|thirds|quarter|dozen)\b/i
const ASK = /\b(vote|sign|share|subscribe|follow|donate|call|join|register|text|visit|tell|click|comment)\b/i
const FIRST_PERSON = /\b(i|i'm|i've|i'd|i'll|me|my|we|we're|we've|us|our)\b/i
function transcriptMetrics(text) {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return null
  const sentences = t.split(/(?<=[.!?…])\s+/).filter((s) => /[\p{L}\p{N}]/u.test(s))
  const words = t.match(/[\p{L}\p{N}']+/gu) ?? []
  const wordsOf = (s) => s.match(/[\p{L}\p{N}']+/gu) ?? []
  const hook = sentences[0] ?? ""
  const opening = sentences.slice(0, 2).join(" ")
  const closing = sentences.slice(-2).join(" ")
  const low = words.map((w) => w.toLowerCase())
  const seen = new Map()
  for (let i = 0; i + 2 < low.length; i++) {
    const g = low.slice(i, i + 3)
    if (g.every((w) => COMMON.has(w))) continue
    const k = g.join(" ")
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    meanSentenceLength: sentences.length ? words.length / sentences.length : null,
    hookWordCount: wordsOf(hook).length,
    questionLed: /\?\s*$/.test(hook) ? 1 : 0,
    firstPerson: FIRST_PERSON.test(opening) ? 1 : 0,
    concreteNumber: /\d/.test(t) || NUMBER_WORDS.test(t) ? 1 : 0,
    explicitAsk: ASK.test(closing) ? 1 : 0,
    repetition: [...seen.values()].some((n) => n >= 2) ? 1 : 0,
  }
}
const TITLE_FIRST_PERSON = /\b(i|i'm|me|my|we|we're|us|our)\b/i

// ---------- the expected-views fit: log10 views ~ a + b log10 median + c log10 days
const fitRows = ids.map((id) => cat.get(id)).filter((v) => v && v.views > 0 && v.channelMedian > 0)
function ols(rows) {
  // normal equations for three coefficients
  const X = rows.map((v) => [1, Math.log10(v.channelMedian), Math.log10(days(v.published))])
  const y = rows.map((v) => Math.log10(v.views))
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + x[i] * x[j], 0)))
  const b = [0, 1, 2].map((i) => X.reduce((s, x, k) => s + x[i] * y[k], 0))
  // Gaussian elimination
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k
    ;[A[i], A[p]] = [A[p], A[i]]
    ;[b[i], b[p]] = [b[p], b[i]]
    for (let k = i + 1; k < 3; k++) {
      const f = A[k][i] / A[i][i]
      for (let j = i; j < 3; j++) A[k][j] -= f * A[i][j]
      b[k] -= f * b[i]
    }
  }
  const w = [0, 0, 0]
  for (let i = 2; i >= 0; i--) w[i] = (b[i] - [0, 1, 2].slice(i + 1).reduce((s, j) => s + A[i][j] * w[j], 0)) / A[i][i]
  return w
}
const W = ols(fitRows)
const expected = (v) => 10 ** (W[0] + W[1] * Math.log10(v.channelMedian) + W[2] * Math.log10(days(v.published)))

// ---------- the channel-level figures, from the whole catalog
const byChannel = new Map()
for (const v of all) byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v])
const channelLevel = (ch) => {
  const vs = byChannel.get(ch) ?? []
  const settled = vs.filter((v) => v.tier !== "unsettled")
  const times = vs.map((v) => Date.parse(v.published)).filter(Number.isFinite)
  const weeks = times.length > 1 ? Math.max(1, (Math.max(...times) - Math.min(...times)) / (7 * 86_400_000)) : 1
  return {
    subscribers: subs[ch] ?? null,
    channelMedian: median(vs.map((v) => v.channelMedian)),
    channelViewsPerVideo: vs.length ? vs.reduce((s, v) => s + (v.views ?? 0), 0) / vs.length : null,
    uploadsPerWeek: vs.length / weeks,
    shareOver3x: settled.length ? settled.filter((v) => (v.ratio ?? 0) >= 3).length / settled.length : null,
    settledShare: vs.length ? settled.length / vs.length : null,
    channelMedianLength: median(vs.map((v) => v.durationSec)),
    shorts: vs.length,
  }
}

// ---------- per short
const VIDEO = ["views", "likes", "comments", "likeRate", "commentRate", "engagementRate", "commentsPerLike", "viewsPerDay", "outlierScore", "war", "residual", "viewsPerSubscriber", "durationSec", "titleWords", "wordCount", "sentenceCount", "meanSentenceLength", "hookWordCount", "wpm", "firstCutSec", "firstWordSec", "textFrameShare", "hitProbability", "titleWinPercentile", "neighborhoodLift"]
const FLAGS = ["titleQuestion", "titleNumber", "titleFirstPerson", "questionLed", "firstPerson", "concreteNumber", "explicitAsk", "repetition"]

const rows = {}
for (const id of ids) {
  const v = cat.get(id)
  if (!v) continue
  const c = comp[id] ?? {}
  const tm = transcriptMetrics(transcripts[id]?.text)
  const s = scores[id] ?? {}
  const sub = subs[v.channelId] ?? null
  const likes = v.likes ?? null
  const comments = v.comments ?? null
  const views = v.views ?? null
  const value = {
    views,
    likes,
    comments,
    likeRate: likes != null && views ? likes / views : null,
    commentRate: comments != null && views ? comments / views : null,
    engagementRate: likes != null && comments != null && views ? (likes + comments) / views : null,
    commentsPerLike: likes ? (comments ?? 0) / likes : null,
    viewsPerDay: views != null ? views / days(v.published) : null,
    outlierScore: v.ratio ?? null,
    war: views != null ? views / globalMedian : null,
    residual: views > 0 && v.channelMedian > 0 ? views / expected(v) : null,
    viewsPerSubscriber: views != null && sub ? views / sub : null,
    durationSec: v.durationSec ?? null,
    titleWords: c.titleWords ?? null,
    wordCount: tm?.wordCount ?? null,
    sentenceCount: tm?.sentenceCount ?? null,
    meanSentenceLength: tm?.meanSentenceLength ?? null,
    hookWordCount: tm?.hookWordCount ?? null,
    wpm: tm && v.durationSec ? (tm.wordCount / v.durationSec) * 60 : null,
    firstCutSec: c.firstCutSec ?? null,
    firstWordSec: c.firstWordSec ?? null,
    textFrameShare: c.textFrameShare ?? null,
    hitProbability: s.p ?? null,
    titleWinPercentile: s.h ?? null,
    neighborhoodLift: topicOf[id] != null ? (topicLift.get(topicOf[id]) ?? null) : null,
    titleQuestion: c.titleQuestion ?? null,
    titleNumber: c.titleNumber ?? null,
    titleFirstPerson: TITLE_FIRST_PERSON.test(v.title ?? "") ? 1 : 0,
    questionLed: tm?.questionLed ?? null,
    firstPerson: tm?.firstPerson ?? null,
    concreteNumber: tm?.concreteNumber ?? null,
    explicitAsk: tm?.explicitAsk ?? null,
    repetition: tm?.repetition ?? null,
  }
  rows[id] = { ch: v.channelId, value }
}

// ---------- percentiles within channel, channel medians, baseline medians
const pctAmong = (xs, x) => {
  const s = xs.filter((y) => y != null && Number.isFinite(y))
  if (x == null || !s.length) return null
  const below = s.filter((y) => y < x).length
  const equal = s.filter((y) => y === x).length
  return (100 * (below + equal / 2)) / s.length
}
const members = new Map()
for (const [id, row] of Object.entries(rows)) members.set(row.ch, [...(members.get(row.ch) ?? []), id])

/** The share of shorts carrying a yes/no metric, of those with an answer. */
const share = (xs) => {
  const s = xs.filter((x) => x != null)
  return s.length ? s.filter((x) => x === 1).length / s.length : null
}
const channels = {}
for (const [ch, list] of members) {
  channels[ch] = {
    level: Object.fromEntries(Object.entries(channelLevel(ch)).map(([k, x]) => [k, r(x, 4)])),
    medians: Object.fromEntries(VIDEO.map((k) => [k, r(median(list.map((id) => rows[id].value[k])), 4)])),
    flags: Object.fromEntries(FLAGS.map((k) => [k, r(share(list.map((id) => rows[id].value[k])), 4)])),
  }
}
const baseline = Object.fromEntries(VIDEO.map((k) => [k, r(median(Object.values(rows).map((row) => row.value[k])), 4)]))
const baselineFlags = Object.fromEntries(FLAGS.map((k) => [k, r(share(Object.values(rows).map((row) => row.value[k])), 4)]))
const baselineLevel = Object.fromEntries(Object.keys(channelLevel(all[0].channelId)).map((k) => [k, r(median([...members.keys()].map((ch) => channels[ch].level[k])), 4)]))

const out = {}
for (const [id, row] of Object.entries(rows)) {
  const peers = members.get(row.ch)
  out[id] = {
    ch: row.ch,
    v: [...VIDEO, ...FLAGS].map((k) => r(row.value[k], 4)),
    p: VIDEO.map((k) => r(pctAmong(peers.map((pid) => rows[pid].value[k]), row.value[k]), 1)),
  }
}

const doc = {
  builtAt: new Date().toISOString(),
  shorts: Object.keys(out).length,
  video: VIDEO,
  flags: FLAGS,
  residualFit: { intercept: r(W[0], 4), logMedian: r(W[1], 4), logDays: r(W[2], 4), rows: fitRows.length },
  baseline,
  baselineFlags,
  baselineLevel,
  channels,
  rows: out,
}
fs.writeFileSync(path.join(root, "data/generated/analytics.json"), JSON.stringify(doc))
const cover = (k) => Object.values(rows).filter((row) => row.value[k] != null).length
console.log(JSON.stringify({ shorts: doc.shorts, residualFit: doc.residualFit, coverage: Object.fromEntries([...VIDEO, ...FLAGS].map((k) => [k, cover(k)])) }, null, 1))
