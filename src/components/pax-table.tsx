"use client"

import * as React from "react"
import { EllipsisVertical, Search } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"

/** The table card: a search bar with the utilities kebab, a pinned column
 *  header, and rows that scroll beneath both. One scroll container owns all of
 *  it — the bar sticks at 0, the header sticks just below at the bar's
 *  measured height. */
export function PaxTable({ label, children, className, maxH = "max-h-[72vh]", value, onChange }: { label?: string; children: React.ReactNode; className?: string; maxH?: string; value?: string; onChange?: (v: string) => void }) {
  const box = React.useRef<HTMLDivElement>(null)
  const bar = React.useRef<HTMLDivElement>(null)
  const [own, setOwn] = React.useState("")
  // Controlled when the table already filters its own rows in state.
  const q = onChange ? (value ?? "") : own
  const setQ = onChange ?? setOwn
  const [barH, setBarH] = React.useState(53)

  React.useEffect(() => {
    const el = bar.current
    if (!el) return
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The search filters whatever rows are on the card — no per-table wiring.
  // Runs after every render so freshly-streamed rows respect the live query.
  React.useEffect(() => {
    if (onChange) return
    const root = box.current
    if (!root) return
    const needle = q.trim().toLowerCase()
    for (const tr of root.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
      tr.style.display = !needle || (tr.textContent ?? "").toLowerCase().includes(needle) ? "" : "none"
    }
  })

  const csv = () => {
    const root = box.current
    if (!root) return
    const rows = [...root.querySelectorAll<HTMLTableRowElement>("tr")].filter((tr) => tr.style.display !== "none")
    const text = rows.map((tr) => [...tr.cells].map((c) => `"${(c.textContent ?? "").trim().replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
    a.download = `${(label ?? "table").toLowerCase().replace(/\s+/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div
      ref={box}
      style={{ "--bar-h": `${barH}px` } as React.CSSProperties}
      className={cn(
        "surface overflow-auto rounded-2xl p-0",
        maxH,
        "[&_[data-slot=table-container]]:overflow-visible",
        "[&_thead]:sticky [&_thead]:top-[var(--bar-h)] [&_thead]:z-10 [&_thead]:bg-white",
        className,
      )}
    >
      <div ref={bar} className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200/70 bg-white px-4 py-2">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={label ? `Search ${label.toLowerCase()}…` : "Search…"}
          aria-label={label ? `Search ${label}` : "Search table"}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Table options" className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-pax-ink">
            <EllipsisVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={csv}>Download CSV</DropdownMenuItem>
            {q !== "" && <DropdownMenuItem onClick={() => setQ("")}>Clear search</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  )
}
