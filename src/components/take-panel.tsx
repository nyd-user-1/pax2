"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Columns2, Columns3, X } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { cn } from "@/ui/lib/utils"

/** The take docks in the shell's right panel; closing returns to the page beneath. */
export function TakePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  const { setOpen, wide, setWide } = useShellPanel()
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    setOpen(true)
    return () => setOpen(false)
  }, [setOpen])
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax-mist md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className={cn("relative z-10 flex min-h-[73px] shrink-0 items-center justify-between gap-3 bg-pax-mist px-6 py-4 transition-shadow duration-200", scrolled && "shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)]")}>
        <p className="truncate font-display text-xl text-slate-900">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setWide(!wide)} className="hidden size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 hover:text-pax-ink md:flex" aria-label={wide ? "Narrow the panel" : "Widen the panel"}>
            {wide ? <Columns3 className="size-4" /> : <Columns2 className="size-4" />}
          </button>
          <button type="button" onClick={() => router.back()} className="flex size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 hover:text-pax-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="@container flex-1 overflow-y-auto px-6 py-6" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>{children}</div>
    </section>
  )
}
