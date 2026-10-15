"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

import { VideoCard, type VideoCardData } from "@/components/video-card"
import { cn } from "@/ui/lib/utils"

/** A titled row of videos that scrolls sideways: arrows in the header, the legend and See all underneath. */
export function ScrollRow({ title, videos, href, legend }: { title: string; videos: VideoCardData[]; href: string; legend: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edge, setEdge] = React.useState({ left: false, right: false })
  const measure = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])
  React.useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" })
  const arrow = (show: boolean) => cn("flex size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 transition-opacity hover:text-pax2-ink", !show && "pointer-events-none opacity-0")

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-xl text-slate-900">{title}</h2>
        <div className="flex gap-2">
          <button type="button" aria-label="Scroll left" onClick={() => page(-1)} className={arrow(edge.left)}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Scroll right" onClick={() => page(1)} className={arrow(true)}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div ref={ref} onScroll={measure} className="-my-3 flex snap-x gap-5 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v, i) => (
          <div key={v.id} className="w-[calc((100%-1.25rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-5rem)/5)]">
            <VideoCard v={v} i={i} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {legend}
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-pax2-plum hover:underline">
          See all <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}


/** The bare sideways strip for any row of cards: arrows right, the left one
 *  appears once scrolling starts, no scrollbar. ScrollRow is the titled video
 *  variant; this one wraps whatever children it is given. */
export function ScrollStrip({ children, itemClassName }: { children: React.ReactNode[]; itemClassName: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edge, setEdge] = React.useState({ left: false, right: false })
  const measure = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])
  React.useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" })
  const arrow = (show: boolean) => cn("flex size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-e1 transition-opacity hover:text-pax2-ink", !show && "pointer-events-none opacity-0")

  return (
    <section className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <button type="button" aria-label="Scroll left" onClick={() => page(-1)} className={arrow(edge.left)}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" aria-label="Scroll right" onClick={() => page(1)} className={arrow(true)}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div ref={ref} onScroll={measure} className="-my-3 flex snap-x gap-3 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {React.Children.map(children, (c) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{c}</div>
        ))}
      </div>
    </section>
  )
}
