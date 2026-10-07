import deliveryJson from "../../data/generated/delivery.json"
import featuresJson from "../../data/generated/features.json"
import shortsJson from "../../data/raw/yt-shorts.json"
import { CHANNELS } from "@/lib/channels"

// The lab: what the seed round's public traces support. A channel's catalog is
// a record of repeated explore-phase experiments on roughly the same audience;
// views normalized by the channel's own median expose which videos the
// algorithm pushed and which it killed. Everything here is computed from data
// already in the repo — the one exception is the velocity curves, which are
// stand-ins until the poller runs (and say so).

type RawVideo = { id: string; channelId: string; channel: string; title: string; views?: number; likes?: number; comments?: number; duration: string; published: string }
type Feat = {
  audio?: { durationSec?: number; loudnessDb?: number[]; pitchRangeHz?: [number, number]; pauses?: { t: number; sec: number }[] }
  transcript?: { text?: string; wpm?: number; firstWordSec?: number; words?: { t: number; w: string }[] }
  pegasus?: { result?: { hook?: { text?: string }; characteristics?: Record<string, string> } }
}

type Delivery = {
  energy?: string
  vocalTone?: string[]
  mode?: string
  frame?: string
  firstPerson?: boolean
  questionLed?: boolean
  sarcasm?: { present?: boolean; cue?: string }
  music?: boolean | null
}

const VIDEOS = (shortsJson as unknown as { videos: RawVideo[] }).videos
const FEATS = featuresJson as unknown as Record<string, Feat>
const DELIVERY = (deliveryJson as unknown as { videos: Record<string, Delivery> }).videos

