"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { useSetPanelOpen } from "@/components/shell"

/** The take docks in the shell's right panel; closing returns to the page beneath. */
export function TakePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  const setPanelOpen = useSetPanelOpen()
  React.useEffect(() => {
    setPanelOpen(true)
    return () => setPanelOpen(false)
  }, [setPanelOpen])
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax-mist md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-200/80 md:shadow-e2">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-pax-mist/90 px-6 py-3 backdrop-blur">
        <p className="truncate font-display text-xl text-slate-900">{title}</p>
        <button type="button" onClick={() => router.back()} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 hover:text-pax-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
    </section>
  )
}
