"use client"

import * as React from "react"
import Link from "next/link"
import { Info } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/nova/popover"
import { cn } from "@/ui/lib/utils"


/** A number that counts up the first time it appears. */
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const [shown, setShown] = React.useState(value)
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const start = performance.now()
    const dur = 700
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      setShown(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    setShown(0)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setShown(value)
    }
  }, [value])
  return <span className={cn("tabular", className)}>{shown.toFixed(decimals)}</span>
}

/** What the score is, a tap away instead of a paragraph on the page. */
export function ScoreInfo({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger className={cn("inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-hermes-ink", className)} aria-label="What this score means">
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl p-4 text-sm leading-relaxed shadow-e3">
        <p className="font-semibold text-hermes-ink">Resonance, 0 to 100</p>
        <p className="text-slate-600">How well a paid video stopped the scroll, held viewers and got them to share, save or comment, per person reached. 50 is the average of the first round of results.</p>
        <p className="text-slate-600">The range shows how sure the score is: a few thousand impressions give a wide range, budget alone never raises it.</p>
        <Link href="/scoring/method" className="font-medium text-hermes-plum hover:underline">
          How the score works
        </Link>
      </PopoverContent>
    </Popover>
  )
}

export function SectionTitle({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <h2 className="font-display text-xl text-slate-900">{title}</h2>
      {action}
    </div>
  )
}
