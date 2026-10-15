"use client"

import Link from "next/link"
import { useRef, useState } from "react"

import type { VelocityCard } from "@/lib/lab"
import { CURVE_TIER, fmtCompact } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

// A short's first 72 hours against its channel's own median: the curve on a ratio scale with
// dotted guides at .5x, 1x and 3x, and a readout under the pointer. Stand-ins have no median
// and draw on their own absolute scale, without guides. Shared by /velocity-tracker and the
// video page (moved out of the tracker 2026-10-08).

export { CURVE_TIER }

const W = 280
const H = 72
const PAD = 6

type Pt = { x: number; y: number; h: number; views: number; ratio: number | null }

const r1 = (n: number) => Math.round(n * 10) / 10
const rx = (r: number) => `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}x`

export function Curve({ card }: { card: VelocityCard }) {
  const [hover, setHover] = useState<Pt | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tier = CURVE_TIER[card.tier]
  const med = card.median ?? null
  const from = card.start ?? 0
  const raw: [number, number][] = card.series ?? card.points.slice(from).map((v, i) => [from + i, v])
  if (raw.length === 0) return null
  const top = med ? Math.max(...raw.map(([, v]) => v / med), 3.3) : Math.max(...raw.map(([, v]) => v), 1)
  const yOf = (v: number) => H - ((med ? v / med : v) / top) * (H - PAD)
  const pts: Pt[] = raw.map(([h, v]) => ({ x: (h / 72) * W, y: yOf(v), h, views: v, ratio: med ? v / med : null }))
  const line = pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")
  const area = `${line} ${r1(pts.at(-1)!.x)},${H} ${r1(pts[0].x)},${H}`
  const end = pts.at(-1)!
  const guides = med ? ([[0.5, ".5x"], [1, "1x"], [3, "3x"]] as const).filter(([g]) => g <= top) : []
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = pts[0]
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
    setHover(best)
  }
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={`First 72 hours of ${card.title}`} onPointerMove={move}>
        {guides.map(([g, label]) => (
          <g key={label}>
            <line x1={0} x2={W} y1={r1(yOf(g * (med as number)))} y2={r1(yOf(g * (med as number)))} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 4" />
            <text x={W} y={r1(yOf(g * (med as number))) - 2.5} textAnchor="end" fontSize="8.5" fill="#94a3b8" className="tabular">{label}</text>
          </g>
        ))}
        <polygon points={area} fill={tier.line} opacity="0.07" className="grow-svg" />
        <polyline points={line} fill="none" stroke={tier.line} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="grow-svg" />
        <circle cx={r1(end.x)} cy={r1(end.y)} r="3" fill={tier.line} />
        {card.inflection != null && (
          <circle cx={(card.inflection / 72) * W} cy={r1(yOf(card.points[card.inflection]))} r="3.5" fill="#1e3a8a">
            <title>{`Exploit push begins near hour ${card.inflection}`}</title>
          </circle>
        )}
        {[0, 24, 48, 72].map((h) => (
          <text key={h} x={(h / 72) * W} y={H + 12} textAnchor={h === 0 ? "start" : h === 72 ? "end" : "middle"} fontSize="9.5" fill="#94a3b8" className="tabular">{h}h</text>
        ))}
        {hover && <line x1={hover.x} x2={hover.x} y1={PAD - 2} y2={H} stroke="#94a3b8" strokeWidth="1" />}
        {hover && <circle cx={hover.x} cy={hover.y} r="3.5" fill="#fff" stroke={tier.line} strokeWidth="2" />}
      </svg>
      {hover && (
        <div
          className="tabular pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] text-slate-700 shadow-e1 ring-1 ring-slate-200"
          style={{ left: `${Math.min(88, Math.max(12, (hover.x / W) * 100))}%` }}
        >
          {Math.floor(hover.h)}h · {fmtCompact(hover.views)} views{hover.ratio != null && ` · ${rx(hover.ratio)}`}
        </div>
      )}
    </div>
  )
}

/** One short's curve card, as the velocity tracker shows it: title and verdict, the curve, channel and
 *  views. On the tracker it links to the video; on the video page it stands alone. */
export function CurveCard({ c, href, focused = false }: { c: VelocityCard; href?: string; focused?: boolean }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{c.title}</span>
        {c.hours != null && c.hours < 72 ? (
          <span className="shrink-0 rounded-full bg-hermes-lavender px-2.5 py-0.5 text-xs font-semibold text-hermes-ink">Watching · {Math.floor(c.hours)}h</span>
        ) : (
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", c.hours == null ? "bg-hermes-red-soft text-hermes-red-deep" : CURVE_TIER[c.tier].chip)}>{c.hours == null ? "Sample" : CURVE_TIER[c.tier].label}</span>
        )}
      </span>
      <Curve card={c} />
      <span className="tabular flex items-center justify-between text-xs text-slate-500">
        <span>{c.channel}</span>
        <span>{fmtCompact(c.views)} views to date</span>
      </span>
    </>
  )
  const cls = cn("surface flex flex-col gap-2.5 p-5", href && "lift", focused && "ring-2 ring-hermes-plum")
  return href ? (
    <Link id={`yt-${c.id}`} href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
