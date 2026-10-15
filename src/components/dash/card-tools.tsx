"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, EllipsisVerticalIcon, RefreshCwIcon } from "lucide-react"

import { CardTitle } from "@/ui/components/nova/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"

// Two things every Admin card carries (Brendan, 2026-09-06): a title that
// copies its own address when clicked — the page's URL with the card's
// anchor — and the standard three-dot menu in the top right, with whatever
// control the card already had sitting to its left.

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export function CardAnchor({ children, id, className }: { children: string; id?: string; className?: string }) {
  const anchor = id ?? slug(children)
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <CardTitle id={anchor} className={cn("scroll-mt-20", className)}>
      {/* hq's copy chip (app/ui/copy-code.tsx), as Brendan asked on 2026-09-07: a
          rounded box that is plain at rest, violet on the muted ground on hover,
          and green while the link is on the clipboard. */}
      <button
        type="button"
        onClick={copy}
        title="Copy link to this card"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors select-none focus-visible:outline-1 focus-visible:outline-ring",
          // Plain at rest; the violet and the muted ground on hover; green once copied (Brendan, 2026-09-07).
          copied ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "text-foreground hover:bg-muted hover:text-violet-600 dark:hover:text-violet-300"
        )}
      >
        {children}
        {copied && <CheckIcon className="size-3.5 text-green-600" />}
      </button>
    </CardTitle>
  )
}

/** A refresh icon: re-reads the page's data on the server. */
export function RefreshButton() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  return (
    <button type="button" aria-label="Refresh" title="Refresh" onClick={() => start(() => router.refresh())} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
      <RefreshCwIcon className={cn("size-3.5", pending && "animate-spin")} />
    </button>
  )
}

function download(rows: readonly Record<string, unknown>[], name: string, kind: "csv" | "json") {
  const body =
    kind === "json"
      ? JSON.stringify(rows, null, 2)
      : [Object.keys(rows[0] ?? {}), ...rows.map((r) => Object.values(r))].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, "\"\"")}"`).join(",")).join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }))
  a.download = `${name}.${kind}`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** The card's controls: whatever it had, then the standard three-dot menu (GovBlock's ComponentActions). */
export function CardTools({
  children,
  className,
  views,
  view,
  onView,
  rows,
  name = "card",
  collapsed,
  onCollapse,
  menuItems,
}: {
  children?: React.ReactNode
  /** Extra entries for the three-dot menu (a Narrative, an Explain), after the standard ones. */
  menuItems?: React.ReactNode
  className?: string
  /** The views the card's slot can hold; the menu switches between them. */
  views?: readonly { value: string; label: string }[]
  view?: string
  onView?: (value: string) => void
  /** What Download writes. */
  rows?: readonly Record<string, unknown>[]
  name?: string
  collapsed?: boolean
  onCollapse?: () => void
}) {
  const router = useRouter()
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Card options" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground">
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-max min-w-52">
          {views && views.length > 1 && (
            <>
              <DropdownMenuRadioGroup value={view ?? ""} onValueChange={(v) => onView?.(String(v))}>
                {views.map((v) => (
                  <DropdownMenuRadioItem key={v.value} value={v.value} className="whitespace-nowrap">
                    {v.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => router.refresh()} className="whitespace-nowrap">
            Refresh
          </DropdownMenuItem>
          {onCollapse && (
            <DropdownMenuItem onClick={onCollapse} className="whitespace-nowrap">
              {collapsed ? "Expand" : "Collapse"}
            </DropdownMenuItem>
          )}
          {menuItems}
          {rows && rows.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => download(rows, name, "csv")} className="whitespace-nowrap">
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => download(rows, name, "json")} className="whitespace-nowrap">
                Download JSON
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
