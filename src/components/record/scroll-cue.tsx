"use client"

import * as React from "react"
import { ArrowUp, ChevronDown } from "lucide-react"

import { whiteButton, FLOAT } from "@/components/white-button"

/** The classic circled down-arrow at a section's foot: one tap moves on to what comes next. It leaves
 *  as soon as the reader scrolls. The hero's (no `next`) scrolls a full viewport and comes back once
 *  the reader returns to the very top and pauses there; a later section's names the section it leads
 *  to, and shows whenever the reader comes to rest with its own section at the top of the view. */
export function ScrollCue({ className, next }: { className?: string; next?: string }) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const [shown, setShown] = React.useState(!next)
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    // At rest on its own section: the section's top within a header's reach of the view's top.
    const settled = () => {
      if (!next) return window.scrollY === 0
      const top = ref.current?.closest("section")?.getBoundingClientRect().top
      return top != null && Math.abs(top) < 120
    }
    const on = () => {
      clearTimeout(timer)
      if (!next && window.scrollY === 0) {
        timer = setTimeout(() => setShown(true), 1500)
        return
      }
      setShown(false)
      if (next) timer = setTimeout(() => setShown(settled()), 600)
    }
    setShown(settled())
    window.addEventListener("scroll", on, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", on)
    }
  }, [next])
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Scroll down"
      onClick={() => (next ? document.getElementById(next)?.scrollIntoView({ behavior: "smooth" }) : window.scrollTo({ top: window.innerHeight, behavior: "smooth" }))}
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
