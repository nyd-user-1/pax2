import "server-only"

import { generatedJson } from "@/lib/generated-store"

// The video page's Analytics block (data/generated/analytics.json, scripts/analytics/build.mjs): the 36
// metrics of docs/HOUSE.html and docs/DATA-API.html held or derived for the baseline shorts. Each row
// carries this short's value, its channel's figure, the figure across the baseline, and the short's
// percentile within its channel. Channel-level rows have no value of the short's own; yes/no rows read
// as shares of shorts.

type Doc = {
  video: string[]
  flags: string[]
  baseline: Record<string, number | null>
  baselineFlags: Record<string, number | null>
  baselineLevel: Record<string, number | null>
  channels: Record<string, { level: Record<string, number | null>; medians: Record<string, number | null>; flags: Record<string, number | null> }>
  rows: Record<string, { ch: string; v: (number | null)[]; p: (number | null)[] }>
}

export type AnalyticsRow = { kind: "video" | "level" | "flag"; group: string; label: string; value: string; channel: string; all: string; pct: number | null }

const DASH = "—"
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

type Fmt = (x: number) => string
const count: Fmt = (x) => COMPACT.format(x)
const rate: Fmt = (x) => `${(x * 100).toFixed(x < 0.001 && x > 0 ? 3 : 2)}%`
const share: Fmt = (x) => `${Math.round(x * 100)}%`
const times: Fmt = (x) => `${x >= 10 ? x.toFixed(0) : x.toFixed(2)}×`
const dec = (d: number, unit = ""): Fmt => (x) => `${x.toFixed(d)}${unit}`
const clock: Fmt = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`
const ord: Fmt = (x) => {
  const n = Math.round(x)
  return `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`
}
const pts: Fmt = (x) => `${x > 0 ? "+" : ""}${x.toFixed(1)} pts`
const show = (x: number | null | undefined, f: Fmt) => (x == null ? DASH : f(x))

/** One row of the table: `video` reads a per-video metric, `level` a channel-level one, `flag` a yes/no. */
type Spec = { group: string; label: string } & ({ video: string; fmt: Fmt } | { level: string; fmt: Fmt } | { flag: string })

const SPEC: Spec[] = [
  { group: "Performance", label: "Views", video: "views", fmt: count },
  { group: "Performance", label: "Outlier Score", video: "outlierScore", fmt: times },
  { group: "Performance", label: "Engagement rate", video: "engagementRate", fmt: rate },
  { group: "Performance", label: "Hit probability", video: "hitProbability", fmt: share },
  { group: "Performance", label: "Likes", video: "likes", fmt: count },
  { group: "Performance", label: "Comments", video: "comments", fmt: count },
  { group: "Performance", label: "Like rate", video: "likeRate", fmt: rate },
  { group: "Performance", label: "Comment rate", video: "commentRate", fmt: rate },
  { group: "Performance", label: "Comments per like", video: "commentsPerLike", fmt: dec(2) },
  { group: "Performance", label: "Views per day", video: "viewsPerDay", fmt: count },
  { group: "Performance", label: "Against the catalog median", video: "war", fmt: times },
  { group: "Performance", label: "Against expected views", video: "residual", fmt: times },
  { group: "Performance", label: "Views per subscriber", video: "viewsPerSubscriber", fmt: dec(2) },
  { group: "Channel", label: "Subscribers", level: "subscribers", fmt: count },
  { group: "Channel", label: "Channel median views", level: "channelMedian", fmt: count },
  { group: "Channel", label: "Channel views per video", level: "channelViewsPerVideo", fmt: count },
  { group: "Channel", label: "Upload cadence", level: "uploadsPerWeek", fmt: dec(1, " a week") },
  { group: "Channel", label: "Share over 3x", level: "shareOver3x", fmt: share },
  { group: "Channel", label: "Settled share", level: "settledShare", fmt: share },
  { group: "Channel", label: "Duration profile, median length", level: "channelMedianLength", fmt: clock },
  { group: "Channel", label: "Length", video: "durationSec", fmt: clock },
  { group: "Channel", label: "Neighborhood lift", video: "neighborhoodLift", fmt: pts },
  { group: "Content", label: "Title words", video: "titleWords", fmt: dec(0) },
  { group: "Content", label: "Title asks a question", flag: "titleQuestion" },
  { group: "Content", label: "Title carries a number", flag: "titleNumber" },
  { group: "Content", label: "Title in the first person", flag: "titleFirstPerson" },
  { group: "Content", label: "Title win percentile", video: "titleWinPercentile", fmt: ord },
  { group: "Content", label: "Hook words", video: "hookWordCount", fmt: dec(0) },
  { group: "Content", label: "Opens on a question", flag: "questionLed" },
  { group: "Content", label: "Seconds to first cut", video: "firstCutSec", fmt: dec(1, " s") },
  { group: "Content", label: "Seconds to first word", video: "firstWordSec", fmt: dec(1, " s") },
  { group: "Script", label: "Words spoken", video: "wordCount", fmt: dec(0) },
  { group: "Script", label: "Sentences", video: "sentenceCount", fmt: dec(0) },
  { group: "Script", label: "Mean sentence length", video: "meanSentenceLength", fmt: dec(1, " words") },
  { group: "Script", label: "Pace", video: "wpm", fmt: dec(0, " wpm") },
  { group: "Script", label: "Spoken in the first person", flag: "firstPerson" },
  { group: "Script", label: "A concrete number", flag: "concreteNumber" },
  { group: "Script", label: "An explicit ask", flag: "explicitAsk" },
  { group: "Script", label: "Repetition", flag: "repetition" },
  { group: "Script", label: "Frames with text", video: "textFrameShare", fmt: share },
]

export async function videoAnalytics(ytId: string): Promise<{ rows: AnalyticsRow[]; shorts: number } | null> {
  const doc = await generatedJson<Doc>("analytics")
  const row = doc?.rows[ytId]
  if (!doc || !row) return null
  const ch = doc.channels[row.ch]
  const at = (k: string) => doc.video.indexOf(k)
  const flagAt = (k: string) => doc.video.length + doc.flags.indexOf(k)
  const rows = SPEC.map((s): AnalyticsRow => {
    if ("video" in s) {
      const i = at(s.video)
      return { kind: "video", group: s.group, label: s.label, value: show(row.v[i], s.fmt), channel: show(ch?.medians[s.video], s.fmt), all: show(doc.baseline[s.video], s.fmt), pct: row.p[i] }
    }
    if ("level" in s) return { kind: "level", group: s.group, label: s.label, value: DASH, channel: show(ch?.level[s.level], s.fmt), all: show(doc.baselineLevel[s.level], s.fmt), pct: null }
    const x = row.v[flagAt(s.flag)]
    return { kind: "flag", group: s.group, label: s.label, value: x == null ? DASH : x ? "Yes" : "No", channel: show(ch?.flags[s.flag], share), all: show(doc.baselineFlags[s.flag], share), pct: null }
  })
  return { rows, shorts: Object.keys(doc.rows).length }
}
