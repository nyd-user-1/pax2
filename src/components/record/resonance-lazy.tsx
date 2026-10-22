"use client"

import * as React from "react"

// The charts' chunk stays out of the landing's initial bundle, but loads the moment the main
// thread goes idle after first paint — two screens before the section, so by arrival the slides
// are mounted and the reader never sees them appear. The observer is the fallback for a browser
// that never idles: 2,500px out it forces the load.

type Slides = typeof import("./resonance-slides").default

export function ResonanceLazy() {
  const [Slides, setSlides] = React.useState<Slides | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    let alive = true
    const load = () => import("./resonance-slides").then((m) => alive && setSlides(() => m.default)).catch(() => {})
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) idle(load)
    else setTimeout(load, 200)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && load(), { rootMargin: "2500px" })
    if (ref.current) io.observe(ref.current)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [])
  // The placeholder holds the section's footprint so nothing below shifts when the slides mount.
  return <div ref={ref}>{Slides ? <Slides /> : <div aria-hidden className="min-h-[640px]" />}</div>
}
