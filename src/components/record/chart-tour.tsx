"use client"

import * as React from "react"
import { Info, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// A chart's guided tour: the info circle in the block's header starts it, and a card inside the chart
// walks the reader through how to read it, a stage at a time. Each stage can move the chart's cursor
// and pick the line it's about; the chart dims the rest. The card dresses as /graph's cluster tour.

export type TourStep<F extends string = string> = { text: string; at?: number; focus?: F }

/** The info circle, just left of the block's collapse chevron. */
export function TourButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={on ? "End the tour" : "How to read this chart"}
      aria-pressed={on}
      onClick={onClick}
      className={cn("relative inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted", on ? "text-pax2-light-blue" : "text-slate-800 hover:text-foreground")}
    >
      <Info className="size-4" />
      {/* The green dot says a tour is waiting; it rests while the tour runs. */}
      {!on && (
        <span aria-hidden className="absolute right-0.5 top-0.5 flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
        </span>
      )}
    </button>
  )
}

/** The tour's card, in the chart's top right unless `className` places it; Escape ends the tour, the arrow keys step it. */
export function TourCard({ steps, step, onStep, className }: { steps: TourStep[]; step: number; onStep: (n: number | null) => void; className?: string }) {
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStep(null)
      if (e.key === "ArrowRight" && step < steps.length - 1) onStep(step + 1)
      if (e.key === "ArrowLeft" && step > 0) onStep(step - 1)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [step, steps.length, onStep])
  return (
    <div onPointerMove={(e) => e.stopPropagation()} className={cn("absolute right-4 top-2 z-20 w-[22rem] max-w-[calc(100%-2rem)] cursor-default rounded-xl border bg-white p-4 shadow-e2", className)}>
      <button type="button" aria-label="Close the tour" onClick={() => onStep(null)} className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-foreground">
        <X className="size-4" />
      </button>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-pax2-blue">
        {step + 1} of {steps.length}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{steps[step].text}</p>
      <div className="mt-3 flex items-center gap-2">
        {step > 0 && (
          <button type="button" onClick={() => onStep(step - 1)} className="h-7 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:border-pax2-blue">
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" onClick={() => onStep(step + 1)} className="h-7 rounded-full bg-pax2-blue px-3 text-xs font-medium text-white hover:opacity-90">
            Next
          </button>
        ) : (
          <button type="button" onClick={() => onStep(null)} className="h-7 rounded-full bg-pax2-blue px-3 text-xs font-medium text-white hover:opacity-90">
            Done
          </button>
        )}
        <button type="button" onClick={() => onStep(null)} className="ml-auto h-7 px-2 text-xs text-slate-400 hover:text-slate-600">
          Skip
        </button>
      </div>
    </div>
  )
}
