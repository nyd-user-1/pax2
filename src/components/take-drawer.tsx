"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { Sheet, SheetContent, SheetTitle } from "@/ui/components/nova/sheet"

/** The take slides in over the page it was opened from; closing returns there. */
export function TakeDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setTimeout(() => router.back(), 180)
      }}
    >
      <SheetContent side="right" showCloseButton={false} className="w-full overflow-y-auto bg-pax-mist p-0 sm:max-w-[1040px] data-[side=right]:sm:max-w-[1040px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-pax-mist/90 px-6 py-3 backdrop-blur">
          <SheetTitle className="font-display text-2xl text-slate-900 md:text-[28px]">{title}</SheetTitle>
          <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 hover:text-pax-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
