"use client"

import * as React from "react"

import CursorGrid from "@/components/cursor-grid"
import { SEQUENCE_MS } from "@/components/flap-hero"

// The page-wide grid: one viewport-sized layer fixed behind every section, so the
// effect rides along wherever the reader scrolls. It's there from the first paint; when
// the hero's board sequence finishes, one red pulse runs out through it. The colours feed
// WebGL uniforms, which cannot read CSS variables, so the tokens are resolved to their hex. No
// opening reveal: the curtain covers the grid's first moments, and its ripple would run red.
export function LandingGrid() {
  const [tokens, setTokens] = React.useState<{ blue: string; red: string } | null>(null)
  const [pulse, setPulse] = React.useState(0)
  React.useEffect(() => {
    const css = getComputedStyle(document.documentElement)
    setTokens({ blue: css.getPropertyValue("--pax2-blue").trim(), red: css.getPropertyValue("--pax2-red").trim() })
    const t = window.setTimeout(() => setPulse(1), SEQUENCE_MS)
    return () => window.clearTimeout(t)
  }, [])
  if (!tokens) return null
  return (
    <div className="pointer-events-none fixed inset-0">
      <CursorGrid color={tokens.blue} gridColor={tokens.blue} pulseColor={tokens.red} pulseKey={pulse} intro={false} gridOpacity={0.16} fillOpacity={0.08} spotlight={0.8} />
    </div>
  )
}
