import { moreVelocityCards, type VelocityFilter, type VelocitySort } from "@/app/velocity-actions"
import { CardBlock } from "@/components/blocks"
import { VelocityGrid } from "@/components/velocity-grid"
import { VelocityMenuItems } from "@/components/tracking/velocity-menu"

// A /tracking tab's Velocity block: the 72-hour curve of every short in the tab's own table, from the
// poller's real readings only; the outcome filter and the sort live in the block's three-dot menu.

export async function VelocityBlock({ tab, title, id, ids, s, f }: { tab: "live" | "complete"; title: string; id: string; ids: string[]; s?: string; f?: string }) {
  const sort: VelocitySort = s === "views" || s === "az" ? s : "oldest"
  const filter: VelocityFilter = f === "breakout" || f === "baseline" || f === "killed" ? f : "all"
  const { cards, total } = await moreVelocityCards(0, undefined, sort, filter, ids)
  const query = tab === "live" ? undefined : tab
  return (
    <CardBlock
      title={`${title} (${total})`}
      id={id}
      name={id}
      height="auto"
      menuItems={<VelocityMenuItems tab={query} id={id} sort={sort} filter={filter} />}
    >
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No curves here yet.</p>
      ) : (
        <VelocityGrid key={`${sort}-${filter}`} initial={cards} total={total} sort={sort} filter={filter} ids={ids} />
      )}
    </CardBlock>
  )
}
