"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// Section three's charts as horizontal slides: one block per slide, the scrollbar hidden, stepped
// by the arrows at the bottom right. Only the right arrow shows until the reader has moved right;
// then both show, the right one dimming on the last slide. The heading and its two-line definition
// above the track change with the slide (Brendan, 2026-10-22; the duplication with the block's own
// title is his call).

export type SlideHeader = { title: string; lines: string[] }

export function ChartCarousel({ headers, children }: { headers?: SlideHeader[]; children: React.ReactNode }) {
  const slides = React.Children.toArray(children)
  const track = React.useRef<HTMLDivElement>(null)
  const [at, setAt] = React.useState(0)
  const onScroll = () => {
    const el = track.current
    if (el) setAt(Math.min(slides.length - 1, Math.round(el.scrollLeft / (el.clientWidth + 24))))
  }
  const go = (d: -1 | 1) => {
    const el = track.current
    el?.scrollBy({ left: d * (el.clientWidth + 24), behavior: "smooth" })
  }
  const head = headers?.[at]
  const arrow = "flex size-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-pax2-blue hover:text-pax2-blue"
  return (
    <div>
      {head && (
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="font-display text-3xl font-bold text-pax2-blue">{head.title}</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-900">
            {head.lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
        </div>
      )}
      <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {s}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {at > 0 && (
          <button type="button" aria-label="Previous chart" onClick={() => go(-1)} className={arrow}>
            <ChevronLeft className="size-5" />
          </button>
        )}
        <button type="button" aria-label="Next chart" onClick={() => go(1)} disabled={at >= slides.length - 1} className={cn(arrow, at >= slides.length - 1 && "opacity-40 hover:border-slate-300 hover:text-slate-700")}>
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}
