"use client"

import * as React from "react"
import { ArrowUp, ChevronDown } from "lucide-react"

import { cn } from "@/ui/lib/utils"

/** The classic circled down-arrow at the hero's foot: one tap scrolls a full
 *  viewport to whatever comes next. It leaves as soon as the reader scrolls, and
 *  only comes back once they've returned to the very top and paused there. */
export function ScrollCue() {
  const [shown, setShown] = React.useState(true)
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = () => {
      clearTimeout(timer)
      if (window.scrollY > 0) setShown(false)
      else timer = setTimeout(() => setShown(true), 1500)
    }
    if (window.scrollY > 0) setShown(false)
    window.addEventListener("scroll", on, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", on)
    }
  }, [])
  return (
    <button
      type="button"
      aria-label="Scroll down"
      onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
      className={cn(
        "absolute bottom-7 left-1/2 flex size-11 -translate-x-1/2 float-cue items-center justify-center rounded-full bg-white text-hermes-ink shadow-e2 transition-[opacity,box-shadow] duration-500 hover:shadow-e3",
        shown ? "opacity-100" : "pointer-events-none opacity-0 duration-150",
      )}
    >
      <ChevronDown className="size-5" />
    </button>
  )
}

/** Its partner: once the reader is a screen or so down, a circled up-arrow in the
 *  bottom-right corner takes them back to the top. */
export function ScrollTop() {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const on = () => setShown(window.scrollY > 600)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full bg-white text-hermes-ink shadow-e2 transition-[opacity,box-shadow] duration-200 hover:shadow-e3",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
