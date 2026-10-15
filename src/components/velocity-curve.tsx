"use client"

import Link from "next/link"
import { useRef, useState } from "react"

import type { VelocityCard } from "@/lib/lab"
import { CURVE_TIER, fmtCompact } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

// A short's first 72 hours against its channel's own median: the curve on a ratio scale with
// dotted guides at .5x, 1x and 3x, and a readout under the pointer. The drawing is 16:9 to fill
// the card's media box edge to edge; strokes are non-scaling so the line stays 2px at any card
// width. Stand-ins have no median and draw on their own absolute scale, without guides.

export { CURVE_TIER }

const W = 320
const H = 180
const TOP = 14
const BASE = 158

type Pt = { x: number; y: number; h: number; views: number; ratio: number | null }

const r1 = (n: number) => Math.round(n * 10) / 10
const rx = (r: number) => `${(r >= 10 ? r.toFixed(0) : r.toFixed(1)).replace(/^0\./, ".")}x`

export function Curve({ card }: { card: VelocityCard }) {
  const [hover, setHover] = useState<Pt | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tier = CURVE_TIER[card.tier]
  const med = card.median ?? null
  const from = card.start ?? 0
  const raw: [number, number][] = card.series ?? card.points.slice(from).map((v, i) => [from + i, v])
  if (raw.length === 0) return null
  const top = med ? Math.max(...raw.map(([, v]) => v / med), 3.3) : Math.max(...raw.map(([, v]) => v), 1)
  const yOf = (v: number) => BASE - ((med ? v / med : v) / top) * (BASE - TOP)
  const pts: Pt[] = raw.map(([h, v]) => ({ x: (h / 72) * W, y: yOf(v), h, views: v, ratio: med ? v / med : null }))
  const line = pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")
  const area = `${line} ${r1(pts.at(-1)!.x)},${BASE} ${r1(pts[0].x)},${BASE}`
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
    <div className="relative h-full" onPointerLeave={() => setHover(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label={`First 72 hours of ${card.title}`} onPointerMove={move}>
        {guides.map(([g, label]) => (
          <g key={label}>
            <line x1={0} x2={W} y1={r1(yOf(g * (med as number)))} y2={r1(yOf(g * (med as number)))} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            <text x={W - 4} y={r1(yOf(g * (med as number))) - 3} textAnchor="end" fontSize="8" fill="#94a3b8" className="tabular">{label}</text>
          </g>
        ))}
        <polygon points={area} fill={tier.line} opacity="0.07" className="grow-svg" />
        <polyline points={line} fill="none" stroke={tier.line} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="grow-svg" />
        <circle cx={r1(end.x)} cy={r1(end.y)} r="3" fill={tier.line} />
        {card.inflection != null && (
          <circle cx={(card.inflection / 72) * W} cy={r1(yOf(card.points[card.inflection]))} r="3.5" fill="#1e3a8a">
            <title>{`Exploit push begins near hour ${card.inflection}`}</title>
          </circle>
        )}
        {[0, 24, 48, 72].map((h) => (
          <text key={h} x={h === 0 ? 2 : h === 72 ? W - 2 : (h / 72) * W} y={H - 8} textAnchor={h === 0 ? "start" : h === 72 ? "end" : "middle"} fontSize="9" fill="#94a3b8" className="tabular">{h}h</text>
        ))}
        {hover && <line x1={hover.x} x2={hover.x} y1={TOP - 4} y2={BASE} stroke="#94a3b8" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {hover && <circle cx={hover.x} cy={hover.y} r="3.5" fill="#fff" stroke={tier.line} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover && (
        <div
          className="tabular pointer-events-none absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] text-slate-700 shadow-e1 ring-1 ring-slate-200"
          style={{ left: `${Math.min(84, Math.max(16, (hover.x / W) * 100))}%` }}
        >
          {Math.floor(hover.h)}h · {fmtCompact(hover.views)} views{hover.ratio != null && ` · ${rx(hover.ratio)}`}
        </div>
      )}
    </div>
  )
}

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

// On the media box the verdict chips go solid - red and green carry white, gray keeps black ink.
const MEDIA_CHIP: Record<VelocityCard["tier"], string> = {
  breakout: "bg-[#16a34a] text-white",
  baseline: "bg-slate-100 text-slate-900",
  killed: "bg-[#dc2626] text-white",
}

/** One short's curve card, patterned on the home feed's LandscapeCard: the bare rounded media box
 *  with the chip overlaid, the curve filling the box under the pointer, then title and the channel
 *  line below. The chip carries the video's actual ratio; its color carries the band. On the
 *  tracker it links to the video; on the video page it stands alone. */
export function CurveCard({ c, href, focused = false }: { c: VelocityCard; href?: string; focused?: boolean }) {
  const body = (
    <>
      <span className={cn("curve-media relative block overflow-hidden rounded-xl bg-slate-200", focused && "ring-2 ring-hermes-plum")}>
        <img src={thumb(c.id)} alt="" loading="lazy" className="aspect-video w-full object-cover transition-opacity duration-200 group-hover:opacity-0" />
        <span className="curve-chart absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Curve card={c} />
        </span>
        <span className="absolute right-2 top-2">
          {c.hours != null && c.hours < 72 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-hermes-lavender px-2.5 py-0.5 text-xs font-semibold text-hermes-ink shadow-sm"><span className="size-1.5 animate-pulse rounded-full bg-hermes-ink" />Watching · {Math.floor(c.hours)}h</span>
          ) : (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm", c.hours == null ? "bg-hermes-red-soft text-hermes-red-deep" : MEDIA_CHIP[c.tier])}>{c.hours == null ? "Sample" : c.median != null ? rx(c.views / c.median) : CURVE_TIER[c.tier].label}</span>
          )}
        </span>
      </span>
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{c.title}</p>
      <p className="tabular text-xs text-slate-500">
        {c.channel} · {fmtCompact(c.views)} views{c.median != null && ` · median ${fmtCompact(c.median)}`}
      </p>
    </>
  )
  const cls = cn("group flex flex-col gap-2", href && "relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-black/10 before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100")
  return href ? (
    <Link id={`yt-${c.id}`} href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
