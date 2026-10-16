"use client"

import * as React from "react"

import SplitFlapText from "@/components/split-flap-text"

// The landing's hero is the board: it waits out the load curtain, plays its
// three messages once, and holds the last.
const MESSAGES = ["STOP ENGAGING", "START RESONATING", "PAX AMERICANA 🇺🇸"]
/** The curtain's hold plus its sweep, in ms. */
const CURTAIN = 1200

export function FlapHero() {
  const [play, setPlay] = React.useState(false)
  React.useEffect(() => {
    const t = window.setTimeout(() => setPlay(true), CURTAIN)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="flex w-full justify-center px-4" style={{ fontSize: "clamp(18px, 5vw, 64px)", minHeight: "1.2em" }}>
      {play && (
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
          fontSize="1em"
          tileColors={["var(--pax2-ink)", "var(--pax2-red)", "var(--pax2-ink)"]}
        />
      )}
    </div>
  )
}
