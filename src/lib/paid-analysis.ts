// The partner's paid export, scored and examined: Paid Resonance 1 against the whole batch (as before), and
// Paid Resonance 2, which also accounts for reporting window and delivery mix; what changes when an input
// changes; whether reasonable changes to the assumptions change the assessment; what the score adds beyond
// one plain measure; and which of its choices are design and which are learned from the data.
// Paid Resonance is the paid-attention score of src/lib/resonance.ts, not the pre-release Resonance the
// video pages show.
import vf from "../../data/raw/voter-freedom.json"
import transcripts from "../../data/generated/paid-transcripts.json"
import { countedFor, creatives, reference, segmentRates, snapshotFor, videoIds } from "@/lib/paid-resonance"
import { buildReference, FORMULA_V1, score, spearman, WEIGHT_PRESETS, type Formula, type Reference, type Score } from "@/lib/resonance"
import type { Snapshot, Take } from "@/lib/types"

/** Version 2: the same weights and evidence rules, on mix-standardized starts, against the video's own
 *  reporting-window cohort. A revision, so a new version; version 1's scores stand. */
export const FORMULA_V2: Formula = { ...FORMULA_V1, version: "resonance-2", label: "Paid Resonance 2" }

type Row = Record<string, string>
const num = (r: Row, k: string) => Number(r[k]) || 0
const titleOf = (id: string) => (vf as unknown as { videos: { id: string; title: string; published?: string; duration?: string }[] }).videos.find((v) => v.id === id)

/** A video's reporting window: the report date carrying most of its counted impressions. */
export function windowOf(id: string) {
  const by = new Map<string, number>()
  for (const r of countedFor(id).flatMap((c) => c.rows)) by.set(r.report_date, (by.get(r.report_date) ?? 0) + num(r, "impressions"))
  return [...by].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
}

const memo = new Map<string, unknown>()
const once = <T,>(key: string, f: () => T): T => {
  if (!memo.has(key)) memo.set(key, f())
  return memo.get(key) as T
}

type Snap = { s: Snapshot; take: Take; expectedStarts?: number }
const snaps = (mix: boolean) => once(`snaps-${mix}`, () => new Map(videoIds.map((id) => [id, snapshotFor(id, { mix })!] as const)))
const cohorts = () => once("cohorts", () => {
  const m = new Map<string, string[]>()
  for (const id of videoIds) m.set(windowOf(id), [...(m.get(windowOf(id)) ?? []), id])
  return m
})
function refFor(mix: boolean, window: string | null, f: Formula = FORMULA_V1): Reference {
  return once(`ref-${mix}-${window}-${f.version}-${JSON.stringify(f.priorStrength)}`, () => {
    const ids = window ? cohorts().get(window)! : videoIds
    const rows = ids.map((id) => snaps(mix).get(id)!).map((x) => ({ s: x.s, take: x.take }))
    return buildReference(`paid${mix ? "-mix" : ""}${window ? `-${window}` : ""}`, "voter-freedom-paid", rows, f)
  })
}

export type PaidPiece = {
  id: string
  title: string
  published: string | null
  window: string
  cohort: number
  sets: string[]
  counted: { id: string; name: string; cut: string; seconds: number; date: string }[]
  excluded: { id: string; name: string; cut: string }[]
  totals: { spend: number; impressions: number; starts: number; thruplays: number; completions: number; clicks: number }
  observedStarts: number
  expectedStarts: number
  v1: Score
  v2: Score
  mixOnly: Score
  windowOnly: Score
}

export function pieces(): PaidPiece[] {
  return once("pieces", () =>
    videoIds.map((id) => {
      const base = snaps(false).get(id)!
      const mixed = snaps(true).get(id)!
      const w = windowOf(id)
      const used = countedFor(id)
      const rows = used.flatMap((c) => c.rows)
      const sum = (k: string) => rows.reduce((t, r) => t + num(r, k), 0)
      const t = titleOf(id)
      return {
        id,
        title: t?.title ?? used[0]?.name ?? id,
        published: t?.published ? String(t.published).slice(0, 10) : null,
        window: w,
        cohort: cohorts().get(w)!.length,
        sets: [...new Set(used.map((c) => c.creativeSet ?? ""))].filter(Boolean),
        counted: used.map((c) => ({ id: c.creativeId, name: c.name ?? "", cut: c.cut, seconds: c.durationSeconds, date: c.rows[0]?.report_date ?? "" })),
        excluded: creatives.filter((c) => c.videoId === id && !used.includes(c)).map((c) => ({ id: c.creativeId, name: c.name ?? "", cut: c.cut })),
        totals: { spend: sum("spend_usd"), impressions: sum("impressions"), starts: sum("video_starts"), thruplays: sum("views_15s_thruplays_reported"), completions: sum("video_completions_reported"), clicks: sum("clicks") },
        observedStarts: sum("video_starts"),
        expectedStarts: mixed.expectedStarts ?? sum("video_starts"),
        v1: score(base.s, base.take, reference(), FORMULA_V1),
        v2: score(mixed.s, mixed.take, refFor(true, w), FORMULA_V2),
        mixOnly: score(mixed.s, mixed.take, refFor(true, null), FORMULA_V1),
        windowOnly: score(base.s, base.take, refFor(false, w), FORMULA_V1),
      }
    }),
  )
}