export const durationSec = (iso: string) => {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  return Number(m?.[1] ?? 0) * 60 + Number(m?.[2] ?? 0)
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

// ── breakout: the seed verdict read off the catalog ─────────────────────────

export type Tier = "breakout" | "baseline" | "killed"

/** Passed the gate at 3x the channel's own median; killed below half of it.
 *  Normalizing by channel cancels subscriber count and seed-audience size. */
export const tierOf = (ratio: number): Tier => (ratio >= 3 ? "breakout" : ratio <= 0.5 ? "killed" : "baseline")

export type LabVideo = {
  id: string
  title: string
  channelId: string
  channel: string
  views: number
  likes: number
  comments: number
  published: string
  durationSec: number
  channelMedian: number
  ratio: number
  tier: Tier
  analyzed: boolean
}

export function channelMedians(): Record<string, number> {
  const by: Record<string, number[]> = {}
  for (const v of VIDEOS) (by[v.channelId] ??= []).push(v.views ?? 0)
  return Object.fromEntries(Object.entries(by).map(([k, xs]) => [k, median(xs)]))
}

export function labVideos(): LabVideo[] {
  const med = channelMedians()
  return VIDEOS.map((v) => {
    const m = med[v.channelId] || 1
    const ratio = (v.views ?? 0) / m
    return {
      id: v.id,
      title: v.title.replace(/\s*#\w+/g, "").trim() || v.title,
      channelId: v.channelId,
      channel: v.channel,
      views: v.views ?? 0,
      likes: v.likes ?? 0,
      comments: v.comments ?? 0,
      published: v.published,
      durationSec: durationSec(v.duration),
      channelMedian: m,
      ratio,
      tier: tierOf(ratio),
      analyzed: `yt-${v.id}` in FEATS,
    }
  }).sort((a, b) => b.ratio - a.ratio)
}

export type ChannelSummary = { id: string; name: string; code: string; n: number; median: number; breakouts: number; killed: number; top: LabVideo }

export function channelSummaries(): ChannelSummary[] {
  const vids = labVideos()
  return CHANNELS.map((c) => {
    const xs = vids.filter((v) => v.channelId === c.id)
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      n: xs.length,
      median: xs[0]?.channelMedian ?? 0,
      breakouts: xs.filter((v) => v.tier === "breakout").length,
      killed: xs.filter((v) => v.tier === "killed").length,
      top: xs[0],
    }
  }).filter((c) => c.n > 0)
}

// ── feature lift: what the seed survivors share ─────────────────────────────

export type LiftRow = {
  key: string
  label: string
  /** Share of breakout videos carrying the feature, 0..1. */
  breakout: number
  /** Share of everything else carrying it. */
  rest: number
  /** Smoothed ratio of the two. */
  lift: number
  present: number
}

type Coded = { tier: Tier; flags: Record<string, boolean> }

const FEATURE_DEFS: { key: string; label: string }[] = [
  { key: "fastStart", label: "First word inside half a second" },
  { key: "fastPace", label: "180+ words a minute" },
  { key: "captions", label: "On-screen captions" },
  { key: "cta", label: "Ends on a call to action" },
  { key: "under35", label: "35 seconds or shorter" },
  { key: "dynamic", label: "Loudness swings 15 dB or more" },
  { key: "breathless", label: "Three or fewer pauses" },
  { key: "question", label: "Hook or title asks a question" },
  { key: "numbered", label: "A number in the title" },
  { key: "highEnergy", label: "High-energy delivery" },
  { key: "toCamera", label: "Speaks straight to camera" },
  { key: "wry", label: "Wry, sarcastic or playful register" },
  { key: "firstPerson", label: "First-person voice" },
]

function codeOne(v: LabVideo): Coded | null {
  const f = FEATS[`yt-${v.id}`]
  if (!f) return null
  const raw = VIDEOS.find((x) => x.id === v.id)
  const d = DELIVERY[`yt-${v.id}`]
  const loud = f.audio?.loudnessDb ?? []
  const chars = f.pegasus?.result?.characteristics ?? {}
  const hook = f.pegasus?.result?.hook?.text ?? ""
  const flags: Record<string, boolean> = {
    fastStart: (f.transcript?.firstWordSec ?? 9) <= 0.5,
    fastPace: (f.transcript?.wpm ?? 0) >= 180,
    captions: /^yes/i.test(chars.captions ?? ""),
    cta: /^yes/i.test(chars.call_to_action ?? ""),
    under35: v.durationSec > 0 && v.durationSec <= 35,
    dynamic: loud.length > 1 && Math.max(...loud) - Math.min(...loud) >= 15,
    breathless: (f.audio?.pauses?.length ?? 99) <= 3,
    question: hook.includes("?") || (raw?.title ?? "").includes("?"),
    numbered: /\d/.test(raw?.title ?? ""),
    highEnergy: d?.energy === "high",
    toCamera: d?.mode === "to-camera",
    wry: d?.sarcasm?.present === true,
    firstPerson: d?.firstPerson === true,
  }
  return { tier: v.tier, flags }
}

export function featureLift(): { rows: LiftRow[]; analyzed: number; breakouts: number; killed: number } {
  const coded = labVideos().map(codeOne).filter((x): x is Coded => x !== null)
  const b = coded.filter((c) => c.tier === "breakout")
  const rest = coded.filter((c) => c.tier !== "breakout")
  const rows = FEATURE_DEFS.map(({ key, label }) => {
    const nb = b.filter((c) => c.flags[key]).length
    const nr = rest.filter((c) => c.flags[key]).length
    const sb = b.length ? nb / b.length : 0
    const sr = rest.length ? nr / rest.length : 0
    // Half-count smoothing so one video in a tiny group cannot mint infinity.
    const lift = (nb + 0.5) / (b.length + 1) / ((nr + 0.5) / (rest.length + 1))
    return { key, label, breakout: sb, rest: sr, lift, present: nb + nr }
  }).sort((a, b2) => b2.lift - a.lift)
  return { rows, analyzed: coded.length, breakouts: b.length, killed: coded.filter((c) => c.tier === "killed").length }
}

// ── velocity: the explore phase, hour by hour ───────────────────────────────
// STAND-IN until the poller runs. Each curve is synthesized deterministically
// from the video's real final count and verdict; the terminal views are real.

export type VelocityCard = {
  id: string
  title: string
  channel: string
  views: number
  tier: Tier
  /** Cumulative views at each hour, 0..72. */
  points: number[]
  /** The hour the exploit push visibly begins, when it does. */
  inflection: number | null
  /** Hours since publish, on a curve built from real polls; absent on stand-ins. */
  hours?: number
  /** First observed hour on a real curve; earlier entries are placeholders and are not drawn. */
  start?: number
  /** The real readings as [hours since publish, views], drawn as observed; absent on stand-ins. */
  series?: [number, number][]
}

export type PollRow = { at: string; id: string; channelId: string; channel: string; title: string; published: string; hour: number; views: number }

/** Real curves from the poller's rows: views at each whole hour since publish, the last
 *  known count carried forward, ending where the polling has reached. */
export function polledCards(rows: PollRow[], baselines: Record<string, { median: number | null }> = {}): VelocityCard[] {
  const med: Record<string, number> = { ...channelMedians() }
  for (const [id, b] of Object.entries(baselines)) if (b.median) med[id] = b.median
  const by = new Map<string, PollRow[]>()
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r])
  return [...by.values()]
    .map((rs) => {
      const sorted = rs.sort((a, b) => a.hour - b.hour)
      const last = sorted.at(-1)!
      const start = Math.ceil(sorted[0].hour)
      const end = Math.min(72, Math.floor(last.hour))
      // Hours before the first poll were never observed; they stay out of the curve rather than being guessed.
      const points: number[] = Array(start).fill(0)
      for (let h = start; h <= end; h++) points.push(sorted.filter((r) => r.hour <= h).at(-1)?.views ?? sorted[0].views)
      const series = sorted.filter((r) => r.hour <= 72).map((r) => [r.hour, r.views] as [number, number])
      return { id: last.id, title: last.title.replace(/\s*#\w+/g, "").trim() || last.title, channel: last.channel, views: last.views, tier: tierOf(last.views / (med[last.channelId] || 1)), points, start, series, inflection: null, hours: last.hour }
    })
    .filter((c) => c.start <= 6 && c.points.length - 1 - c.start >= 6)
    .sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))
}

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const prng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

