"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/ui/lib/utils"

// The thin tab rail, ported from Leuk's portal Tabs: underline tabs, a ghost wash on hover, and one
// blue rail that slides to the hovered tab and rests under the selected one. Tabs are links (a route,
// or the same route with ?tab=), so the selected tab survives a reload and a shared link.

export type RailTab = { key: string; label: string; href: string; count?: number; disabled?: boolean }

export function TabRail({ tabs, active, trailing, className }: { tabs: RailTab[]; active?: string; trailing?: React.ReactNode; className?: string }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const here = `${pathname}${search.size ? `?${search}` : ""}`
  const activeKey = active ?? tabs.find((t) => t.href === here || t.href === pathname)?.key ?? null
  const els = React.useRef<Record<string, HTMLElement | null>>({})
  const [hover, setHover] = React.useState<{ left: number; width: number } | null>(null)
  const [rest, setRest] = React.useState<{ left: number; width: number } | null>(null)

  React.useEffect(() => {
    const measure = () => {
      const el = activeKey ? els.current[activeKey] : null
      setRest(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [activeKey])

  const rail = hover ?? rest
  return (
    <div role="tablist" className={cn("no-scrollbar relative flex gap-1 overflow-x-auto border-b border-slate-200", className)} onMouseLeave={() => setHover(null)}>
      {tabs.map((t) => {
        const on = t.key === activeKey
        const cls = cn(
          "relative z-10 -mb-px inline-flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-3 pt-1.5 pb-2.5 text-[15px] font-medium outline-none transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-hermes-plum/40",
          on ? "text-hermes-plum" : t.disabled ? "cursor-default text-slate-300" : "text-slate-600 hover:bg-hermes-plum/5 hover:text-slate-900",
        )
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && <span className={cn("tabular rounded-full bg-slate-100 px-1.5 text-[13px]", on ? "text-hermes-plum" : "text-slate-500")}>{t.count.toLocaleString("en-US")}</span>}
          </>
        )
        if (t.disabled)
          return (
            <span key={t.key} role="tab" aria-selected={false} aria-disabled className={cls}>
              {inner}
            </span>
          )
        return (
          <Link
            key={t.key}
            ref={(el) => {
              els.current[t.key] = el
            }}
            href={t.href}
            scroll={false}
            role="tab"
            aria-selected={on}
            className={cls}
            onMouseEnter={(e) => setHover({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth })}
          >
            {inner}
          </Link>
        )
      })}
      {trailing && <div className="ml-auto flex items-center gap-2 pb-1.5">{trailing}</div>}
      {rail && <span aria-hidden className="pointer-events-none absolute bottom-0 z-0 h-0.5 rounded-full bg-hermes-plum transition-all duration-200 ease-out" style={{ left: rail.left, width: rail.width }} />}
    </div>
  )
}
