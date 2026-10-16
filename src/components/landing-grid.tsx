"use client"

import * as React from "react"

import CursorGrid from "@/components/cursor-grid"
import { SEQUENCE_MS } from "@/components/flap-hero"

// The page-wide grid: one viewport-sized layer fixed behind every section, so the
// effect rides along wherever the reader scrolls. It wakes when the hero's board
// sequence finishes. The colours feed WebGL uniforms, which cannot read CSS
// variables, so the pax blue token is resolved to its hex as the grid wakes.
export function LandingGrid() {
  const [blue, setBlue] = React.useState<string | null>(null)
  React.useEffect(() => {
    const t = window.setTimeout(
      () => setBlue(getComputedStyle(document.documentElement).getPropertyValue("--pax2-blue").trim()),
      SEQUENCE_MS,
    )
    return () => window.clearTimeout(t)
  }, [])
  if (!blue) return null
  return (
    <div className="pointer-events-none fixed inset-0">
      <CursorGrid color={blue} gridColor={blue} gridOpacity={0.16} fillOpacity={0.08} spotlight={0.8} />
    </div>
  )
}
