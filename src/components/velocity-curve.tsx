import Link from "next/link"

import { fmtCompact, type Tier, type VelocityCard } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

// A short's first 72 hours: cumulative views, the dot where the exploit push begins. Shared by
// /velocity-tracker and the video page (moved out of the tracker 2026-10-08).

export const CURVE_TIER: Record<Tier, { label: string; chip: string; line: string }> = {
  breakout: { label: "Above 3× median", chip: "bg-above-soft text-above", line: "#16a34a" },
  baseline: { label: "0.5–3× median", chip: "bg-slate-100 text-slate-500", line: "#94a3b8" },
  killed: { label: "Below 0.5× median", chip: "bg-below-soft text-below", line: "#dc2626" },
}

export function Curve({ card }: { card: VelocityCard }) {
  const from = card.start ?? 0
  const max = Math.max(...(card.series ? card.series.map(([, v]) => v) : card.points.slice(from)), 1)
  const W = 280
  const H = 72
  const pts = card.series
    ? card.series.map(([h, v]) => `${(h / 72) * W},${H - (v / max) * (H - 6)}`).join(" ")
    : card.points.map((p, i) => `${(i / 72) * W},${H - (p / max) * (H - 6)}`).slice(from).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={`First 72 hours of ${card.title}`}>
      <polyline points={pts} fill="none" stroke={CURVE_TIER[card.tier].line} strokeWidth="2.25" strokeLinecap="round" className="grow-svg" />
      {card.inflection != null && (
        <circle cx={(card.inflection / 72) * W} cy={H - (card.points[card.inflection] / max) * (H - 6)} r="3.5" fill="#1e3a8a">
          <title>{`Exploit push begins near hour ${card.inflection}`}</title>
        </circle>
      )}
      {[0, 24, 48, 72].map((h) => (
        <text key={h} x={(h / 72) * W} y={H + 12} textAnchor={h === 0 ? "start" : h === 72 ? "end" : "middle"} fontSize="9.5" fill="#94a3b8" className="tabular">{h}h</text>
      ))}
    </svg>
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