export const pieceById = (id: string) => pieces().find((p) => p.id === id) ?? null

/** Rank of each value, 1 = highest. */
const ranks = (xs: number[]) => {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
  const r = new Array<number>(xs.length)
  order.forEach(([, i], k) => (r[i] = k + 1))
  return r
}
const val = (s: Score) => s.value ?? 0

/** Rank moves from version 1 to another scoring of the same pieces. */
export function rankMoves(get: (p: PaidPiece) => Score) {
  const ps = pieces()
  const a = ranks(ps.map((p) => val(p.v1)))
  const b = ranks(ps.map((p) => val(get(p))))
  return Object.fromEntries(ps.map((p, i) => [p.id, a[i] - b[i]]))
}

/** What happens to one piece's version-1 score when an input changes, against the same frozen reference. */
export function whatIf(id: string) {
  const base = snaps(false).get(id)!
  const ref = reference()
  const v = (k: keyof Snapshot["metrics"]) => base.s.metrics[k]?.value ?? null
  const scale = (f: Partial<Record<keyof Snapshot["metrics"], number>>): Snapshot => ({
    ...base.s,
    id: `${base.s.id}~whatif-${Object.entries(f).map(([k, x]) => `${k}${x}`).join("-")}`,
    metrics: Object.fromEntries(Object.entries(base.s.metrics).map(([k, m]) => [k, k in f && m.value != null ? { ...m, value: m.value * f[k as keyof typeof f]! } : m])) as Snapshot["metrics"],
  })
  const at = (s: Snapshot) => score(s, base.take, ref, FORMULA_V1)
  const half = { spend: 0.5, impressions: 0.5, plays3s: 0.5, thruplays: 0.5, p25: 0.5, p50: 0.5, p75: 0.5, p100: 0.5, linkClicks: 0.5 }
  return {
    base: at(base.s),
    cases: [
      { label: "Starts up 10%", s: at(scale({ plays3s: 1.1 })) },
      { label: "Average watch up 10%", s: at(scale({ avgWatchSec: 1.1 })) },
      { label: "Half the budget, same rates", s: at(scale(half)) },
      { label: "A tenth of the budget, same rates", s: at(scale({ spend: 0.1, impressions: 0.1, plays3s: 0.1, thruplays: 0.1, p25: 0.1, p50: 0.1, p75: 0.1, p100: 0.1, linkClicks: 0.1 })) },
    ],
    inputs: { starts: v("plays3s"), impressions: v("impressions"), avgWatchSec: v("avgWatchSec"), lengthSec: base.take.durationSec },
  }
}

/** Whether reasonable changes to the assumptions change the assessment: rank agreement with version 1. */
export function sensitivity() {
  return once("sensitivity", () => {
    const ps = pieces()
    const v1 = ps.map((p) => val(p.v1))
    const row = (label: string, kind: string, xs: number[]) => {
      const a = ranks(v1)
      const b = ranks(xs)
      const moves = ps.map((p, i) => ({ title: p.title, by: a[i] - b[i] }))
      const top = moves.slice().sort((x, y) => Math.abs(y.by) - Math.abs(x.by))[0]
      return { label, kind, rho: spearman(v1, xs), maxMove: Math.abs(top.by), mover: top.by ? top : null }
    }
    const withF = (f: Formula, label: string) => {
      const ref = buildReference(`paid-${f.version}`, "voter-freedom-paid", ps.map((p) => snaps(false).get(p.id)!).map((x) => ({ s: x.s, take: x.take })), f)
      return row(label, "assumption", ps.map((p) => { const x = snaps(false).get(p.id)!; return val(score(x.s, x.take, ref, f)) }))
    }
    return [
      ...WEIGHT_PRESETS.filter((w) => w.id !== "v1").map((w) => withF({ ...FORMULA_V1, version: `w-${w.id}`, weights: w.weights }, `Weights: ${w.label}`)),
      withF({ ...FORMULA_V1, version: "k-half", priorStrength: { stop: FORMULA_V1.priorStrength.stop / 2, hold: FORMULA_V1.priorStrength.hold / 2, act: FORMULA_V1.priorStrength.act / 2 } }, "Evidence pull halved"),
      withF({ ...FORMULA_V1, version: "k-double", priorStrength: { stop: FORMULA_V1.priorStrength.stop * 2, hold: FORMULA_V1.priorStrength.hold * 2, act: FORMULA_V1.priorStrength.act * 2 } }, "Evidence pull doubled"),
      row("Delivery mix adjusted", "adjustment", ps.map((p) => val(p.mixOnly))),
      row("Same reporting window", "adjustment", ps.map((p) => val(p.windowOnly))),
      row("Paid Resonance 2 (both)", "adjustment", ps.map((p) => val(p.v2))),
    ]
  })
}

