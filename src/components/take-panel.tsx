"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Columns2, Columns3, Maximize2, X } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

/** The take docks in the shell's right panel; closing returns to the page beneath. A short's title is
 *  its channel: pressing it searches the feed for that channel. */
export function TakePanel({ title, search, children }: { title: string; search?: string; children: React.ReactNode }) {
  const router = useRouter()
  const { setOpen, nextSize, cycleSize } = useShellPanel()
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
    <section className="fixed inset-0 z-50 flex flex-col bg-pax2-mist md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className={cn("relative z-10 flex min-h-[73px] shrink-0 items-center justify-between gap-3 bg-pax2-mist px-6 py-4 transition-shadow duration-200", scrolled && "shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)]")}>
        {search ? (
          <button
            type="button"
            onClick={() => {
              // The feed beneath picks this up; anywhere else, the home feed opens with the search run.
              if (document.documentElement.dataset.feed) window.dispatchEvent(new CustomEvent("pax2:search", { detail: search }))
              else router.push(`/?q=${encodeURIComponent(search)}`)
            }}
            className="-mx-2 min-w-0 truncate rounded-lg px-2 py-1 text-left font-display text-xl text-slate-900 transition-colors hover:bg-muted"
          >
            {title}
          </button>
        ) : (
          <p className="truncate font-display text-xl text-slate-900">{title}</p>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {/* The icon shows the size the next press goes to: a third, half, then the whole area; a dragged split goes to whichever is wider. */}
          <button type="button" onClick={cycleSize} className={whiteButton("circle", "hidden md:inline-flex")} aria-label={nextSize === "half" ? "Half the page" : nextSize === "full" ? "Full page" : "A third of the page"}>
            {nextSize === "half" ? <Columns2 className="size-4" /> : nextSize === "full" ? <Maximize2 className="size-4" /> : <Columns3 className="size-4" />}
          </button>
          <button type="button" onClick={() => router.back()} className={whiteButton("circle")} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="@container flex-1 overflow-y-auto px-6 py-6" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>{children}</div>
    </section>
  )
}
