"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { CardAnchor, CardTools, slug } from "@/components/dash/card-tools"
import { useShelf } from "@/lib/home-blocks"
import { DropdownMenuItem } from "@/ui/components/nova/dropdown-menu"
import { PAX2Search, PAX2Table2 } from "@/components/pax2-table2"
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/ui/components/nova/card"
import { cn } from "@/ui/lib/utils"

// The one block (Brendan, 2026-10-06): every dashboard block is the same card —
// the title, the searchbar beside it, the three-dot menu, the collapse chevron,
// and a body that scrolls inside BLOCK_HEIGHT. TableBlock, CardBlock and
// AccordionBlock are MainBlock under the variant's name, so the inspector says
// what the screen shows; only the content inside differs.

/** Every block's open height. */
export const BLOCK_HEIGHT = "h-[419px]"

export type BlockProps = {
  title: string
  children: React.ReactNode
  /** Placeholder for the searchbar beside the title; omit it for no searchbar. */
  search?: string
  /** Searchbar state, for a block that filters its own rows instead of the DOM. */
  searchValue?: string
  onSearch?: (v: string) => void
  /** Controls between the title and the searchbar (a refresh, a legend). */
  tools?: React.ReactNode
  /** Controls left of the three-dot menu (a view toggle). */
  actions?: React.ReactNode
  /** What the menu's Download writes. */
  rows?: readonly Record<string, unknown>[]
  name?: string
  /** Views the three-dot menu can switch between. */
  views?: readonly { value: string; label: string }[]
  view?: string
  onView?: (value: string) => void
  defaultOpen?: boolean
  /** Open height when the block shouldn't be BLOCK_HEIGHT: "auto" sizes it to its content. */
  height?: string
  /** Ignored (Brendan, 2026-10-20): every block's footer is the Glossary link alone. */
  footer?: React.ReactNode
  /** What stays showing when the block is collapsed (the first rows of a stats grid); nothing by default. */
  peek?: React.ReactNode
  /** Anchor id when the slugged title shouldn't be it. */
  id?: string
  /** Extra entries for the three-dot menu. */
  menuItems?: React.ReactNode
  className?: string
}

/** The menu's "Add to Blocks": puts this block on the discussion panel's Blocks shelf, or takes it off. */
function ShelfItem({ title, anchor }: { title: string; anchor: string }) {
  const path = usePathname()
  const { add, remove, has } = useShelf()
  const key = `${path}#${anchor}`
  const on = has(key)
  return (
    <DropdownMenuItem onClick={() => (on ? remove(key) : add({ key, title, path, anchor }))} className="whitespace-nowrap">
      {on ? "Remove from Blocks" : "Add to Blocks"}
    </DropdownMenuItem>
  )
}

export function MainBlock({ title, children, search, searchValue, onSearch, tools, actions, rows, name, views, view, onView, defaultOpen = true, height, peek, id, menuItems, className }: BlockProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <PAX2Table2 value={searchValue} onChange={onSearch}>
      <Card className={cn("gap-4", open && height !== "auto" && (height ?? BLOCK_HEIGHT), className)}>
        <CardHeader className={cn((open || peek) && "border-b [.border-b]:pb-2")}>
          <div className="flex items-center gap-1">
            <CardAnchor id={id}>{title}</CardAnchor>
            {tools}
            {search && <PAX2Search placeholder={search} />}
          </div>
          <CardAction>
            <CardTools rows={rows} name={name ?? title.toLowerCase()} views={views} view={view} onView={onView} collapsed={!open} onCollapse={() => setOpen(!open)} menuItems={<>{title && <ShelfItem title={title} anchor={id ?? slug(title)} />}{menuItems}</>}>
              {actions}
              <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => setOpen(!open)} className="inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-muted hover:text-foreground">
                <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
              </button>
            </CardTools>
          </CardAction>
        </CardHeader>
        {!open && peek && <CardContent>{peek}</CardContent>}
        {open && <CardContent className="min-h-0 flex-1 overflow-y-auto [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card">{children}</CardContent>}
        {open && (
          <CardFooter className="bg-transparent py-3 text-xs text-slate-800">
            <Link href="/glossary" className="font-medium text-slate-800 underline underline-offset-2 hover:text-pax2-light-blue">Glossary</Link>
          </CardFooter>
        )}
      </Card>
    </PAX2Table2>
  )
}

/** MainBlock with a table in it: the column header pins while the rows scroll. */
export function TableBlock(props: BlockProps) {
  return <MainBlock {...props} className={cn("[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/60", props.className)} />
}

/** MainBlock with tiles in it; tag each tile data-find so the searchbar filters them. */
export function CardBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with rows that expand in place; tag each row data-find. */
export function AccordionBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with a chart in it. */
export function ChartBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with progress rows in it, each a bar to 100 that expands in place to the steps that
 *  close its gap; tag each row data-find. */
export function ProgressBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with a list in it; tag each row data-find. */
export function ListBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with a map in it; the map fills the body. */
export function MapBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with a diagram in it. */
export function DiagramBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** MainBlock with a typeset formula in it. */
export function FormulaBlock(props: BlockProps) {
  return <MainBlock {...props} />
}

/** Two blocks side by side, two thirds and one third; give the wide one xl:col-span-2. */
export function TwoThirdBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 xl:grid-cols-3", className)}>{children}</div>
}

/** Two blocks side by side, half and half. */
export function TwoHalfBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 xl:grid-cols-2", className)}>{children}</div>
}

/** Three blocks side by side, a third each. */
export function OneThirdBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 xl:grid-cols-3", className)}>{children}</div>
}
