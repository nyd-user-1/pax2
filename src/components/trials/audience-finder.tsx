"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Check, ChevronsUpDown } from "lucide-react"

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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">Voter group</span>
        <GroupMenu value={key} onChange={setKey} options={options} />
      </div>
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

/** The house dropdown (the header's page switcher and the block menu): a pill that opens a Find… box over
 *  the groups under their dimension headings, the chosen one checked. */
function GroupMenu({ value, onChange, options }: { value: string; onChange: (k: string) => void; options: [string, { dimension: string; group: string }][] }) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [at, setAt] = React.useState<{ top: number; left: number } | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const menu = React.useRef<HTMLDivElement>(null)
  // The block's body scrolls and would clip the menu, so it opens in a portal under the pill.
  React.useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)) })
  }, [open])
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const away = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", away, true)
    window.addEventListener("resize", away)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", away, true)
      window.removeEventListener("resize", away)
    }
  }, [open])
  const needle = q.trim().toLowerCase()
  const shown = needle ? options.filter(([, o]) => `${o.group} ${o.dimension}`.toLowerCase().includes(needle)) : options
  const dims = [...new Set(shown.map(([, o]) => o.dimension))]
  const current = options.find(([k]) => k === value)?.[1]
  const pick = (k: string) => {
    onChange(k)
    setOpen(false)
    setQ("")
  }
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn("flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-3.5 pr-2.5 shadow-e1 transition-colors", open ? "bg-slate-100" : "hover:bg-slate-50")}
      >
        <span className="max-w-[220px] truncate text-sm font-medium text-slate-900">{current?.group ?? "Choose"}</span>
        {current && <span className="hidden text-xs text-slate-400 sm:inline">{current.dimension}</span>}
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </button>
      {open && at && createPortal(
        <div ref={menu} role="menu" style={{ top: at.top, left: at.left }} className="fixed z-[70] w-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-e3">
          <div className="border-b border-slate-200/70 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find…"
              aria-label="Find a voter group"
              className="w-full rounded-lg bg-pax2-mist px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="no-scrollbar max-h-80 overflow-y-auto p-1.5">
            {shown.length === 0 ? (
              <p className="px-2.5 py-3 text-sm text-slate-500">No matches.</p>
            ) : (
              dims.map((d, i) => (
                <div key={d} className={cn(i > 0 && "mt-1 border-t border-slate-200/70 pt-1")}>
                  <p className="px-2.5 pb-1 pt-1.5 text-xs text-slate-400">{d}</p>
                  {shown
                    .filter(([, o]) => o.dimension === d)
                    .map(([k, o]) => (
                      <button
                        key={k}
                        type="button"
                        role="menuitemradio"
                        aria-checked={k === value}
                        onClick={() => pick(k)}
                        className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-pax2-mist hover:text-pax2-blue", k === value ? "text-slate-900" : "text-slate-600")}
                      >
                        <span className="flex-1 truncate">{o.group}</span>
                        {k === value && <Check className="size-4 shrink-0 text-pax2-light-blue" />}
                      </button>
                    ))}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
