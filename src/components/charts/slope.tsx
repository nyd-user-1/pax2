"use client"

import * as React from "react"
import Link from "next/link"

export type SlopeRow = { id: string; label: string; a: number | null; b: number | null; tone: "above" | "below" | "even" | "none" }

const COLOR = { above: "#2563eb", below: "#dc2626", even: "#94a3b8", none: "#cbd5e1" }

/** Each take from round 1 to round 2 on the same scale; lines draw in, a hover names the take. */
export function SlopeChart({ rows, left = "Round 1", right = "Round 2" }: { rows: SlopeRow[]; left?: string; right?: string }) {
  const [hover, setHover] = React.useState<string | null>(null)
  const W = 640
  const H = 360
  const pad = { t: 24, b: 28, l: 64, r: 64 }
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b)
  return (
    <div className="surface p-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {[25, 50, 75].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke={g === 50 ? "#94a3b8" : "#e2e8f0"} strokeDasharray={g === 50 ? "4 4" : undefined} />
            <text x={pad.l - 10} y={y(g) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
              {g === 50 ? "avg 50" : g}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[12px] font-medium">
          {left}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[12px] font-medium">
          {right}
        </text>
        {rows.map((r, i) => {
          const on = hover === r.id
          const dim = hover && !on
          const c = COLOR[r.tone]
          if (r.a == null && r.b != null)
            return <circle key={r.id} cx={W - pad.r} cy={y(r.b)} r={on ? 7 : 5} fill={c} opacity={dim ? 0.2 : 1} className="dot-in" style={{ ["--i" as string]: i }} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} />
          if (r.a == null || r.b == null) return null
          const len = Math.hypot(W - pad.l - pad.r, y(r.b) - y(r.a))
          return (
            <g key={r.id} opacity={dim ? 0.15 : 1} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} className="cursor-pointer transition-opacity">
              <line x1={pad.l} y1={y(r.a)} x2={W - pad.r} y2={y(r.b)} stroke={c} strokeWidth={on ? 3.5 : 2} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len} style={{ animation: `pax-draw 900ms cubic-bezier(.2,.8,.2,1) ${i * 60 + 150}ms forwards` }} />
              <line x1={pad.l} y1={y(r.a)} x2={W - pad.r} y2={y(r.b)} stroke="transparent" strokeWidth={14} />
              <circle cx={pad.l} cy={y(r.a)} r={on ? 5 : 3.5} fill={c} />
              <circle cx={W - pad.r} cy={y(r.b)} r={on ? 5 : 3.5} fill={c} />
              {on && (
                <>
                  <text x={pad.l - 10} y={y(r.a) + 4} textAnchor="end" className="fill-slate-900 text-[12px] font-semibold">
                    {r.a.toFixed(0)}
                  </text>
                  <text x={W - pad.r + 10} y={y(r.b) + 4} className="fill-slate-900 text-[12px] font-semibold">
                    {r.b.toFixed(0)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm">
        {hover ? (
          <Link href={`/v/${hover}`} scroll={false} className="font-medium text-pax-ink hover:underline">
            {rows.find((r) => r.id === hover)?.label}
          </Link>
        ) : (
          <span className="text-slate-500">Hover a line to see the take; the scale and the average never move.</span>
        )}
      </div>
      <style>{`@keyframes pax-draw { to { stroke-dashoffset: 0 } }`}</style>
    </div>
  )
}
