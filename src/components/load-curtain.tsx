"use client"

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"

// The govblock page curtain (apps/web/components/page-curtain.tsx, Brendan's
// 2026-09-12 build for /unite-2), cut down to its reveal half for the initial
// load: the page arrives already under two skewed sheets — ink leading with the
// name riding on it, red a beat behind — and once the first paint has landed
// they sweep off, so what is seen drawing back is always the red, never the
// page still painting underneath.

const EASE = [0.4, 0, 0.2, 1] as const
const SWEEP = 0.6
/** How far the second sheet trails the first, in seconds. */
const TRAIL = 0.18
/** The tilt of the leading edge, as motion.dev's default. */
const ANGLE = 9
const OFF = "-140vw"
/** A paint beat under the sheets before they lift, in ms. */
const HOLD = 350

export function LoadCurtain({ onDone }: { onDone?: () => void }) {
  const reduced = useReducedMotion()
  const [revealing, setRevealing] = React.useState(false)
  const [gone, setGone] = React.useState(false)
  const done = React.useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    setGone(true)
    onDone?.()
  }
  React.useEffect(() => {
    const t = window.setTimeout(() => setRevealing(true), HOLD)
    return () => window.clearTimeout(t)
  }, [])
  // Reduced motion skips the sheets but still owes the caller its cue.
  React.useEffect(() => {
    if (reduced) finish()
  }, [reduced])
  if (reduced || gone) return null
  const sheet = "absolute top-[-20%] left-[-20vw] h-[140%] w-[140vw]"
  return (
    <div aria-hidden className="pointer-events-auto fixed inset-0 z-[100] overflow-hidden">
      {/* The second sheet, behind the first and a beat behind it. */}
      <motion.div
        className={sheet}
        style={{ background: "var(--pax2-red)", skewX: -ANGLE }}
        initial={{ x: "0vw" }}
        animate={{ x: revealing ? OFF : "0vw" }}
        transition={{ duration: SWEEP, ease: EASE, delay: TRAIL }}
        onAnimationComplete={() => revealing && finish()}
      />
      {/* The first sheet, carrying the name. */}
      <motion.div
        className={sheet}
        style={{ background: "var(--pax2-blue)", skewX: -ANGLE }}
        initial={{ x: "0vw" }}
        animate={{ x: revealing ? OFF : "0vw" }}
        transition={{ duration: SWEEP, ease: EASE }}
      >
        {/* Un-skewed, so the word stands upright on the tilted sheet. */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `skewX(${ANGLE}deg)` }}>
          <motion.span
            className="px-6 text-center font-semibold tracking-tight text-white"
            style={{ fontSize: "clamp(2.5rem, 9vw, 9rem)", lineHeight: 1, skewX: -6 }}
            initial={{ x: "0vw", opacity: 1 }}
            animate={revealing ? { x: "-24vw", opacity: 0 } : { x: "0vw", opacity: 1 }}
            transition={{ duration: SWEEP, ease: EASE }}
          >
            pax
          </motion.span>
        </div>
      </motion.div>
    </div>
  )
}
