"use client"

import * as React from "react"

import { ScrollCue } from "@/components/record/scroll-cue"
import SplitFlapText from "@/components/split-flap-text"

// The hero board, two rows in lockstep: one word per row, every row the same
// eleven boards, both rows driven through the three messages by one clock so
// they can never drift. The scroll cue belongs to the board, not the viewport:
// it fades in beneath it once PAX AMERICANA has landed.
const STEPS: { rows: [string, string]; tile: string; text: string }[] = [
  { rows: ["STOP", "ENGAGING"], tile: "var(--pax2-red)", text: "#f8fafc" },
  { rows: ["START", "RESONATING"], tile: "#ffffff", text: "#000000" },
  { rows: ["PAX", "AMERICANA🇺🇸"], tile: "var(--pax2-blue)", text: "#f8fafc" },
]
/** Boards per row. Words start in box 1; the board itself stays centered on the page. */
const WIDTH = 10
/** The curtain's hold plus its sweep, in ms. */
const CURTAIN = 2400
/** One message's flips plus its hold. */
const STEP_MS = 2800
/** The flag lands this long after the third message starts; VIDEO then flips in on row 1. */
const FLAG_LANDS = 2500
/** VIDEO's flips, before the cue appears. */
const VIDEO_RUN = 1400
/** The whole opening, start to cue — the moment the page-wide grid may wake. */
export const SEQUENCE_MS = CURTAIN + 2 * STEP_MS + FLAG_LANDS + VIDEO_RUN

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
  // The flag waits half a second after the letters finish, then flips 30% slower.
  delayedChar: { char: "🇺🇸", delayMs: 500, scale: 1.3 },
} as const

export function FlapHero() {
  const [step, setStep] = React.useState(-1)
  const [cue, setCue] = React.useState(false)
  React.useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(0), CURTAIN),
      window.setTimeout(() => setStep(1), CURTAIN + STEP_MS),
      window.setTimeout(() => setStep(2), CURTAIN + 2 * STEP_MS),
      window.setTimeout(() => setStep(3), CURTAIN + 2 * STEP_MS + FLAG_LANDS),
      window.setTimeout(() => setCue(true), CURTAIN + 2 * STEP_MS + FLAG_LANDS + VIDEO_RUN),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])
  const s = STEPS[Math.min(Math.max(0, step), 2)]
  return (
    <div className="relative flex w-full flex-col items-center px-4" style={{ fontSize: "clamp(15px, 6.2vw, 162px)" }}>
      {step >= 0 ? (
        <div className="relative z-10 flex flex-col items-center gap-[0.22em]">
          {[step >= 3 ? "PAX VIDEO" : s.rows[0], s.rows[1]].map((word, i) => (
            <SplitFlapText
              key={i}
              {...ROW}
              words={[word]}
              tileColor={s.tile}
              textColor={s.text}
              charBg={i === 0 && step >= 3 ? { chars: "VIDEO", bg: "var(--pax2-red)" } : undefined}
            />
          ))}
        </div>
      ) : (
        <div style={{ height: "2.38em" }} />
      )}
      {/* Below the board without displacing it: the board alone decides the hero's centring. */}
      <div className="absolute inset-x-0 top-full z-10 flex flex-col items-center">
        <div className={`mt-20 flex flex-col items-center gap-2 px-6 text-center transition-opacity duration-700 ${cue ? "opacity-100" : "opacity-0"}`}>
          <p className="text-xl font-semibold text-pax2-blue md:text-2xl">Your voice matters.</p>
          <p className="text-base text-slate-500 md:text-lg">Fine tune it with PAX.</p>
        </div>
        <div className={`relative mt-8 h-11 transition-opacity duration-700 ${cue ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <ScrollCue className="static translate-x-0" />
        </div>
      </div>
    </div>
  )
}
