"use client"

import { ChevronDown } from "lucide-react"

/** The classic circled down-arrow at the hero's foot: one tap scrolls a full
 *  viewport to whatever comes next. */
export function ScrollCue() {
  return (
    <button
      type="button"
      aria-label="Scroll down"
      onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
      className="absolute bottom-7 left-1/2 flex size-11 -translate-x-1/2 float-cue items-center justify-center rounded-full bg-white text-pax-ink shadow-e2 transition-shadow hover:shadow-e3"
    >
      <ChevronDown className="size-5" />
    </button>
  )
}
