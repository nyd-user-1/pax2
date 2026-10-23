"use client"

import * as React from "react"

// The sign-in header's line, typed: each next line backspaces only to what the two share ("Ready to
// make ") and types the rest, and the last backs up to "Ready" and lands on "Ready. Set. Go."

const LINES = ["Ready to make change?", "Ready to make a video?", "Ready to make a storyboard?", "Ready to make a script?", "Ready to make a difference?", "Ready. Set. Go."]
const TYPE_MS = 70
const DELETE_MS = 35
const PAUSE_MS = 1400

const shared = (a: string, b: string) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

export function ReadySetGo({ className = "" }: { className?: string }) {
  const [shown, setShown] = React.useState("")
  React.useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(LINES[LINES.length - 1])
      return
    }
    let alive = true
    let timer = 0
    const wait = (ms: number) => new Promise<void>((r) => { timer = window.setTimeout(r, ms) })
    ;(async () => {
      let text = ""
      for (let n = 0; n < LINES.length && alive; n++) {
        const next = LINES[n]
        const keep = shared(text, next)
        while (alive && text.length > keep) {
          text = text.slice(0, -1)
          setShown(text)
          await wait(DELETE_MS)
        }
        while (alive && text.length < next.length) {
          text = next.slice(0, text.length + 1)
          setShown(text)
          await wait(TYPE_MS)
        }
        if (n < LINES.length - 1) await wait(PAUSE_MS)
      }
    })()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <span className={`font-display text-pax2-blue ${className}`} aria-label={LINES[LINES.length - 1]}>
      <span aria-hidden>{shown}</span>
      <span aria-hidden className="ml-0.5 inline-block w-[2px] animate-pulse bg-pax2-blue align-[-0.1em]" style={{ height: "1em" }} />
    </span>
  )
}