/** What the score adds beyond one plain measure: rank agreement with each, and where they part most. */
export function singleMeasures() {
  return once("single", () => {
    const ps = pieces()
    const v1 = ps.map((p) => val(p.v1))
    const m = (label: string, f: (p: PaidPiece) => number, lowerBetter = false) => {
      const xs = ps.map(f)
      const a = ranks(v1)
      const b = ranks(lowerBetter ? xs.map((x) => -x) : xs)
      const gap = ps.map((p, i) => ({ title: p.title, score: Math.round(val(p.v1)), resRank: a[i], measureRank: b[i] })).sort((x, y) => Math.abs(y.resRank - y.measureRank) - Math.abs(x.resRank - x.measureRank))[0]
      return { label, rho: spearman(v1, lowerBetter ? xs.map((x) => -x) : xs), gap }
    }
    return [
      m("Start rate (starts ÷ impressions)", (p) => p.totals.starts / p.totals.impressions),
      m("Completion rate (completions ÷ starts)", (p) => p.totals.completions / p.totals.starts),
      m("15-second rate (ThruPlays ÷ starts)", (p) => p.totals.thruplays / p.totals.starts),
      m("Click-through rate (clicks ÷ impressions)", (p) => p.totals.clicks / p.totals.impressions),
      m("Cost per 15-second view (lower is better)", (p) => p.totals.spend / p.totals.thruplays, true),
    ]
  })
}

/** Every choice in the score, marked design (chosen) or learned (estimated from this export). */
export function ledger() {
  const ref = reference()
  const sr = segmentRates()
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`
  const c = cohorts()
  return [
    { what: "Weights: Engage 25, Interest 40, Act 35", kind: "design", value: "Interest weighs most because budget buys it least" },
    { what: "Act missing: its weight is shared by Engage and Interest", kind: "design", value: "25 : 40" },
    { what: "Evidence pull toward the reference (k)", kind: "design", value: "2,000 impressions · 300 viewers · 800 plays" },
    { what: "Unscorable below / limited below", kind: "design", value: "1,000 / 15,000 impressions" },
    { what: "Mapping to 0–100", kind: "design", value: "percentile of the log-odds distance from the reference mean" },
    { what: "Reference set", kind: "design", value: "this batch of 16 videos (version 2: the video's own report date)" },
    { what: "Which creatives count", kind: "design", value: "exact cuts; edits only where no exact cut ran" },
    { what: "Starts stand in for 3-second plays", kind: "design", value: "the export records no 3-second count" },
    { what: "Average watch from the retention points", kind: "design", value: "straight lines between the 25/50/75%, 15 s, 30 s and completion points" },
    { what: "Delivery segments for the mix adjustment", kind: "design", value: "audience group × age band, as the partner labeled them" },
    { what: "Reporting window", kind: "design", value: "the report date carrying most of a video's impressions" },
    { what: "Reference average, Engage", kind: "learned", value: pct(ref.pooled.stop) },
    { what: "Reference average, Interest", kind: "learned", value: pct(ref.pooled.hold) },
    { what: "Reference spread (log-odds), Engage · Interest", kind: "learned", value: `${ref.sd.stop.toFixed(2)} · ${ref.sd.hold.toFixed(2)}` },
    ...Object.entries(sr.segments).map(([k, v]) => ({ what: `Start rate, ${k.replace("|", ", ")}`, kind: "learned", value: pct(v.rate) })),
    ...[...c].map(([d, ids]) => {
      const r = refFor(false, d)
      return { what: `Reference average, Engage, reported ${d} (${ids.length} videos)`, kind: "learned", value: pct(r.pooled.stop) }
    }),
  ]
}

export type Line = { t: number; text: string }
export const linesFor = (id: string): { lines: Line[]; error?: string } => (transcripts as Record<string, { lines: Line[]; error?: string }>)[id] ?? { lines: [] }
