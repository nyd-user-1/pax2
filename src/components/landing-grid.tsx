"use client"

import * as React from "react"

import CursorGrid from "@/components/cursor-grid"
import { SEQUENCE_MS } from "@/components/flap-hero"

// The page-wide grid: one viewport-sized layer fixed behind every section, so the
// effect rides along wherever the reader scrolls. It wakes when the hero's board
// sequence finishes. The colours feed WebGL uniforms, which cannot read CSS
// variables, so the pax blue token is resolved to its hex as the grid wakes.
export function LandingGrid({ thumbs = [] }: { thumbs?: string[] }) {
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
      <CursorGrid cellSize={CELL} color={blue} gridColor={blue} gridOpacity={0.16} fillOpacity={0.08} spotlight={0.8} />
      <GridThumbs ids={thumbs} />
    </div>
  )
}

/** The grid's cell, in px; GridThumbs lays its cells out the way CursorGrid does. */
const CELL = 60
/** The share of cells hiding a thumbnail. */
const DENSITY = 0.12

type Cell = { key: number; x: number; y: number; src: string }

/** Video thumbnails scattered through the grid's cells, each one showing only
 *  while its cell is hovered — in fast, then held and faded like the grid's own light. */
function GridThumbs({ ids }: { ids: string[] }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [cells, setCells] = React.useState<Cell[]>([])
  React.useEffect(() => {
    const root = ref.current
    if (!root || !ids.length) return undefined
    let cols = 0
    let offX = 0
    let offY = 0
    let lit: HTMLElement | null = null
    const layout = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      cols = Math.ceil(w / CELL) + 1
      const rows = Math.ceil(h / CELL) + 1
      offX = (w - cols * CELL) / 2
      offY = (h - rows * CELL) / 2
      const pool = [...ids].sort(() => Math.random() - 0.5)
      const next: Cell[] = []
      for (let i = 0; i < cols * rows; i++) {
        if (Math.random() >= DENSITY) continue
        next.push({
          key: i,
          x: offX + (i % cols) * CELL,
          y: offY + Math.floor(i / cols) * CELL,
          src: `https://i.ytimg.com/vi/${pool[next.length % pool.length]}/mqdefault.jpg`,
        })
      }
      setCells(next)
    }
    const onMove = (e: PointerEvent) => {
      const key = Math.floor((e.clientY - offY) / CELL) * cols + Math.floor((e.clientX - offX) / CELL)
      const hit = root.querySelector<HTMLElement>(`[data-cell="${key}"]`)
      if (hit === lit) return
      lit?.removeAttribute("data-on")
      hit?.setAttribute("data-on", "")
      lit = hit
    }
    layout()
    window.addEventListener("resize", layout)
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      window.removeEventListener("resize", layout)
      window.removeEventListener("pointermove", onMove)
    }
  }, [ids])
  return (
    <div ref={ref} className="absolute inset-0">
      {cells.map((c) => (
        <div
          key={c.key}
          data-cell={c.key}
          className="absolute p-px opacity-0 transition-opacity delay-[400ms] duration-[800ms] data-[on]:opacity-100 data-[on]:delay-0 data-[on]:duration-150"
          style={{ left: c.x, top: c.y, width: CELL, height: CELL }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.src} alt="" decoding="async" className="size-full object-cover" />
        </div>
      ))}
    </div>
  )
}
