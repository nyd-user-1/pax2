import paidBatch from "../../data/generated/voter-freedom-paid.json"
import { buildReference, FORMULA_V1, logit, score, type ComponentKey, type Reference } from "@/lib/resonance"
import type { Measure, MetricKey, Snapshot, Take } from "@/lib/types"

// Resonance and KPIs for the paid batch, from the ad platform's own export
// (data/generated/voter-freedom-paid.json), not from the sample figures.
//
// Which creatives count: a video's exact cuts only; an ad-only edit's plays must
// not pose as the upload's, unless edits are all the video ran as. Every row of
// the counted creatives is summed into one snapshot per video.
//
// How the export maps onto the snapshot's metrics:
//
//   spend        ← spend_usd
//   impressions  ← impressions
//   plays3s      ← video_starts. The export has no 3-second count; a start is
//                  the nearest recorded play and the only one counted from the
//                  first frame, so Engage here reads starts ÷ impressions.
//   thruplays    ← views_15s_thruplays_reported
//   p25/p50/p75  ← views_25/50/75pct_reported_pct × video_starts ÷ 100, the
//                  depths being reported as shares of starts
//   p100         ← video_completions_reported
//   linkClicks   ← clicks
//   avgWatchSec  ← estimated from the retention curve, below; marked derived
//   reach, shares, saves, comments, reactions ← null
//
// Average watch time is not in the export, so it is estimated from the points
// the export does report. For each counted creative, its rows are summed and
// the share of starts still watching is placed at each second it describes:
// 1 at 0s; the 25, 50 and 75% depths at those fractions of the creative's
// length; ThruPlays ÷ starts at 15s and 30-second views ÷ starts at 30s, each
// only when the creative runs longer; completions ÷ starts at the end. The
// curve is integrated over the creative's length in trapezoids between the
// sorted points, giving seconds watched per start. A video with several
// creatives takes their start-weighted average, and its length is the
// start-weighted average of theirs. Straight lines between points assume
// viewers leave evenly between them; it is an estimate, not a recorded number.
//
// The export records no reach and no shares or saves. Act needs shares, saves
// and comments together, so it reads as missing, and the model shares its
// weight between Engage and Interest. Clicks are not a substitute. YouTube's
// public comment and like counts are organic, not counted against these ad
// plays, so they are left out rather than mixed into a paid rate.
//
// The reference, what 50 means, is the paid batch itself: every paid video's
// snapshot, built with buildReference. A score here says how a video did
// against the other videos in this batch, not against any wider set.

type Row = Record<string, string>
export type Creative = { creativeId: string; creativeSet?: string; name?: string; cut: "exact" | "edit"; videoId: string; durationSeconds: number; rows: Row[] }

export type PaidRange = { score: number | null; low: number | null; high: number | null; range: string }

export type PaidResonance = {
  score: number | null
  low: number | null
  high: number | null
  range: string
  components: Record<ComponentKey, PaidRange>
  /** KPI row label → component → display string. */
  kpis: Record<string, Record<ComponentKey, string>>
  status: "scored" | "limited" | "unscorable"
  reasons: string[]
}

const DASH = "-"

/** Seconds watched per start for one creative, from its reported retention points. */
function watchPerStart(c: Creative) {
  const sum = (k: string) => c.rows.reduce((t, r) => t + (Number(r[k]) || 0), 0)
  const depth = (k: string) => c.rows.reduce((t, r) => t + ((Number(r.video_starts) || 0) * (Number(r[k]) || 0)) / 100, 0)
  const starts = sum("video_starts")
  const len = c.durationSeconds || Number(c.rows[0]?.duration_seconds) || 0
  if (!starts || !len) return null
  const pts: [number, number][] = [
    [0, 1],
    [len * 0.25, depth("views_25pct_reported_pct") / starts],
    [len * 0.5, depth("views_50pct_reported_pct") / starts],
    [len * 0.75, depth("views_75pct_reported_pct") / starts],
    [len, sum("video_completions_reported") / starts],
  ]
  if (len > 15) pts.push([15, sum("views_15s_thruplays_reported") / starts])
  if (len > 30) pts.push([30, sum("views_30s_reported") / starts])
  pts.sort((a, b) => a[0] - b[0])
  let sec = 0
  for (let i = 1; i < pts.length; i++) sec += ((pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1])) / 2
  return { sec, starts, len }
}
const KEYS: ComponentKey[] = ["stop", "hold", "act"]
export const creatives = paidBatch.creatives as unknown as Creative[]

