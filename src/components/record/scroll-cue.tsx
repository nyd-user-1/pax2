"use client"

import * as React from "react"
import { ArrowUp, ChevronDown } from "lucide-react"

import { whiteButton, FLOAT } from "@/components/white-button"

/** The classic circled down-arrow at the hero's foot: one tap scrolls a full
 *  viewport to whatever comes next. It leaves as soon as the reader scrolls, and
 *  only comes back once they've returned to the very top and paused there. */
export function ScrollCue({ className }: { className?: string }) {
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
      className={whiteButton(
        "circle",
        FLOAT,
        // Block-level: inline, it would sit on a text line of the hero's huge font size and drop.
        "absolute bottom-7 left-1/2 flex -translate-x-1/2 transition-[opacity,color,background-color,border-color] duration-500",
        shown ? "opacity-100" : "pointer-events-none opacity-0 duration-150",
        className,
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
      className={whiteButton(
        "circle",
        "fixed bottom-6 right-6 z-50 transition-[opacity,color,background-color,border-color] duration-200",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
