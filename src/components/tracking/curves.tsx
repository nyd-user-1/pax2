import Link from "next/link"

import { labVideos, standInCard, velocityCards } from "@/lib/lab"
import { CURVE_TIER } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

import { moreVelocityCards, type VelocityFilter, type VelocitySort } from "@/app/velocity-actions"
import { SectionTitle } from "@/components/ui-pax2"
import { VelocityGrid } from "@/components/velocity-grid"
import { VelocitySortMenu } from "@/components/velocity-sort"

// The Curves tab of /tracking: each short's views over its 72 hours, focusable from the Settled tab.

const FILTERS: { value: VelocityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "breakout", label: CURVE_TIER.breakout.label },
  { value: "baseline", label: CURVE_TIER.baseline.label },
  { value: "killed", label: CURVE_TIER.killed.label },
]

export async function CurvesTab({ focus, s, f }: { focus?: string; s?: string; f?: string }) {
  const sort: VelocitySort = s === "views" || s === "az" ? s : "oldest"
  const filter: VelocityFilter = f === "breakout" || f === "baseline" || f === "killed" ? f : "all"
  const { cards: real, total } = await moreVelocityCards(0, focus, sort, filter)
  const lab = focus && !real.some((c) => c.id === focus) ? labVideos().find((x) => x.id === focus) : undefined
  const first = [...(lab ? [standInCard(lab)] : []), ...real]
  const cards = filter === "all" && first.length < 12 ? [...first, ...velocityCards(13).filter((c) => !first.some((r) => r.id === c.id))].slice(0, 12) : first
  const href = (value: VelocityFilter) => {
    const q = new URLSearchParams({ tab: "curves" })
    if (focus) q.set("v", focus)
    if (sort !== "oldest") q.set("s", sort)
    if (value !== "all") q.set("f", value)
    return `/tracking?${q.toString()}`
  }
  return (
    <div className="flex flex-col gap-6">
      {cards.some((c) => c.hours == null) && (
        <section className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-pax2-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax2-red-deep">Sample curves</span>
          <p className="text-sm text-slate-500">Curves marked Sample are stand-ins shaped by each video&apos;s real verdict and final count; real readings replace them for every short published since the watch began.</p>
        </section>
      )}

      <SectionTitle
        title="Velocity"
        className="items-center"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              {FILTERS.map((x) => (
                <Link
                  key={x.value}
                  href={href(x.value)}
                  replace
                  scroll={false}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-shadow",
                    x.value === filter ? (x.value === "all" ? "bg-slate-900 text-white" : CURVE_TIER[x.value].chip) : "bg-white text-slate-600 shadow-e1 hover:shadow-e2"
                  )}
                >
                  {x.label}
                </Link>
              ))}
            </span>
            <span className="tabular text-sm text-slate-500">{total}</span>
            <VelocitySortMenu sort={sort} focus={focus} filter={filter} />
          </div>
        }
      />

      <VelocityGrid key={`${sort}-${filter}`} initial={cards} total={total} focus={focus} sort={sort} filter={filter} />
    </div>
  )
}
