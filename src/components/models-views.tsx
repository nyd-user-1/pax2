"use client"

import * as React from "react"

import { ProgressBlock } from "@/components/blocks"
import { cn } from "@/ui/lib/utils"

// The Models block on /project-management with two views on one card: Progress, the rows with their
// bars and ratings, and Terms, each model's target, loss and algorithm. The two tables arrive rendered
// from the server; this only decides which one shows and names the view for the menu's Download.

export function ModelsViews({ progress, terms, progressRows, termsRows }: { progress: React.ReactNode; terms: React.ReactNode; progressRows: readonly Record<string, unknown>[]; termsRows: readonly Record<string, unknown>[] }) {
  const [view, setView] = React.useState<"progress" | "terms">("progress")
  const tabs = (
    <span className="flex items-center gap-1">
      {(
        [
          ["progress", "Progress"],
          ["terms", "Terms"],
        ] as const
      ).map(([key, label]) => (
        <button key={key} type="button" onClick={() => setView(key)} className={cn("rounded-full px-3 py-1 text-xs font-medium", view === key ? "bg-pax2-blue text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
          {label}
        </button>
      ))}
    </span>
  )
  return (
    <ProgressBlock title="Models" tools={tabs} search={view === "progress" ? "Search models…" : "Search terms…"} rows={view === "progress" ? progressRows : termsRows} name={view === "progress" ? "models" : "model-terms"} height="auto">
      {view === "progress" ? progress : terms}
    </ProgressBlock>
  )
}