/** The creatives that count for a video: its exact cuts, or its edits when no exact cut ran. */
export function countedFor(ytId: string) {
  const all = creatives.filter((c) => c.videoId === ytId)
  const exact = all.filter((c) => c.cut === "exact")
  return exact.length ? exact : all
}

/** A delivery segment as the partner labeled it: audience group by age band. */
const segOf = (r: Row) => `${r.audience_group}|${r.age_group}`

/** Starts per impression in each delivery segment across every counted row of the batch: the rates the
 *  delivery-mix adjustment expects a video to reach, given who it was shown to. Learned from the data. */
export function segmentRates() {
  const acc = new Map<string, { imp: number; starts: number }>()
  let imp = 0
  let starts = 0
  for (const id of [...new Set(creatives.map((c) => c.videoId))])
    for (const r of countedFor(id).flatMap((c) => c.rows)) {
      const a = acc.get(segOf(r)) ?? { imp: 0, starts: 0 }
      a.imp += Number(r.impressions) || 0
      a.starts += Number(r.video_starts) || 0
      acc.set(segOf(r), a)
      imp += Number(r.impressions) || 0
      starts += Number(r.video_starts) || 0
    }
  return { segments: Object.fromEntries([...acc].map(([k, v]) => [k, { ...v, rate: v.imp ? v.starts / v.imp : 0 }])), overall: imp ? starts / imp : 0 }
}

const fmt = (n: number | null | undefined, d = 0) => (n == null ? DASH : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }))
const pct = (n: number | null | undefined, d = 2) => (n == null ? DASH : `${(n * 100).toFixed(d)}%`)

/** One snapshot per video from its counted creatives. With `mix`, starts are restated at the batch's
 *  delivery mix (indirect standardization: observed starts over the starts its segments' batch rates
 *  expect, times the batch rate, times its impressions), so an audience that starts videos less often
 *  does not lower Engage; watch depth barely differs by segment and is left as reported. */
export function snapshotFor(ytId: string, opts: { mix?: boolean } = {}): { s: Snapshot; take: Take; expectedStarts?: number } | null {
  const all = creatives.filter((c) => c.videoId === ytId)
  if (!all.length) return null
  const used = countedFor(ytId)
  const rows = used.flatMap((c) => c.rows)
  const sum = (k: string) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0)
  const curves = used.map(watchPerStart).filter((w): w is { sec: number; starts: number; len: number } => w != null)
  const weight = curves.reduce((t, w) => t + w.starts, 0)
  const watch = weight ? { sec: curves.reduce((t, w) => t + w.sec * w.starts, 0) / weight, len: curves.reduce((t, w) => t + w.len * w.starts, 0) / weight } : null
  const depth = (k: string) => rows.reduce((t, r) => t + ((Number(r.video_starts) || 0) * (Number(r[k]) || 0)) / 100, 0)
  const dates = rows.map((r) => r.report_date).filter(Boolean).sort()
  const platform = (value: number | null): Measure => ({ value, source: "platform" })
  const derived = (value: number): Measure => ({ value, source: "derived" })
  const none: Measure = { value: null, source: "platform" }
  const metrics: Record<MetricKey, Measure> = {
    spend: platform(sum("spend_usd")),
    impressions: platform(sum("impressions")),
    reach: none,
    plays3s: platform(sum("video_starts")),
    thruplays: platform(sum("views_15s_thruplays_reported")),
    p25: derived(depth("views_25pct_reported_pct")),
    p50: derived(depth("views_50pct_reported_pct")),
    p75: derived(depth("views_75pct_reported_pct")),
    p100: platform(sum("video_completions_reported")),
    avgWatchSec: watch ? derived(watch.sec) : none,
    shares: none,
    saves: none,
    comments: none,
    reactions: none,
    linkClicks: platform(sum("clicks")),
  }
  const s: Snapshot = {
    id: `paid-${ytId}-${used.map((c) => c.creativeId).join("+")}`,
    flightId: `paid-${ytId}`,
    asOf: dates[dates.length - 1] ?? "",
    windowStart: dates[0] ?? "",
    windowEnd: dates[dates.length - 1] ?? "",
    dataset: "voter-freedom-paid",
    metrics,
  }
  const take: Take = { id: `yt-${ytId}`, scriptId: "", messenger: { label: "" }, durationSec: watch?.len ?? (used[0].durationSeconds || Number(rows[0]?.duration_seconds) || 0) }
  if (!opts.mix) return { s, take }
  const sr = segmentRates()
  const expected = rows.reduce((t, r) => t + (Number(r.impressions) || 0) * (sr.segments[segOf(r)]?.rate ?? sr.overall), 0)
  const observed = sum("video_starts")
  const imp = sum("impressions")
  const adjusted = expected ? (observed / expected) * sr.overall * imp : observed
  return { s: { ...s, id: `${s.id}~mix`, metrics: { ...metrics, plays3s: derived(adjusted) } }, take, expectedStarts: expected }
}

