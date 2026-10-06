"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/dash/card-tools"
import { PaxSearch, PaxTable2 } from "@/components/pax-table2"
import { Card, CardAction, CardContent, CardHeader } from "@/ui/components/nova/card"
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
  /** Anchor id when the slugged title shouldn't be it. */
  id?: string
  className?: string
}

export function MainBlock({ title, children, search, searchValue, onSearch, tools, actions, rows, name, views, view, onView, defaultOpen = true, id, className }: BlockProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <PaxTable2 value={searchValue} onChange={onSearch}>
      <Card className={cn("gap-4", open && BLOCK_HEIGHT, className)}>
        <CardHeader>
          <div className="flex items-center gap-1">
            <CardAnchor id={id}>{title}</CardAnchor>
            {tools}
            {search && <PaxSearch placeholder={search} />}
          </div>
          <CardAction>
            <CardTools rows={rows} name={name ?? title.toLowerCase()} views={views} view={view} onView={onView} collapsed={!open} onCollapse={() => setOpen(!open)}>
              {actions}
              <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => setOpen(!open)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
              </button>
            </CardTools>
          </CardAction>
        </CardHeader>
        {open && <CardContent className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card">{children}</CardContent>}
      </Card>
    </PaxTable2>
  )
}

/** MainBlock with a table in it: the column header pins while the rows scroll. */
export function TableBlock(props: BlockProps) {
  return <MainBlock {...props} />
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

/** Two blocks side by side, two thirds and one third; give the wide one xl:col-span-2. */
export function TwoThirdBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 xl:grid-cols-3", className)}>{children}</div>
}

/** Two blocks side by side, half and half. */
export function TwoHalfBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 xl:grid-cols-2", className)}>{children}</div>
}
