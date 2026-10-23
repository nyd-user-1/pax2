"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { TourButton, TourCard } from "@/components/record/chart-tour"

// A page's guided tour, built on the charts' tour (src/components/record/chart-tour.tsx): the same info
// circle with its waiting dot starts it, and the same card walks the stages. Each stage scrolls its element
// (an ordered block's `block-<page>-<id>`, or any id) into view, rings it and dims the page's other blocks;
// the card rides in the element's top right as a chart's tour card does in its chart, or just under a
// short element, always inside the viewport. The card renders in a portal on <body>: the shell's content
// is transformed, which would pin a fixed card to the page instead of the screen. Escape ends the tour,
// the arrow keys step it.
export type PageTourStep = { target: string; text: string }

const RING = ["ring-2", "ring-pax2-light-blue", "ring-offset-4", "rounded-xl"]
const CARD_W = 352
const GAP = 12

export function PageTour({ page, steps, label = "Tour" }: { page: string; steps: PageTourStep[]; label?: string }) {
  const [step, setStep] = React.useState<number | null>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const card = React.useRef<HTMLDivElement>(null)

  const place = React.useCallback(() => {
    if (step == null) return
    const target = document.getElementById(steps[step].target)
    if (!target) return
    const r = target.getBoundingClientRect()
    const w = Math.min(CARD_W, window.innerWidth - 2 * GAP)
    const h = card.current?.offsetHeight ?? 190
    const short = r.height < h + 2 * GAP
    const left = Math.min(Math.max(r.right - w - 16, GAP), window.innerWidth - w - GAP)
    const top = Math.min(Math.max(short ? r.bottom + GAP : r.top + GAP, GAP), window.innerHeight - h - GAP)
    setPos({ top, left })
  }, [step, steps])

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
      b.style.opacity = b === target || b.contains(target) ? "" : "0.45"
    }
    // A block taller than most of the screen lines its top up under the header; a shorter one centers.
    target.scrollIntoView({ behavior: "smooth", block: target.offsetHeight > window.innerHeight * 0.7 ? "start" : "center" })
    // Follow the element while the smooth scroll runs, and whenever the reader scrolls or resizes.
    place()
    const settle = [120, 300, 600].map((ms) => window.setTimeout(place, ms))
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      settle.forEach(window.clearTimeout)
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
      reset()
    }
  }, [step, steps, page, place])

  const toggle = () => {
    setPos(null)
    setStep(step == null ? 0 : null)
  }
  return (
    <>
      <div className="flex items-center rounded-full border border-slate-300 bg-white py-0.5 pl-0.5 shadow-e1 transition-colors hover:border-pax2-light-blue">
        <TourButton on={step != null} onClick={toggle} />
        <button type="button" onClick={toggle} className="h-8 pl-0.5 pr-3.5 text-sm font-medium text-slate-800 transition-colors hover:text-pax2-blue">
          {label}
        </button>
      </div>
      {step != null &&
        createPortal(
          <div ref={card} className="fixed z-[60] transition-[top,left] duration-200" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(CARD_W, typeof window === "undefined" ? CARD_W : window.innerWidth - 2 * GAP) }}>
            <TourCard steps={steps} step={step} onStep={(n) => setStep(n)} className="relative right-auto top-auto w-full max-w-none" />
          </div>,
          document.body,
        )}
    </>
  )
}
