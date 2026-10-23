import type { CSSProperties } from "react"

import { cn } from "@/ui/lib/utils"

// The project-management page's progress bar, for any page: a rounded track, the fill growing from the
// left on arrival and staggered down a list by `i` (pax2.css .grow). `marker` draws a thin tick, as
// the channel's middle at 50.

const TONES = {
  blue: ["bg-slate-100", "bg-pax2-light-blue"],
  green: ["bg-green-100", "bg-green-500"],
  red: ["bg-red-100", "bg-red-400"],
  slate: ["bg-slate-100", "bg-slate-400"],
} as const

export type GrowTone = keyof typeof TONES

export function GrowBar({ value, i = 0, tone = "blue", marker, title, className }: { value: number; i?: number; tone?: GrowTone; marker?: number; title?: string; className?: string }) {
  const w = Math.max(0, Math.min(100, value))
  return (
    <div className={cn("relative h-3 overflow-hidden rounded-full", TONES[tone][0], className)} title={title}>
      <div className={cn("grow h-full rounded-full", TONES[tone][1])} style={{ width: `${w}%`, "--i": i } as CSSProperties} />
      {marker != null && <div className="absolute inset-y-0 w-px bg-slate-500/70" style={{ left: `${marker}%` }} />}
    </div>
  )
}
