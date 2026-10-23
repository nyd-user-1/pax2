"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CheckIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, CopyIcon, DownloadIcon, EllipsisVerticalIcon, LayoutGridIcon, LayoutListIcon, MessagesSquareIcon, PinIcon, RefreshCwIcon, StarIcon } from "lucide-react"

import { CardTitle } from "@/ui/components/nova/card"
import { usePinTop } from "@/components/dash/block-order"
import { KebabMenu, MenuFlyout, MenuFoot, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { useShellPanel } from "@/components/shell"
import { useShelf } from "@/lib/home-blocks"
import { useNavFavorites } from "@/lib/nav-favorites"
import { cn } from "@/ui/lib/utils"

// Two things every Admin card carries (Brendan, 2026-09-06): a title that
// copies its own address when clicked — the page's URL with the card's
// anchor — and the standard three-dot menu in the top right, with whatever
// control the card already had sitting to its left.

export const slug = (s: string) =>
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
      {/* hq's copy chip (app/ui/copy-code.tsx), reworked as Brendan asked on 2026-10-19: plain at
          rest; on hover the title keeps its own color on the muted ground and the copy icon
          surfaces where the check lands once copied, as lucide.dev's icon titles do. */}
      <button
        type="button"
        onClick={copy}
        title="Copy link to this card"
        className={cn(
          "group/anchor inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors select-none focus-visible:outline-1 focus-visible:outline-ring",
          copied ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "text-foreground hover:bg-muted"
        )}
      >
        {children}
        {copied ? <CheckIcon className="size-3.5 text-green-600" /> : <CopyIcon className="size-3.5 opacity-0 transition-opacity group-hover/anchor:opacity-100" />}
      </button>
    </CardTitle>
  )
}

/** A refresh icon: re-reads the page's data on the server. */
export function RefreshButton() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  return (
    <button type="button" aria-label="Refresh" title="Refresh" onClick={() => start(() => router.refresh())} className="inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-muted hover:text-foreground">
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

/** The card's controls: whatever it had, then the standard three-dot menu (Brendan, 2026-10-23), the same
 *  six rows on every block in this order: Pin to top, Favorite, Add to Blocks, Ask PAX, Refresh, Collapse.
 *  A block's own entries (View, Download, extras) follow below a separator. Pin to top works where the
 *  block sits in an ordered column and is greyed where it is already first or the page has no order. */
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
  title,
  anchor,
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
  /** The block's title and anchor: Favorite and Add to Blocks key on them, the foot shows the title. */
  title?: string
  anchor?: string
}) {
  const router = useRouter()
  const path = usePathname()
  const pinTop = usePinTop()
  const { askAbout } = useShellPanel()
  const { favs, toggle: toggleFav } = useNavFavorites()
  const shelf = useShelf()
  const root = React.useRef<HTMLDivElement>(null)
  const key = anchor ? `${path}#${anchor}` : null
  const fav = !!key && favs.includes(key)
  const onShelf = !!key && shelf.has(key)
  // Ask PAX: the side panel's chat opens with the block's content, read off the screen at the click.
  const ask = () => {
    const card = root.current?.closest<HTMLElement>('[data-slot="card"]')
    const name = title ?? card?.querySelector('[data-slot="card-title"]')?.textContent ?? "this block"
    const text = (card?.innerText ?? "").replace(/\n{3,}/g, "\n\n").slice(0, 8000)
    askAbout({ context: () => `ACTIVE CONTEXT — the user is asking about the block "${name}" on ${path}. What the block shows on screen:\n${text}` })
  }
  const extras = (views && views.length > 1) || !!menuItems || (rows && rows.length > 0)
  return (
    <div ref={root} className={cn("flex items-center gap-1", className)}>
      {children}
      {/* Code/hq's row kebab, in PAX's light dress (components/kebab-menu.tsx). */}
      <KebabMenu label="Block options" trigger={<EllipsisVerticalIcon className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-md text-slate-800 outline-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted">
        <MenuRow icon={<PinIcon />} label="Pin to top" disabled={!pinTop || pinTop.first} onClick={() => pinTop?.pin()} />
        <MenuRow icon={<StarIcon className={fav ? "fill-amber-400 text-amber-400" : undefined} />} label={fav ? "Unfavorite" : "Favorite"} disabled={!key} onClick={() => key && toggleFav(key)} />
        <MenuRow icon={<LayoutGridIcon />} label={onShelf ? "Remove from Blocks" : "Add to Blocks"} checked={onShelf} disabled={!key || !title} onClick={() => key && title && anchor && (onShelf ? shelf.remove(key) : shelf.add({ key, title, path, anchor }))} />
        <MenuRow icon={<MessagesSquareIcon />} label="Ask PAX" onClick={ask} />
        <MenuRow icon={<RefreshCwIcon />} label="Refresh" onClick={() => router.refresh()} />
        <MenuRow icon={collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />} label={collapsed ? "Expand" : "Collapse"} disabled={!onCollapse} onClick={() => onCollapse?.()} />
        {extras && <MenuSeparator />}
        {views && views.length > 1 && (
          <MenuFlyout id="view" icon={<LayoutListIcon />} label="View" hint={views.find((v) => v.value === view)?.label}>
            {views.map((v) => (
              <MenuRow key={v.value} label={v.label} checked={v.value === view} onClick={() => onView?.(v.value)} />
            ))}
          </MenuFlyout>
        )}
        {menuItems}
        {rows && rows.length > 0 && (
          <MenuFlyout id="download" icon={<DownloadIcon />} label="Download" hint={`${rows.length} rows`}>
            <MenuRow label="CSV" onClick={() => download(rows, name, "csv")} />
            <MenuRow label="JSON" onClick={() => download(rows, name, "json")} />
          </MenuFlyout>
        )}
        {title && (
          <>
            <MenuSeparator />
            <MenuFoot title={title} sub={path} />
          </>
        )}
      </KebabMenu>
    </div>
  )
}
