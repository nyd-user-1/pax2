"use client"

import * as React from "react"

import CursorGrid from "@/components/cursor-grid"
import { SEQUENCE_MS } from "@/components/flap-hero"

// The page-wide grid: one viewport-sized layer fixed behind every section, so the
// effect rides along wherever the reader scrolls. It wakes when the hero's board
// sequence finishes. Literal hex: the colours feed WebGL uniforms, which cannot
// read CSS variables. Pax blue.
export function LandingGrid() {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const t = window.setTimeout(() => setOn(true), SEQUENCE_MS)
    return () => window.clearTimeout(t)
  }, [])
  if (!on) return null
  return (
    <div className="pointer-events-none fixed inset-0">
      <CursorGrid color="#1e3a8a" gridColor="#1e3a8a" gridOpacity={0.16} fillOpacity={0.08} spotlight={0.8} />
    </div>
  )
}
