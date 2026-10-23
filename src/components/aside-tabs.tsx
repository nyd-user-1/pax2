"use client"

import * as React from "react"

import { TabRail } from "@/components/tab-rail"

// The video page's column tabs (Brendan, 2026-10-23), on the house tab rail (the /metrics tabs): the aside
// column's A/V and Comments under the video, the wide column's Score, Analysis and Research under the Ask
// row. Every tab stays mounted, so a block keeps its state across a switch.

export function ColumnTabs({ tabs }: { tabs: { key: string; label: string; node: React.ReactNode }[] }) {
  const [tab, setTab] = React.useState(tabs[0]?.key ?? "")
  return (
    <div className="mt-5">
      <TabRail tabs={tabs.map((t) => ({ key: t.key, label: t.label, href: `#${t.key}` }))} active={tab} onSelect={setTab} />
      {tabs.map((t) => (
        <div key={t.key} hidden={tab !== t.key}>
          {t.node}
        </div>
      ))}
    </div>
  )
}