export const videoIds = [...new Set(creatives.map((c) => c.videoId))]
let ref: Reference | null = null
/** The paid batch as its own reference, built once. */
export function reference() {
  if (!ref) {
    const rows = videoIds.map((id) => snapshotFor(id)).filter((r): r is { s: Snapshot; take: Take } => r != null)
    ref = buildReference("paid-batch", "voter-freedom-paid", rows, FORMULA_V1)
  }
  return ref
}

const round = (n: number | null) => (n == null ? null : Math.round(n))
const range = (low: number | null, high: number | null) => (low == null || high == null ? DASH : `${Math.round(low)}–${Math.round(high)}`)

/** Resonance and the KPI trace for a paid video, scored against the paid batch; null outside it. */
export function paidResonance(ytId: string): PaidResonance | null {
  const row = snapshotFor(ytId)
  if (!row) return null
  const r = reference()
  const sc = score(row.s, row.take, r, FORMULA_V1)
  const byKey = (k: ComponentKey) => sc.components.find((c) => c.key === k)
  const components = {} as Record<ComponentKey, PaidRange>
  const kpis = Object.fromEntries(["Counts", "Rate", "Ref. avg", "Weighted", "Distance", "Score", "Weight"].map((l) => [l, {} as Record<ComponentKey, string>]))
  for (const k of KEYS) {
    const c = byKey(k)
    const live = c?.raw != null && c.score != null
    components[k] = live ? { score: round(c.score), low: round(c.low), high: round(c.high), range: range(c.low, c.high) } : { score: null, low: null, high: null, range: DASH }
    kpis.Counts[k] = live ? fmt(c.raw!.x) : DASH
    kpis.Rate[k] = live ? pct(c.rate) : DASH
    kpis["Ref. avg"][k] = live ? pct(r.pooled[k]) : DASH
    kpis.Weighted[k] = live ? pct(c.shrunk) : DASH
    kpis.Distance[k] = live && c.shrunk != null ? ((logit(c.shrunk) - r.mean[k]) / r.sd[k]).toFixed(2) : DASH
    kpis.Score[k] = live ? c.score!.toFixed(1) : DASH
    kpis.Weight[k] = live && c.contribution != null ? c.contribution.toFixed(1) : DASH
  }
  return {
    score: round(sc.value),
    low: round(sc.low),
    high: round(sc.high),
    range: range(sc.low, sc.high),
    components,
    kpis,
    status: sc.status,
    reasons: sc.reasons,
  }
}
