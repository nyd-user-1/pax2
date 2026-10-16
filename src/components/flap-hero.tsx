"use client"

import * as React from "react"

import { ScrollCue } from "@/components/record/scroll-cue"
import SplitFlapText, { graphemes } from "@/components/split-flap-text"

// The hero board, two rows in lockstep: one word per row, every row the same
// eleven boards, both rows driven through the three messages by one clock so
// they can never drift. The scroll cue belongs to the board, not the viewport:
// it fades in beneath it once PAX AMERICANA has landed.
const STEPS: { rows: [string, string]; tile: string; text: string }[] = [
  { rows: ["STOP", "ENGAGING"], tile: "var(--pax2-red)", text: "#f8fafc" },
  { rows: ["START", "RESONATING"], tile: "#ffffff", text: "#000000" },
  { rows: ["PAX", "AMERICANA 🇺🇸"], tile: "var(--pax2-blue)", text: "#f8fafc" },
]
/** Boards per row: the longest row plus flanks — the first and last box never carry a character,
 *  and every row sits on the same grid. */
const WIDTH = 14

const centered = (word: string) => " ".repeat(Math.floor((WIDTH - graphemes(word).length) / 2)) + word
/** The curtain's hold plus its sweep, in ms. */
const CURTAIN = 1200
/** One message's flips plus its hold. */
const STEP_MS = 2800
/** The last message's flips, before the cue appears. */
const SETTLE = 1600

const ROW = {
  loop: false,
  intro: true,
  charset: "alpha",
  flipDuration: 0.1,
  stagger: 0.05,
  flipsPerChar: 6,
  padTo: WIDTH,
  glare: 0.3,
  fontSize: "1em",
  // Em-based gap and radius so the whole board scales as one shape, nothing fixed in px.
  gap: "0.09em",
  tileRadius: "0.12em",
} as const

export function FlapHero() {
  const [step, setStep] = React.useState(-1)
  const [cue, setCue] = React.useState(false)
  React.useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(0), CURTAIN),
      window.setTimeout(() => setStep(1), CURTAIN + STEP_MS),
      window.setTimeout(() => setStep(2), CURTAIN + 2 * STEP_MS),
      window.setTimeout(() => setCue(true), CURTAIN + 2 * STEP_MS + SETTLE),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])
  const s = STEPS[Math.max(0, step)]
  return (
    <div className="flex w-full flex-col items-center px-4" style={{ fontSize: "clamp(15px, 6.2vw, 162px)" }}>
      {step >= 0 ? (
        <div className="flex flex-col items-center gap-[0.22em]">
          {s.rows.map((word, i) => (
            <SplitFlapText key={i} {...ROW} words={[centered(word)]} tileColor={s.tile} textColor={s.text} />
          ))}
        </div>
      ) : (
        <div style={{ height: "2.38em" }} />
      )}
      <div className={`relative mt-10 h-11 transition-opacity duration-700 ${cue ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <ScrollCue className="static translate-x-0" />
      </div>
    </div>
  )
}
