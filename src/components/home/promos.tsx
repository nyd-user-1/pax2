"use client"

// The banner carousel from the ElevenLabs home, carrying what actually shipped in the Studio: the
// four ElevenLabs voices beside Polly's four, and the three sound beds that loop under the voice.
// The voices slide is a light card — the names down the left, a cluster of photographic orbs
// clipped by the right edge, each an off-center radial with an inset shadow for volume. The sound
// beds slide is a nebula: blurred radial fields of blue and slate over near-black, a vignette, and
// film grain from an SVG turbulence filter. Two slides on a sliding track; the offscreen slide is
// inert so its links stay out of the tab order. At rest the pager is only the liquid dots — hover
// or keyboard focus surfaces the chip and its arrows.

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/ui/lib/utils"

const VOICES = ["Sarah", "Matilda", "Eric", "Brian"]

// Position and size per orb, then its gradient: lit from the upper left, falling to a deep edge.
const ORBS = [
  { c: "-right-12 -top-10 size-44 blur-[2px]", g: "radial-gradient(circle at 30% 28%, #dbeafe 0%, #60a5fa 38%, #1d4ed8 72%, #172554 100%)" },
  { c: "right-40 -top-6 size-24 blur-[1px]", g: "radial-gradient(circle at 32% 30%, #fee2e2 0%, #f87171 45%, #991b1b 100%)" },
  { c: "-bottom-14 right-10 size-36 blur-[2px]", g: "radial-gradient(circle at 30% 25%, #dcfce7 0%, #4ade80 42%, #166534 100%)" },
  { c: "bottom-5 right-56 size-16 blur-[1px]", g: "radial-gradient(circle at 35% 30%, #e0e7ff 0%, #818cf8 50%, #312e81 100%)" },
  { c: "right-72 top-4 size-10 blur-[1px]", g: "radial-gradient(circle at 35% 30%, #f8fafc 0%, #94a3b8 55%, #334155 100%)" },
]

function Grain() {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full opacity-25 mix-blend-overlay">
      <filter id="home-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" />
      </filter>
      <rect width="100%" height="100%" filter="url(#home-grain)" />
    </svg>
  )
}

export function Promos() {
  const [i, setI] = React.useState(0)
  const N = 2
  return (
    <div>
      <div className="overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
          {/* The voices. */}
          <div inert={i !== 0} className="relative h-40 w-full shrink-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white md:h-44">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_160%_at_88%_0%,#eff6ff_0%,transparent_55%)]" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-80 md:block">
              {ORBS.map((o, k) => (
                <span key={k} className={cn("absolute rounded-full", o.c)} style={{ background: o.g, boxShadow: "inset -10px -14px 28px rgba(15,23,42,0.28)" }} />
              ))}
            </div>
            <div aria-hidden className="absolute inset-y-0 left-10 hidden flex-col justify-center gap-2.5 text-sm text-slate-400 lg:flex">
              {VOICES.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
            <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-[26px] leading-none text-slate-900 md:text-[32px]">Four ElevenLabs voices in the Studio</p>
              <Link href="/record/studio" className="press rounded-full bg-pax2-blue px-6 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-e2">
                Try them
              </Link>
            </div>
          </div>
          {/* The sound beds. */}
          <div inert={i !== 1} className="relative h-40 w-full shrink-0 overflow-hidden rounded-3xl bg-[#060b22] md:h-44">
            <div aria-hidden className="absolute inset-0">
              <div className="absolute -left-24 -top-28 h-[300%] w-[45%] rotate-12 rounded-full bg-[radial-gradient(closest-side,#2563eb,transparent_70%)] opacity-80 blur-2xl" />
              <div className="absolute -top-16 left-[30%] h-[220%] w-[35%] rounded-full bg-[radial-gradient(closest-side,#475569,transparent_70%)] opacity-60 blur-3xl" />
              <div className="absolute -bottom-24 left-[48%] h-[260%] w-[40%] rounded-full bg-[radial-gradient(closest-side,#0ea5e9,transparent_70%)] opacity-50 blur-2xl" />
              <div className="absolute -right-20 -top-20 h-[280%] w-[42%] rounded-full bg-[radial-gradient(closest-side,#60a5fa,transparent_70%)] opacity-70 blur-2xl" />
              <div className="absolute -bottom-16 -right-24 h-[200%] w-[30%] rounded-full bg-[radial-gradient(closest-side,#1e3a8a,transparent_70%)] opacity-90 blur-xl" />
              <div className="absolute inset-0 bg-[radial-gradient(90%_160%_at_50%_40%,transparent_50%,rgba(3,7,18,0.6)_100%)]" />
            </div>
            <Grain />
            <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-[26px] leading-tight text-white md:text-[32px]">Three sound beds loop under the voice</p>
              <Link href="/record/studio" className="press rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition-shadow hover:shadow-e2">
                Try it
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <div className="group flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-200 focus-within:border-slate-200 focus-within:bg-white focus-within:shadow-e1 hover:border-slate-200 hover:bg-white hover:shadow-e1">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setI((v) => (v + N - 1) % N)}
            className="flex size-0 items-center justify-center overflow-hidden rounded-full text-slate-500 opacity-0 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 group-focus-within:size-6 group-focus-within:opacity-100 group-hover:size-6 group-hover:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: N }, (_, d) => (
            <button key={d} type="button" aria-label={`Slide ${d + 1}`} aria-current={i === d || undefined} onClick={() => setI(d)} className="flex h-4 items-center">
              <span className={cn("h-1.5 rounded-full transition-all duration-300", i === d ? "w-4 bg-slate-900" : "w-1.5 bg-slate-400")} />
            </button>
          ))}
          <button
            type="button"
            aria-label="Next"
            onClick={() => setI((v) => (v + 1) % N)}
            className="flex size-0 items-center justify-center overflow-hidden rounded-full text-slate-500 opacity-0 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 group-focus-within:size-6 group-focus-within:opacity-100 group-hover:size-6 group-hover:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
