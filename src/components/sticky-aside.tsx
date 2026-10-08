"use client"

import * as React from "react"

/** The nearest ancestor that scrolls, or the page. */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * A sticky column that holds where it starts (2026-10-08). Plain `sticky top-0` let the column ride up
 * to the top of the scrolling area before it stuck, so the page's other column only began to pass it
 * after a scroll's worth. This measures how far below the top of its scrolling area the column sits at
 * rest and sticks it there, so the other column scrolls past it from the first pixel.
 */
export function StickyAside({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLElement>(null)
  const [top, setTop] = React.useState<number | undefined>(undefined)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Read at rest, scrolled to the top, where the column sits in its natural place.
    const measure = () => {
      const area = scroller(el)
      if ((area ? area.scrollTop : window.scrollY) > 0) return
      const areaTop = area ? area.getBoundingClientRect().top : 0
      setTop(Math.max(0, el.getBoundingClientRect().top - areaTop))
    }
    requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  return (
    <aside ref={ref} className={className} style={top === undefined ? undefined : { top }}>
      {children}
    </aside>
  )
}
