"use client"

import * as React from "react"

import { Hint } from "@/components/hint"
import type { Factor, Score } from "@/lib/video-reads"
import { cn } from "@/ui/lib/utils"

// Resonance on the video page (docs/RESONANCE.md): the banded half-gauge with the stack's factors beside
// it, and the same score as a credit-report card. The needle sweeps up from zero and the number counts
// up on arrival. Pre-release, the prediction holds the needle; once the 72-hour window completes the
// measured score takes it, the prediction stays as a tick, and the center shows the signed difference.
// A factor helps when this short sits at its 50th percentile or above on it.

/** The credit-score bands, carried proportionally from the 300–850 scale onto 0–100. */
export const BANDS = [
  { name: "Poor", from: 0, to: 51, color: "#dc2626" },
  { name: "Fair", from: 51, to: 67, color: "#f97316" },
  { name: "Good", from: 67, to: 80, color: "#eab308" },
  { name: "Very good", from: 80, to: 91, color: "#84cc16" },
  { name: "Exceptional", from: 91, to: 100, color: "#16a34a" },
]
const bandOf = (v: number) => BANDS.find((b) => v >= b.from && v < b.to) ?? BANDS[BANDS.length - 1]

/** `target` reached from zero over `ms`, eased; at once under reduced motion. */
function useRise(target: number | null, ms = 1100) {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    if (target == null) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setV(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return target == null ? null : v
}

/** Hundredths: server and browser can differ in a coordinate's last digit, a hydration mismatch. */
const r2 = (v: number) => Math.round(v * 100) / 100

function arc(from: number, to: number, r: number) {
  const p = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [r2(100 + r * Math.cos(a)), r2(100 - r * Math.sin(a))]
  }
  const [x1, y1] = p(from)
  const [x2, y2] = p(to)
  return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`
}

export function ResonanceGauge({ pre, post }: { pre: number | null; post?: number | null }) {
  const final = post ?? pre
  const live = useRise(final)
  const needle = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [r2(100 + 62 * Math.cos(a)), r2(100 - 62 * Math.sin(a))]
  }
  const tick = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [r2(100 + 70 * Math.cos(a)), r2(100 - 70 * Math.sin(a)), r2(100 + 92 * Math.cos(a)), r2(100 - 92 * Math.sin(a))]
  }
  const settled = live != null && final != null && Math.abs(live - final) < 0.5
  const diff = post != null && pre != null ? Math.round(post - pre) : null
  return (
    // The score and its band sit inside the drawing, so the whole gauge scales as one to the height the
    // block gives it and stays centered in it.
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <svg viewBox="0 0 200 150" className="h-auto max-h-full w-full max-w-[560px]" role="img" aria-label="Resonance gauge">
        {BANDS.map((b) => (
          <path key={b.name} d={arc(b.from + 0.6, b.to - 0.6, 82)} fill="none" stroke={final == null ? "#e2e8f0" : b.color} strokeWidth={14} strokeDasharray={final == null ? "4 3" : undefined} />
        ))}
        {post != null && pre != null && settled && (() => {
          const [x1, y1, x2, y2] = tick(pre)
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={2} strokeDasharray="2 2" />
        })()}
        {live != null && (() => {
          const [x, y] = needle(live)
          return <line x1={100} y1={100} x2={x} y2={y} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
        })()}
        <circle cx={100} cy={100} r={diff != null && settled ? 15 : 6} fill={diff != null && settled ? "#fff" : "#0f172a"} stroke="#0f172a" strokeWidth={diff != null && settled ? 1.5 : 0} />
        {diff != null && settled && (
          <text x={100} y={101} textAnchor="middle" dominantBaseline="middle" className={cn("text-[10px] font-semibold", diff >= 0 ? "fill-above" : "fill-below")}>
            {diff > 0 ? `+${diff}` : diff}
          </text>
        )}
        {live != null && final != null ? (
          <text x={100} y={146} textAnchor="middle">
            <tspan className="tabular fill-pax2-blue font-display" fontSize={34}>{Math.round(live)}</tspan>
            <tspan dx={6} fontSize={11} fontWeight={500} fill={bandOf(final).color}>{bandOf(final).name}</tspan>
          </text>
        ) : (
          <text x={100} y={140} textAnchor="middle" fontSize={10} fill="#94a3b8">No Resonance score yet</text>
        )}
      </svg>
    </div>
  )
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`
const helps = (score: Score | null, f: Factor) => (score?.[f.key] ?? 50) >= 50

function Chip({ on }: { on: boolean }) {
  return <span className={cn("rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", on ? "bg-above-soft text-above" : "bg-below-soft text-below")}>{on ? "Helping" : "Hurting"}</span>
}

/** Beside the gauge: what the score is made of, each factor's weight and whether it helps this short. */
export function ResonanceFactors({ score, factors }: { score: Score | null; factors: Factor[] }) {
  if (!factors.length) return null
  return (
    <ul className="flex w-full flex-col divide-y divide-slate-100">
      {factors.map((f) => (
        <li key={f.key} className="flex items-center gap-3 py-3">
          <Hint text={`${f.name}: ${f.about}. This short sits at the ${ordinal(Math.round(score?.[f.key] ?? 0))} percentile of the baseline on it.`}>
            <span className="text-[15px] text-slate-800">{f.name}</span>
          </Hint>
          <span className="tabular ml-auto text-[15px] text-slate-500">{Math.round(f.share * 100)}%</span>
          {score?.[f.key] != null && <Chip on={helps(score, f)} />}
        </li>
      ))}
    </ul>
  )
}

/** The credit-report card: the score and its band on navy, the band bar, then the factors helping and
 *  hurting it. The card reads the prediction, since the factors are what the prediction is made of. */
export function ResonanceCard({ score, factors }: { score: Score; factors: Factor[] }) {
  const v = useRise(score.pre) ?? 0
  const u = useRise(score.post ?? null)
  const band = bandOf(score.pre)
  // The stretch between the two scores: green from the prediction up to the measured score, light red
  // from the measured score up to the prediction when it fell short. Both rise together.
  const gap = u == null ? null : u >= v ? { lo: v, hi: u, color: "#16a34a" } : { lo: u, hi: v, color: "#fca5a5" }
  const sorted = [...factors].sort((a, b) => Number(helps(score, a)) - Number(helps(score, b)))
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex flex-col gap-4 bg-pax2-blue px-6 py-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Resonance</span>
            <span className="tabular font-display text-6xl leading-none">{Math.round(v)}</span>
          </div>
          {score.post != null && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">72hrs</span>
              <span className="tabular font-display text-6xl leading-none">{Math.round(u ?? score.post)}</span>
            </div>
          )}
        </div>
        <span className="flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
          <span className="size-2 rounded-full" style={{ background: band.color }} />
          {band.name}
        </span>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            {BANDS.map((b) => {
              const fill = Math.max(0, Math.min(1, (v - b.from) / (b.to - b.from)))
              return (
                <div key={b.name} className="relative h-1.5 overflow-hidden rounded-full bg-white/85" style={{ flex: b.to - b.from }}>
                  <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: band.color }} />
                  {gap && Math.min(gap.hi, b.to) > Math.max(gap.lo, b.from) && (
                    <div
                      className="absolute inset-y-0"
                      style={{ left: `${((Math.max(gap.lo, b.from) - b.from) / (b.to - b.from)) * 100}%`, width: `${((Math.min(gap.hi, b.to) - Math.max(gap.lo, b.from)) / (b.to - b.from)) * 100}%`, background: gap.color }}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="tabular flex text-xs font-semibold text-white/85">
            {BANDS.map((b, i) => (
              <span key={b.name} style={{ flex: b.to - b.from }} className="flex justify-between">
                <span>{b.from}</span>
                {i === BANDS.length - 1 && <span>100</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-slate-100 bg-white">
        {sorted.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-4 px-6 py-3.5">
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold text-slate-900">{f.name}</span>
              <span className="text-xs text-slate-500">{f.about}</span>
            </span>
            {score[f.key] != null && <Chip on={helps(score, f)} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
