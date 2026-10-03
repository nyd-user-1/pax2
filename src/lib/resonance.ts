import type { MetricKey, Snapshot, Take } from "@/lib/types"

// Resonance, formula version 1.
//
// What it assesses: how well a paid video earned attention from the people it
// was shown to, compared with a frozen reference set. Three platform-recorded
// rates, each adjusted for how much evidence stands behind it:
//
//   Stop  — 3-second plays ÷ impressions        (did the opening stop the scroll)
//   Hold  — average watch time ÷ video length   (did people stay, length-adjusted)
//   Act   — (shares + saves + comments) ÷ 3-second plays  (did viewers do something)
//
// Budget cannot buy a higher number: every input is a rate, and a rate built
// on few impressions is pulled toward the reference average in proportion to
// how little evidence it has. Spend, CPM and reach are shown as delivery
// conditions beside the score, never inside it.
//
// It is not a forecast for an unpublished video, a measure of belief change,
// or proof of what caused the result.

export type ComponentKey = "stop" | "hold" | "act"

export type Formula = {
  version: string
  label: string
  /** Design choices, not learned from data. */
  weights: Record<ComponentKey, number>
  /** Prior strength: how many units of evidence the reference average is worth. */
  priorStrength: Record<ComponentKey, number>
  minImpressions: number
  limitedImpressions: number
}

export const FORMULA_V1: Formula = {
  version: "resonance-1",
  label: "Resonance 1",
  weights: { stop: 0.25, hold: 0.4, act: 0.35 },
  priorStrength: { stop: 2000, hold: 300, act: 800 },
  minImpressions: 1000,
  limitedImpressions: 15000,
}

/** The yardstick: mean and spread of each component's log-odds across the reference set, frozen at creation. */
export type Reference = {
  id: string
  createdAt: string
  dataset: string
  n: number
  mean: Record<ComponentKey, number>
  sd: Record<ComponentKey, number>
  /** Pooled rates, the point estimates are shrunk toward. */
  pooled: Record<ComponentKey, number>
}

export const COMPONENTS: { key: ComponentKey; name: string; question: string; num: string; den: string }[] = [
  { key: "stop", name: "Stop", question: "Did the opening stop the scroll?", num: "3-second plays", den: "impressions" },
  { key: "hold", name: "Hold", question: "Did people watch 50% or more?", num: "average watch time", den: "video length" },
  { key: "act", name: "Act", question: "Did viewers do something?", num: "shares + saves + comments", den: "3-second plays" },
]

type Raw = { x: number; n: number } | null

const v = (s: Snapshot, k: MetricKey) => s.metrics[k]?.value ?? null

/** The counts behind each component, or null when the record cannot support it. */
export function rawCounts(s: Snapshot, take: Take): Record<ComponentKey, Raw> {
  const imp = v(s, "impressions")
  const plays = v(s, "plays3s")
  const watch = v(s, "avgWatchSec")
  const shares = v(s, "shares")
  const saves = v(s, "saves")
  const comments = v(s, "comments")
  const stop = imp && plays != null ? { x: plays, n: imp } : null
  // Hold is a proportion of the video watched per viewer; its evidence is the number of viewers.
  const hold = plays && watch != null && take.durationSec > 0 ? { x: Math.min(1, watch / take.durationSec) * plays, n: plays } : null
  const acts = [shares, saves, comments]
  const act = plays && acts.every((a) => a != null) ? { x: acts.reduce<number>((t, a) => t + (a ?? 0), 0), n: plays } : null
  return { stop, hold, act }
}

const clamp = (p: number) => Math.min(1 - 1e-6, Math.max(1e-6, p))
export const logit = (p: number) => Math.log(clamp(p) / (1 - clamp(p)))

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

export function shrink(raw: { x: number; n: number }, pooled: number, k: number) {
  return (raw.x + k * pooled) / (raw.n + k)
}

/** Build and freeze a reference from a set of snapshots. */
export function buildReference(id: string, dataset: string, rows: { s: Snapshot; take: Take }[], f: Formula = FORMULA_V1): Reference {
  const keys: ComponentKey[] = ["stop", "hold", "act"]
  const pooled = {} as Record<ComponentKey, number>
  const mean = {} as Record<ComponentKey, number>
  const sd = {} as Record<ComponentKey, number>
  const scorable = rows.filter((r) => (v(r.s, "impressions") ?? 0) >= f.minImpressions)
  for (const k of keys) {
    const raws = scorable.map((r) => rawCounts(r.s, r.take)[k]).filter((r): r is { x: number; n: number } => r != null)
    const X = raws.reduce((t, r) => t + r.x, 0)
    const N = raws.reduce((t, r) => t + r.n, 0)
    pooled[k] = N ? X / N : 0.5
    const ls = raws.map((r) => logit(shrink(r, pooled[k], f.priorStrength[k])))
    const m = ls.reduce((t, l) => t + l, 0) / Math.max(1, ls.length)
    const s = Math.sqrt(ls.reduce((t, l) => t + (l - m) ** 2, 0) / Math.max(1, ls.length - 1))
    mean[k] = m
    sd[k] = s > 0.05 ? s : 0.05
  }
  return { id, createdAt: new Date().toISOString(), dataset, n: scorable.length, mean, sd, pooled }
}

