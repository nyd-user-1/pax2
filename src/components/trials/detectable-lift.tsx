"use client"

import * as React from "react"

// The smallest lift a two-arm test reliably detects: a gap in the share saying Yes between a video arm and
// the placebo, at the source's 90% threshold (two-sided, z 1.645) with 80% power (z 0.842), at a 50% share,
// where the variance is largest. Weighting's design effect is ignored, so the real figure is somewhat larger.
const Z = 1.645 + 0.842
const mde = (n: number) => Z * Math.sqrt((2 * 0.25) / n) * 100
const needed = (pts: number) => Math.ceil((2 * 0.25 * Z * Z) / (pts / 100) ** 2)

export function DetectableLift({ armN }: { armN: number }) {
  const [n, setN] = React.useState(armN)
  const [target, setTarget] = React.useState(5)
  const presets = [
    { label: "Whole arm", n: armN },
    { label: "Half the arm (men, women)", n: Math.round(armN / 2) },
    { label: "A third (an age band)", n: Math.round(armN / 3) },
    { label: "A tenth (a small group)", n: Math.round(armN / 10) },
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-600">Respondents per arm in the group</span>
          <span className="tabular text-sm font-semibold text-slate-900">{n.toLocaleString()}</span>
        </div>
        <input type="range" min={25} max={3000} step={25} value={n} onChange={(e) => setN(+e.target.value)} className="w-full accent-[var(--pax2-blue)]" aria-label="Respondents per arm" />
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => setN(p.n)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-pax2-light-blue hover:text-pax2-blue">
              {p.label} · {p.n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-baseline gap-3 rounded-xl bg-slate-50 p-4">
        <span className="tabular font-display text-4xl text-slate-900">{mde(n).toFixed(1)}</span>
        <span className="text-sm text-slate-600">points: the smallest lift over placebo detected 80% of the time</span>
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-600">To detect a lift of</span>
          <span className="tabular text-sm font-semibold text-slate-900">{target} points</span>
        </div>
        <input type="range" min={2} max={20} step={1} value={target} onChange={(e) => setTarget(+e.target.value)} className="w-full accent-[var(--pax2-blue)]" aria-label="Target lift" />
        <p className="text-sm text-slate-700">
          needs <span className="tabular font-semibold text-slate-900">{needed(target).toLocaleString()}</span> respondents per arm inside the group.
        </p>
      </div>
    </div>
  )
}
