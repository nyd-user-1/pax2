"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/dash/card-tools"
import { Card, CardAction, CardContent, CardHeader } from "@/ui/components/nova/card"
import { cn } from "@/ui/lib/utils"

/** A card that opens and closes from its header; open, its body scrolls inside a fixed height. */
export function FoldCard({ title, children, tools, rows, name, maxHeight = 410, defaultOpen = true }: { title: string; children: React.ReactNode; tools?: React.ReactNode; rows?: readonly Record<string, unknown>[]; name?: string; maxHeight?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center gap-1">
          <CardAnchor>{title}</CardAnchor>
          <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => setOpen(!open)} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        <CardAction>
          <CardTools rows={rows} name={name ?? title.toLowerCase()} collapsed={!open} onCollapse={() => setOpen(!open)}>
            {tools}
          </CardTools>
        </CardAction>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="overflow-y-auto [scrollbar-width:thin]" style={{ maxHeight }}>
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
