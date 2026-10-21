"use client"

import { useRouter } from "next/navigation"
import { ArrowUpDown, Filter } from "lucide-react"

import type { VelocityFilter, VelocitySort } from "@/app/velocity-actions"
import { MenuFlyout, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { SORTS } from "@/components/velocity-sort"
import { CURVE_TIER } from "@/lib/velocity-meta"

// A Velocity block's filter and sort, as two flyouts in the block's three-dot menu (they used to sit as
// chips and a button in its header). Each choice rewrites the URL, as the chips did, and the page renders.

const FILTERS: { value: VelocityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "breakout", label: CURVE_TIER.breakout.label },
  { value: "baseline", label: CURVE_TIER.baseline.label },
  { value: "killed", label: CURVE_TIER.killed.label },
]

export function VelocityMenuItems({ tab, id, sort, filter }: { tab?: string; id: string; sort: VelocitySort; filter: VelocityFilter }) {
  const router = useRouter()
  const go = (s: VelocitySort, f: VelocityFilter) => {
    const q = new URLSearchParams(tab ? { tab } : {})
    if (s !== "oldest") q.set("s", s)
    if (f !== "all") q.set("f", f)
    const qs = q.toString()
    router.replace(`/tracking${qs ? `?${qs}` : ""}#${id}`, { scroll: false })
  }
  return (
    <>
      <MenuSeparator />
      <MenuFlyout id="filter" icon={<Filter />} label="Filter" hint={FILTERS.find((x) => x.value === filter)?.label}>
        {FILTERS.map((x) => (
          <MenuRow key={x.value} label={x.label} checked={x.value === filter} onClick={() => go(sort, x.value)} />
        ))}
      </MenuFlyout>
      <MenuFlyout id="sort" icon={<ArrowUpDown />} label="Sort" hint={SORTS.find((x) => x.value === sort)?.label}>
        {SORTS.map((x) => (
          <MenuRow key={x.value} label={x.label} checked={x.value === sort} onClick={() => go(x.value, filter)} />
        ))}
      </MenuFlyout>
      <MenuSeparator />
    </>
  )
}
