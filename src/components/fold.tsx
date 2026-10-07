"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/ui/lib/utils"

/** A box that always shows its preview; the header toggles the rest underneath. */
export function Fold({ title, info, preview, children, defaultOpen }: { title: string; info?: React.ReactNode; preview?: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen ?? !preview)
  const more = !!children
  return (
    <div className="surface">
      <div className="flex items-center gap-1.5 px-5 py-4">
        <button type="button" onClick={() => more && setOpen(!open)} className={cn("text-left font-semibold text-slate-900", more ? "cursor-pointer" : "cursor-default")}>
          {title}
        </button>
        {info}
        {more && (
          <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} aria-expanded={open} onClick={() => setOpen(!open)} className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-6 px-5 pb-5">
        {preview}
        {open && children}
      </div>
    </div>
  )
}
