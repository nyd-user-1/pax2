"use client"

import * as React from "react"

import { cn } from "@/ui/lib/utils"

const KEY = "pax2:video-split"
const MIN_LEFT = 240
const MIN_RIGHT = 360
/** The gap the divider sits in, in px. */
const GAP = 32

/**
 * The video page's two columns as a Chrome-style split: a pill divider in the gap between them drags
 * the video column wider or narrower (remembered, double-click resets, arrow keys nudge). Below the
 * breakpoint the columns stack and the divider goes. The left column is its own container (`video`),
 * so what it holds can change shape with its width — the player turns from portrait to landscape.
 */
export function SplitColumns({ left, right, at, initial, rightClassName }: { left: React.ReactNode; right: React.ReactNode; at: "xl" | "4xl"; initial: number; rightClassName?: string }) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const leftRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(initial)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    const saved = Number(localStorage.getItem(KEY))
    if (saved >= MIN_LEFT) setWidth(saved)
  }, [])
  const clampTo = (w: number) => {
    const room = (rootRef.current?.clientWidth ?? Infinity) - GAP - MIN_RIGHT
    return Math.round(Math.max(MIN_LEFT, Math.min(w, room)))
  }
  const commit = (w: number) => {
    const next = clampTo(w)
    setWidth(next)
    localStorage.setItem(KEY, String(next))
  }
  React.useEffect(() => {
    if (!dragging) return
    const s = document.body.style
    const prev = [s.cursor, s.userSelect]
    s.cursor = "col-resize"
    s.userSelect = "none"
    return () => {
      s.cursor = prev[0]
      s.userSelect = prev[1]
    }
  }, [dragging])

  const side = at === "xl" ? "@xl:flex @xl:gap-0" : "@4xl:flex @4xl:gap-0"
  return (
    <div ref={rootRef} className={cn("grid gap-8", side)} style={{ "--left": `${width}px` } as React.CSSProperties}>
      <div ref={leftRef} className={cn("@container/video flex min-w-0 flex-col", at === "xl" ? "@xl:w-(--left) @xl:shrink-0" : "@4xl:w-(--left) @4xl:shrink-0")}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the columns"
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
        }}
        onPointerMove={(e) => {
          if (!dragging) return
          const l = leftRef.current?.getBoundingClientRect().left
          if (l != null) setWidth(clampTo(e.clientX - l - GAP / 2))
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          setDragging(false)
          commit(width)
        }}
        onDoubleClick={() => commit(initial)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") commit(width - 24)
          if (e.key === "ArrowRight") commit(width + 24)
        }}
        className={cn("group hidden shrink-0 cursor-col-resize justify-center self-stretch outline-none", at === "xl" ? "@xl:flex" : "@4xl:flex")}
        style={{ width: GAP }}
      >
        {/* Sticky, so the pill stays in view on a long page. */}
        <span className="sticky top-1/2 mt-40 flex h-16 w-full items-center justify-center">
          <span className={cn("h-8 w-1 rounded-full transition-colors", dragging ? "bg-pax2-blue" : "bg-slate-300 group-hover:bg-pax2-blue group-focus-visible:bg-pax2-blue")} />
        </span>
      </div>
      <div className={cn("min-w-0 flex-1", rightClassName)}>{right}</div>
    </div>
  )
}
