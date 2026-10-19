"use client"

import * as React from "react"

import { cn } from "@/ui/lib/utils"

export type PunchItem = { item: string; done: boolean }

/** The punch list's rows: a checkbox at the head of each, a strike through the text once checked.
 *  Checks persist per list in this browser; the list's `done` flags seed the first visit. */
export function PunchlistRows({ items, storageKey }: { items: PunchItem[]; storageKey: string }) {
  const [checked, setChecked] = React.useState(() => items.map((p) => p.done))
  React.useEffect(() => {
    try {
      const kept = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as unknown
      if (Array.isArray(kept) && kept.length === items.length && kept.every((v) => typeof v === "boolean")) setChecked(kept as boolean[])
    } catch {}
  }, [storageKey, items.length])
  const toggle = (i: number) =>
    setChecked((c) => {
      const next = [...c]
      next[i] = !next[i]
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}
      return next
    })
  return (
    <div className="flex flex-col divide-y divide-slate-100">
      {items.map((p, i) => (
        <label key={p.item} data-find className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
          <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} className="size-4 shrink-0 cursor-pointer accent-pax2-blue" />
          <span className={cn("text-slate-800 transition-colors", checked[i] && "text-slate-400 line-through")}>{p.item}</span>
        </label>
      ))}
    </div>
  )
}
