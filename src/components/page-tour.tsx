"use client"

import * as React from "react"

import { TourButton, TourCard } from "@/components/record/chart-tour"

// A page's guided tour, built on the charts' tour (src/components/record/chart-tour.tsx): the same info
// circle with its waiting dot starts it, and the same card walks the stages, here pinned to the viewport's
// corner. Each stage scrolls to an element (an ordered block's `block-<page>-<id>`, or any id), rings it and
// dims the page's other blocks; Escape ends it, the arrow keys step it.
export type PageTourStep = { target: string; text: string }

const RING = ["ring-2", "ring-pax2-light-blue", "ring-offset-4", "rounded-xl"]

export function PageTour({ page, steps, label = "Tour" }: { page: string; steps: PageTourStep[]; label?: string }) {
  const [step, setStep] = React.useState<number | null>(null)
  React.useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(`[id^="block-${page}-"]`))
    const reset = () => {
      for (const b of blocks) {
        b.style.opacity = ""
        b.style.transition = ""
      }
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-tour-on]"))) {
        el.classList.remove(...RING)
        delete el.dataset.tourOn
      }
    }
    reset()
    if (step == null) return
    const target = document.getElementById(steps[step].target)
    if (!target) return
    target.classList.add(...RING)
    target.dataset.tourOn = "1"
    for (const b of blocks) {
      b.style.transition = "opacity 300ms ease"
      b.style.opacity = b === target || b.contains(target) ? "" : "0.35"
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    return reset
  }, [step, steps, page])
  return (
    <>
      <div className="flex items-center rounded-full border border-slate-300 bg-white py-0.5 pl-0.5 shadow-e1 transition-colors hover:border-pax2-light-blue">
        <TourButton on={step != null} onClick={() => setStep(step == null ? 0 : null)} />
        <button type="button" onClick={() => setStep(step == null ? 0 : null)} className="h-8 pl-0.5 pr-3.5 text-sm font-medium text-slate-800 transition-colors hover:text-pax2-blue">
          {label}
        </button>
      </div>
      {step != null && <TourCard steps={steps} step={step} onStep={setStep} className="fixed bottom-6 right-6 top-auto z-[60]" />}
    </>
  )
}