/** A stand-in curve for one catalog video, shaped by its real verdict and final count. */
export function standInCard(v: LabVideo): VelocityCard {
  const rnd = prng(seedOf(v.id))
  const points: number[] = [0]
  let inflection: number | null = null
  if (v.tier === "breakout") {
    const h0 = Math.round(8 + rnd() * 14)
    inflection = h0
    const end = v.views * (0.5 + rnd() * 0.2)
    const base = end * 0.06
    for (let h = 1; h <= 72; h++) {
      if (h <= h0) points.push((base * h) / h0)
      else {
        const x = (h - h0) / (72 - h0)
        points.push(base + (end - base) * (1 / (1 + Math.exp(-7 * (x - 0.45)))))
      }
    }
  } else {
    // Explore served its small audience and stopped: fast early climb, flat after.
    const end = v.views * (v.tier === "killed" ? 0.9 : 0.75)
    const k = v.tier === "killed" ? 10 : 20
    for (let h = 1; h <= 72; h++) points.push(end * (1 - Math.exp(-h / k)))
  }
  return { id: v.id, title: v.title, channel: v.channel, views: v.views, tier: v.tier, points: points.map(Math.round), inflection }
}

export function velocityCards(limit = 12): VelocityCard[] {
  return [...labVideos()].sort((a, b) => b.published.localeCompare(a.published)).slice(0, limit).map(standInCard)
}

// ── endgame: the organic telemetry a connected channel hands over ───────────
// STAND-IN shaped like the YouTube Analytics API response for one real video.

export type EndgameSample = {
  id: string
  title: string
  channel: string
  views: number
  retention: number[]
  viewedVsSwiped: number
  avgPctViewed: number
  likesPer1k: number
  commentsPer1k: number
  sharesPer1k: number
}

export function endgameSample(): EndgameSample {
  const v = labVideos().find((x) => x.channel.toLowerCase().includes("fairvote")) ?? labVideos()[0]
  const rnd = prng(seedOf(v.id))
  const retention: number[] = []
  const n = 30
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // The hook drop in the first tenth, then a slow taper with a small loop bump.
    const hook = t < 0.1 ? 100 - 220 * t : 78 - 36 * ((t - 0.1) / 0.9)
    retention.push(Math.round(hook + (t > 0.93 ? 6 : 0) + rnd() * 1.5))
  }
  return {
    id: v.id,
    title: v.title,
    channel: v.channel,
    views: v.views,
    retention,
    viewedVsSwiped: 68,
    avgPctViewed: 71,
    likesPer1k: Math.round(((v.likes || 900) / Math.max(1, v.views)) * 1000 * 10) / 10,
    commentsPer1k: Math.round(((v.comments || 40) / Math.max(1, v.views)) * 1000 * 10) / 10,
    sharesPer1k: 4.2,
  }
}

export const fmtCompact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
