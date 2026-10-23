"use client"

import * as React from "react"
import Link from "next/link"

import type { Test } from "@/lib/trials"
import { cn } from "@/ui/lib/utils"

// Pick a voter group; each test's videos are ranked by how far their Yes share ran above that test's
// placebo inside the group. Marked (green) where the source finds the gap at its 90% threshold.
export function AudienceFinder({ tests }: { tests: Test[] }) {
  const options = React.useMemo(() => {
    const seen = new Map<string, { dimension: string; group: string }>()
    for (const t of tests) for (const d of t.subgroups) for (const g of d.groups) seen.set(`${d.dimension}|${g.group}`, { dimension: d.dimension, group: g.group })
    return [...seen.entries()]
  }, [tests])
  const [key, setKey] = React.useState("Age|18–34")
  const [dimension, group] = key.split("|")
  const dims = [...new Set(options.map(([, o]) => o.dimension))]
  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">Voter group</span>
        <select value={key} onChange={(e) => setKey(e.target.value)} className="h-10 min-w-[16rem] rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-e1 outline-none focus:border-pax2-blue">
          {dims.map((d) => (
            <optgroup key={d} label={d}>
              {options
                .filter(([, o]) => o.dimension === d)
                .map(([k, o]) => (
                  <option key={k} value={k}>
                    {o.group}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid gap-6 md:grid-cols-2">
        {tests.map((t) => {
          const g = t.subgroups.find((d) => d.dimension === dimension)?.groups.find((x) => x.group === group)
          if (!g) return (
            <div key={t.id} className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-900">{t.label}</span>
              <p className="text-sm text-slate-500">This group was not reported in {t.label}.</p>
            </div>
          )
          const base = g.cells.placebo.v
          const ranked = t.arms.filter((a) => a.role !== "placebo").map((a) => ({ a, c: g.cells[a.id] })).sort((x, y) => y.c.v - x.c.v)
          const any = ranked.some((r) => r.c.sig)
          return (
            <div key={t.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{t.label}</span>
                <span className={cn("tabular text-xs text-slate-500", g.cells.placebo.small && "italic")}>placebo {base}% Yes</span>
              </div>
              <ul className="flex flex-col gap-2">
                {ranked.map(({ a, c }, i) => (
                  <li key={a.id} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
                    {a.youtube ? (
                      <Link href={`/v/yt-${a.youtube}`} className="truncate font-medium text-slate-800 hover:text-pax2-blue">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-slate-800">{a.name}</span>
                    )}
                    <div className="relative h-5 overflow-hidden rounded-md bg-slate-100">
                      <div className={cn("grow h-full rounded-md", c.sig ? "bg-above" : "bg-slate-300")} style={{ width: `${c.v}%`, ["--i" as string]: i }} />
                      <div className="absolute inset-y-0 w-px bg-slate-900/50" style={{ left: `${base}%` }} />
                    </div>
                    <span className={cn("tabular text-right", c.sig ? "font-semibold text-above" : "text-slate-500", c.small && "italic")}>
                      {c.v}% <span className="text-[11px] font-normal text-slate-400">{c.v - base >= 0 ? "+" : "−"}{Math.abs(c.v - base)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {!any && <p className="text-xs text-slate-500">No video in {t.label} ran above placebo in this group at the 90% threshold.</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
