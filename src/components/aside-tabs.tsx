"use client"

import * as React from "react"

import { TabRail } from "@/components/tab-rail"

// The video page's aside column under the video (Brendan, 2026-10-23), on the house tab rail (the /metrics
// tabs): A/V holds Audio, Channel, Tags and Comps; Comments holds the comments. Both stay mounted, so a
// thread keeps its state across a switch.

const TABS = [
  { key: "av", label: "A/V", href: "#av" },
  { key: "comments", label: "Comments", href: "#comments" },
]

export function AsideTabs({ av, comments }: { av: React.ReactNode; comments: React.ReactNode }) {
  const [tab, setTab] = React.useState("av")
  return (
    <div className="mt-5">
      <TabRail tabs={TABS} active={tab} onSelect={setTab} />
      <div hidden={tab !== "av"}>{av}</div>
      <div hidden={tab !== "comments"}>{comments}</div>
    </div>
  )
}
