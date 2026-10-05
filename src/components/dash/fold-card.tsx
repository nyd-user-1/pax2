"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/dash/card-tools"
import { Card, CardAction, CardContent, CardHeader } from "@/ui/components/nova/card"
import { cn } from "@/ui/lib/utils"

/** The dashboard's standard block height, open. */
export const BLOCK_HEIGHT = "h-[419px]"

/** A card that opens and closes from the chevron at its right; open, it is BLOCK_HEIGHT tall and its body scrolls inside. */
export function FoldCard({ title, children, tools, search, rows, name, defaultOpen = true }: { title: string; children: React.ReactNode; tools?: React.ReactNode; search?: React.ReactNode; rows?: readonly Record<string, unknown>[]; name?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <Card className={cn("gap-4", open && BLOCK_HEIGHT)}>
      <CardHeader>
        <div className="flex items-center gap-1">
          <CardAnchor>{title}</CardAnchor>
          {tools}
          {search}
        </div>
        <CardAction>
          <CardTools rows={rows} name={name ?? title.toLowerCase()} collapsed={!open} onCollapse={() => setOpen(!open)}>
            <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => setOpen(!open)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
          </CardTools>
        </CardAction>
      </CardHeader>
      {open && <CardContent className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card">{children}</CardContent>}
    </Card>
  )
}
