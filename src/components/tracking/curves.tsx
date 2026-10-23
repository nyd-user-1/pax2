import { moreVelocityCards, velocityOrder, type VelocityFilter, type VelocitySort } from "@/app/velocity-actions"
import { VelocityGrid } from "@/components/velocity-grid"
import { VelocityMenuItems } from "@/components/tracking/velocity-menu"

// A /metrics tracking tab's card view: the 72-hour curve of every short in the tab's own table, from the
// poller's real readings only. The outcome filter and the sort live in the block's three-dot menu, and
// `order` carries them to the table view.

export async function velocityCards({ tab, id, ids, s, f }: { tab: "live" | "complete"; id: string; ids: string[]; s?: string; f?: string }) {
  const sort: VelocitySort = s === "views" || s === "az" ? s : "oldest"
  const filter: VelocityFilter = f === "breakout" || f === "baseline" || f === "killed" ? f : "all"
  const [{ cards, total }, order] = await Promise.all([moreVelocityCards(0, undefined, sort, filter, ids), velocityOrder(sort, filter, ids)])
  return {
    total,
    order,
    menu: <VelocityMenuItems tab={tab === "live" ? undefined : tab} id={id} sort={sort} filter={filter} />,
    node: total === 0 ? <p className="py-8 text-center text-sm text-slate-400">No curves here yet.</p> : <VelocityGrid key={`${sort}-${filter}`} initial={cards} total={total} sort={sort} filter={filter} ids={ids} />,
  }
}
