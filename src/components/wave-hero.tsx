"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

// NYSgpt's welcome-screen loader (app/welcome/WaveLoader.tsx, 2026-10-07): a ball bounces along
// fifteen bars, raising a wave where it lands. Same math, driven by requestAnimationFrame here
// instead of motion/react so it costs no dependency. Signed-out state of the queue pages.

const N = 15
const STEP = 20 // 12px bar + 8px gap
const B = 4
const MAX_BOUNCE = 60
const BASE_H = 16
const PEAK = 48
const PASS_MS = 4000

export function WaveHero({ next }: { next: string }) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const ballRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = ((now - start) % PASS_MS) / PASS_MS
      const xf = t < 0.5 ? t / 0.5 : (1 - t) / 0.5
      const idx = xf * (N - 1)
      let bf = (xf * B) % 1
      if (xf === 1 || xf === 0) bf = 0
      const bounce = 4 * bf * (1 - bf)
      const hf = Math.max(0, 1 - bounce * 2)
      const ball = ballRef.current
      if (ball) ball.style.transform = `translate(${idx * STEP}px, ${-(BASE_H + PEAK - hf * 20 + bounce * MAX_BOUNCE)}px) scale(${1 + hf * 0.25}, ${1 - hf * 0.3})`
      for (let i = 0; i < N; i++) {
        const el = barsRef.current[i]
        if (!el) continue
        const dist = Math.abs(i - idx)
        const wave = dist < 3 ? Math.cos((dist / 3) * (Math.PI / 2)) : 0
        const indent = dist < 1.5 ? Math.cos((dist / 1.5) * (Math.PI / 2)) * hf * 20 : 0
        el.style.height = `${Math.max(4, BASE_H + wave * PEAK - indent)}px`
        const c = Math.round(228 - wave * (228 - 39))
        el.style.backgroundColor = `rgb(${c}, ${c}, ${Math.round(231 - wave * (231 - 42))})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-8">
      <div className="relative flex h-48 w-[292px] scale-[0.6] items-end justify-start gap-2 sm:scale-75 md:scale-100" aria-hidden>
        {Array.from({ length: N }).map((_, i) => (
          <div key={i} ref={(el) => { barsRef.current[i] = el }} className="w-3 origin-bottom rounded-full" style={{ height: 16, backgroundColor: "rgb(228, 228, 231)" }} />
        ))}
        <div ref={ballRef} className="absolute bottom-0 left-0 z-10 size-3 rounded-full bg-zinc-900 shadow-sm" style={{ transformOrigin: "bottom center" }} />
      </div>
      <h1 className="text-center text-2xl font-semibold text-slate-900">
        <Link href={`/signin?next=${next}`} className="text-hermes-plum hover:underline">Sign in</Link> to make some noise.
      </h1>
    </div>
  )
}
