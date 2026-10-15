import { labVideos, standInCard, velocityCards } from "@/lib/lab"

import { moreVelocityCards, type VelocitySort } from "@/app/velocity-actions"
import { SectionTitle } from "@/components/ui-hermes"
import { VelocityGrid } from "@/components/velocity-grid"
import { VelocitySortMenu } from "@/components/velocity-sort"

export const metadata = { title: "Velocity" }
export const dynamic = "force-dynamic"

export default async function VelocityPage({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  const { v: focus, s } = await searchParams
  const sort: VelocitySort = s === "views" || s === "az" ? s : "oldest"
  const { cards: real, total } = await moreVelocityCards(0, focus, sort)
  const lab = focus && !real.some((c) => c.id === focus) ? labVideos().find((x) => x.id === focus) : undefined
  const first = [...(lab ? [standInCard(lab)] : []), ...real]
  const cards = first.length < 12 ? [...first, ...velocityCards(13).filter((c) => !first.some((r) => r.id === c.id))].slice(0, 12) : first
  return (
    <div className="flex flex-col gap-6">
      {cards.some((c) => c.hours == null) && (
        <section className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-hermes-red-soft px-2.5 py-0.5 text-xs font-semibold text-hermes-red-deep">Sample curves</span>
          <p className="text-sm text-slate-500">Curves marked Sample are stand-ins shaped by each video&apos;s real verdict and final count; real readings replace them for every short published since the watch began.</p>
        </section>
      )}

      <SectionTitle
        title="Velocity"
        className="items-center"
        action={total > 0 && (
          <div className="flex items-center gap-3">
            <span className="tabular text-sm text-slate-500">{total}</span>
            <VelocitySortMenu sort={sort} focus={focus} />
          </div>
        )}
      />

      <VelocityGrid key={sort} initial={cards} total={total} focus={focus} sort={sort} />
    </div>
  )
}
