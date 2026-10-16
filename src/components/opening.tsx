"use client"

import * as React from "react"

import { LoadCurtain } from "@/components/load-curtain"
import SplitFlapText from "@/components/split-flap-text"

// The site's opening: every load gets the curtain; a first visit gets the dark
// board behind it, so the sheets draw back onto the split-flap playing its three
// messages before the screen fades into the site. A click skips. The visit is
// remembered in localStorage, so the board never plays twice.

const SEEN = "pax:intro-seen"
const MESSAGES = ["stop engaging", "start resonating", "pax Americana"]
/** The three messages' full run — flips, holds, and the final beat — in ms. */
const RUNTIME = 9800

export function Opening() {
  const [first, setFirst] = React.useState(false)
  const [curtainDone, setCurtainDone] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [gone, setGone] = React.useState(false)

  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN)) setFirst(true)
    } catch {}
  }, [])

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(SEEN, "1")
    } catch {}
    setLeaving(true)
    window.setTimeout(() => setGone(true), 600)
  }, [])

  React.useEffect(() => {
    if (!first || !curtainDone || leaving) return
    const t = window.setTimeout(dismiss, RUNTIME)
    return () => window.clearTimeout(t)
  }, [first, curtainDone, leaving, dismiss])

  return (
    <>
      <LoadCurtain onDone={() => setCurtainDone(true)} />
      {first && !gone && (
        <div
          onClick={dismiss}
          className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#0b0d14] px-4 transition-opacity duration-[600ms] ${leaving ? "opacity-0" : "opacity-100"}`}
        >
          {curtainDone && (
            <SplitFlapText
              words={MESSAGES}
              loop={false}
              intro
              align="center"
              charset="alpha"
              flipDuration={0.1}
              stagger={0.05}
              flipsPerChar={6}
              cycleDelay={1600}
              glare={0.3}
              fontSize="clamp(22px, 5.5vw, 64px)"
            />
          )}
        </div>
      )}
    </>
  )
}