// Seeded random numbers, so the same record always yields the same interval.
function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19))
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
function normal(r: () => number) {
  const u = Math.max(1e-12, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}
function gamma(a: number, r: () => number): number {
  if (a < 1) return gamma(a + 1, r) * Math.pow(r(), 1 / a)
  const d = a - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x = 0
    let vv = 0
    do {
      x = normal(r)
      vv = 1 + c * x
    } while (vv <= 0)
    vv = vv ** 3
    const u = r()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - vv + Math.log(vv))) return d * vv
  }
}
const beta = (a: number, b: number, r: () => number) => {
  const x = gamma(a, r)
  return x / (x + gamma(b, r))
}

export type ComponentScore = {
  key: ComponentKey
  raw: { x: number; n: number } | null
  rate: number | null
  shrunk: number | null
  score: number | null
  low: number | null
  high: number | null
  weight: number
  contribution: number | null
}

export type Score = {
  snapshotId: string
  formula: string
  reference: string
  status: "scored" | "limited" | "unscorable"
  reasons: string[]
  value: number | null
  low: number | null
  high: number | null
  components: ComponentScore[]
  /** Delivery conditions, shown beside the score and never inside it. */
  conditions: { cpm: number | null; costPerPlay: number | null; frequency: number | null; spend: number | null }
}

const toScore = (p: number, ref: Reference, k: ComponentKey) => 100 * phi((logit(p) - ref.mean[k]) / ref.sd[k])

export function score(s: Snapshot, take: Take, ref: Reference, f: Formula = FORMULA_V1, draws = 400): Score {
  const raws = rawCounts(s, take)
  const imp = v(s, "impressions")
  const spend = v(s, "spend")
  const reach = v(s, "reach")
  const plays = v(s, "plays3s")
  const conditions = {
    spend,
    cpm: spend != null && imp ? (spend / imp) * 1000 : null,
    costPerPlay: spend != null && plays ? spend / plays : null,
    frequency: reach && imp ? imp / reach : null,
  }
  const reasons: string[] = []
  if (imp == null) reasons.push("No impressions recorded.")
  else if (imp < f.minImpressions) reasons.push(`${imp.toLocaleString()} impressions, under the ${f.minImpressions.toLocaleString()} needed to score.`)
  if (!raws.stop) reasons.push("No 3-second plays recorded.")
  if (reasons.length) {
    return { snapshotId: s.id, formula: f.version, reference: ref.id, status: "unscorable", reasons, value: null, low: null, high: null, components: [], conditions }
  }
  const r = rng(`${s.id}|${f.version}|${ref.id}`)
  const keys: ComponentKey[] = ["stop", "hold", "act"]
  const present = keys.filter((k) => raws[k])
  const wsum = present.reduce((t, k) => t + f.weights[k], 0)
  for (const k of keys) if (!raws[k]) reasons.push(`${COMPONENTS.find((c) => c.key === k)!.name} is missing from the record; its weight is shared among the others.`)
  const totals: number[] = Array.from({ length: draws }, () => 0)
  const components: ComponentScore[] = keys.map((k) => {
    const raw = raws[k]
    if (!raw) return { key: k, raw: null, rate: null, shrunk: null, score: null, low: null, high: null, weight: 0, contribution: null }
    const kk = f.priorStrength[k]
    const pooled = ref.pooled[k]
    const shrunk = shrink(raw, pooled, kk)
    const a = raw.x + kk * pooled
    const b = Math.max(1e-3, raw.n - raw.x + kk * (1 - pooled))
    const sample = Array.from({ length: draws }, () => toScore(beta(a, b, r), ref, k)).sort((x, y) => x - y)
    const w = f.weights[k] / wsum
    // Each draw of the total uses this component's draw in rank order, a comonotone (conservative) interval.
    sample.forEach((val, i) => (totals[i] += w * val))
    const sc = toScore(shrunk, ref, k)
    return { key: k, raw, rate: raw.x / raw.n, shrunk, score: sc, low: sample[Math.floor(draws * 0.1)], high: sample[Math.floor(draws * 0.9)], weight: w, contribution: w * sc }
  })
  const value = components.reduce((t, c) => t + (c.contribution ?? 0), 0)
  totals.sort((x, y) => x - y)
  const limited = (imp ?? 0) < f.limitedImpressions
  if (limited) reasons.push(`Evidence: ${imp!.toLocaleString()} impressions.`)
  return {
    snapshotId: s.id,
    formula: f.version,
    reference: ref.id,
    status: limited ? "limited" : "scored",
    reasons,
    value,
    low: totals[Math.floor(draws * 0.1)],
    high: totals[Math.floor(draws * 0.9)],
    components,
    conditions,
  }
}

/** Spearman rank correlation, for "does this agree with a single measure". */
export function spearman(a: number[], b: number[]) {
  const rank = (xs: number[]) => {
    const idx = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0])
    const r = Array(xs.length).fill(0)
    idx.forEach(([, i], k) => (r[i] = k + 1))
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  const n = a.length
  if (n < 3) return null
  const d2 = ra.reduce((t, x, i) => t + (x - rb[i]) ** 2, 0)
  return 1 - (6 * d2) / (n * (n * n - 1))
}

export const WEIGHT_PRESETS: { id: string; label: string; weights: Record<ComponentKey, number> }[] = [
  { id: "v1", label: "Resonance 1 (25 / 40 / 35)", weights: FORMULA_V1.weights },
  { id: "equal", label: "Equal thirds", weights: { stop: 1 / 3, hold: 1 / 3, act: 1 / 3 } },
  { id: "attention", label: "Attention-heavy (40 / 50 / 10)", weights: { stop: 0.4, hold: 0.5, act: 0.1 } },
  { id: "action", label: "Action-heavy (15 / 25 / 60)", weights: { stop: 0.15, hold: 0.25, act: 0.6 } },
]
