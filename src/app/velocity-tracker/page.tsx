import Link from "next/link"

import { fmtCompact, velocityCards, type Tier, type VelocityCard } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Velocity" }

const TIER: Record<Tier, { label: string; chip: string; line: string }> = {
  breakout: { label: "Passed explore", chip: "bg-above-soft text-above", line: "#16a34a" },
  baseline: { label: "Served and settled", chip: "bg-slate-100 text-slate-500", line: "#94a3b8" },
  killed: { label: "Killed in explore", chip: "bg-below-soft text-below", line: "#dc2626" },
}

function Curve({ card }: { card: VelocityCard }) {
  const max = Math.max(...card.points, 1)
  const W = 280
  const H = 72
  const pts = card.points.map((p, i) => `${(i / 72) * W},${H - (p / max) * (H - 6)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={`First 72 hours of ${card.title}`}>
      <polyline points={pts} fill="none" stroke={TIER[card.tier].line} strokeWidth="2.25" strokeLinecap="round" className="grow-svg" />
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

export default function VelocityPage() {
  const cards = velocityCards(12)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-pax-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax-red-deep">Sample curves</span>
        <p className="text-sm text-slate-500">The poller isn&apos;t running yet; each curve is a stand-in shaped by the video&apos;s real verdict and real final count. Hourly pulls from the YouTube Data API replace these the day it starts.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.id} href={`/v/yt-${c.id}`} className="surface lift flex flex-col gap-2.5 p-5">
            <span className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{c.title}</span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", TIER[c.tier].chip)}>{TIER[c.tier].label}</span>
            </span>
            <Curve card={c} />
            <span className="tabular flex items-center justify-between text-xs text-slate-500">
              <span>{c.channel}</span>
              <span>{fmtCompact(c.views)} views to date</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="surface flex flex-col gap-2 p-5">
        <p className="text-sm font-semibold text-slate-900">What the poller needs the day it turns on</p>
        <ul className="flex flex-col gap-1.5 text-sm text-slate-600">
          <li>A YouTube Data API key on the free quota; one videos.list call per channel per hour is about 360 units a day against the 10,000 daily allowance.</li>
          <li>A 72-hour watch on every new upload across the five reform channels, writing one row per video per hour.</li>
          <li>Nothing else. No ad spend, no new storage class; a few kilobytes of counts a day.</li>
        </ul>
      </section>
    </div>
  )
}
