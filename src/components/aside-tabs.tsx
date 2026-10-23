"use client"

import * as React from "react"

import { TabRail } from "@/components/tab-rail"

// The video page's column tabs (Brendan, 2026-10-23), on the house tab rail (the /metrics tabs): the aside
// column's A/V and Comments under the video, the wide column's Score, Analysis, Research and Notes. `top`
// sits between the rail and the panels (the wide column's Ask row) and reads the open tab through
// useColumnTab. Every tab stays mounted, so a block keeps its state across a switch.

const TabCtx = React.createContext<string | null>(null)
/** The open tab of the ColumnTabs this sits in; null outside one. */
export const useColumnTab = () => React.useContext(TabCtx)

export function ColumnTabs({ tabs, top }: { tabs: { key: string; label: string; node: React.ReactNode }[]; top?: React.ReactNode }) {
  const [tab, setTab] = React.useState(tabs[0]?.key ?? "")
  return (
    <TabCtx.Provider value={tab}>
      <div className="mt-5">
        <TabRail tabs={tabs.map((t) => ({ key: t.key, label: t.label, href: `#${t.key}` }))} active={tab} onSelect={setTab} />
        {top && <div className="mt-4">{top}</div>}
        {tabs.map((t) => (
          <div key={t.key} hidden={tab !== t.key}>
            {t.node}
          </div>
        ))}
      </div>
    </TabCtx.Provider>
  )
}
