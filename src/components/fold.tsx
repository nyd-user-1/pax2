"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/ui/lib/utils"

/** A box that always shows its preview; the header toggles the rest underneath. */
export function Fold({ title, preview, children }: { title: string; preview?: React.ReactNode; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(!preview)
  const more = !!children
  return (
    <div className="surface">
      <button type="button" onClick={() => more && setOpen(!open)} className={cn("flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-slate-900", more ? "cursor-pointer" : "cursor-default")} aria-expanded={open}>
        {title}
        {more && <ChevronDown className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />}
      </button>
      <div className="flex flex-col gap-6 px-5 pb-5">
        {preview}
        {open && children}
      </div>
    </div>
  )
}
