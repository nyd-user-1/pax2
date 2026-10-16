"use client"

import * as React from "react"

import { cn } from "@/ui/lib/utils"

// RevealFx, from /Code/sports (src/components/RevealFx.tsx): the content wipes on from the left
// through a sliding mask while it sharpens out of a blur and settles a few px. One change: once
// the wipe lands, the transform drops to none along with the filter, so the wrapper never stays a
// containing block for fixed-position content inside a page.
export function RevealFx({
  children,
  delay = 0,
  translateY = 0,
  className,
}: {
  children: React.ReactNode
  /** Seconds. */
  delay?: number
  /** Px offset before the reveal. */
  translateY?: number
  className?: string
}) {
  const [on, setOn] = React.useState(false)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setOn(true), Math.round(delay * 1000))
    return () => clearTimeout(t)
  }, [delay])

  // Only clear the filter once the mask transition finishes (not transform/filter).
  function handleTransitionEnd(e: React.TransitionEvent) {
    if (on && e.propertyName === "mask-position") setDone(true)
  }

  return (
    <div
      className={cn(className)}
      onTransitionEnd={handleTransitionEnd}
      style={{
        WebkitMaskImage: "linear-gradient(to right, black 0%, black 25%, transparent 50%)",
        maskImage: "linear-gradient(to right, black 0%, black 25%, transparent 50%)",
        WebkitMaskSize: "400% 100%",
        maskSize: "400% 100%",
        WebkitMaskPosition: on ? "0 0" : "100% 0",
        maskPosition: on ? "0 0" : "100% 0",
        filter: done ? "none" : on ? "blur(0px)" : "blur(10px)",
        transform: done ? "none" : `translateY(${on ? 0 : translateY}px)`,
        transition: [
          "mask-position 0.7s cubic-bezier(0.25, 0.4, 0.25, 1)",
          "-webkit-mask-position 0.7s cubic-bezier(0.25, 0.4, 0.25, 1)",
          "filter 0.7s cubic-bezier(0.25, 0.4, 0.25, 1)",
          "transform 0.7s cubic-bezier(0.25, 0.4, 0.25, 1)",
        ].join(", "),
      }}
    >
      {children}
    </div>
  )
}
