"use client"

import * as React from "react"

import { MainBlock } from "@/components/blocks"

// A /metrics tracking tab's one block (Brendan, 2026-10-22): the tab's shorts as curve cards or as the
// table, switched from the block's three-dot menu. The searchbar, the filter and the sort hold in both
// views. The view is kept in the URL (?view=table) so a link holds it.

const VIEWS = [
  { value: "table", label: "Table View" },
  { value: "cards", label: "Card View" },
] as const
type View = (typeof VIEWS)[number]["value"]

export function TrackingBlock({ title, id, count, rows, menu, initialView, table, cards }: { title: string; id: string; count: number; rows: readonly Record<string, unknown>[]; menu: React.ReactNode; initialView: View; table: React.ReactNode; cards: React.ReactNode }) {
  const [view, setView] = React.useState<View>(initialView)
  const choose = (v: string) => {
    const next = v === "table" ? "table" : "cards"
    setView(next)
    const u = new URL(window.location.href)
    if (next === "table") u.searchParams.set("view", "table")
    else u.searchParams.delete("view")
    window.history.replaceState(window.history.state, "", u)
  }
  return (
    <MainBlock
      title={`${title} (${count})`}
      id={id}
      name={id}
      search="Search videos…"
      rows={rows}
      views={VIEWS}
      view={view}
      onView={choose}
      menuItems={menu}
      height="h-[calc(100dvh-154px)] md:h-[calc(100dvh-246px)]"
    >
      {view === "table" ? table : cards}
    </MainBlock>
  )
}
