"use client"

import Link from "next/link"
import { Play } from "lucide-react"

import { CountUp } from "@/components/ui-pax2"
import { TONE_LABEL, toneClasses, toneOf } from "@/lib/tone"
import { cn } from "@/ui/lib/utils"

export type VideoCardData = {
  id: string
  script: string
  scriptShort: string
  voice: string
  variant: string | null
  seconds: number
  score: number | null
  low: number | null
  high: number | null
  status: "scored" | "limited" | "unscorable" | "none"
  impressions: number | null
  poster?: string
  published?: string
}

/** A take as people expect a video: the frame first, the number on it. Opens in the drawer. */
export function VideoCard({ v, i = 0, size = "md" }: { v: VideoCardData; i?: number; size?: "md" | "lg" }) {
  const tone = toneOf(v.low, v.high)
  return (
    <Link href={`/v/${v.id}`} scroll={false} className="rise group flex flex-col gap-2.5" style={{ ["--i" as string]: i }}>
      <div className={cn("@container lift relative aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 shadow-e2", size === "lg" && "rounded-3xl")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.poster ?? `/api/video/${v.id}?poster=1`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          {v.score != null ? (
            <span className={cn("rounded-full px-2.5 py-1 text-sm font-bold shadow-e2", toneClasses[tone])} title={TONE_LABEL[tone]}>
              <CountUp value={v.score} />
            </span>
          ) : (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{v.status === "none" ? "No results" : "Not scored"}</span>
          )}
        </div>
        <span className="tabular absolute right-2.5 top-2.5 rounded-full @max-[170px]:hidden bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur">{Math.round(v.seconds)}s</span>
        <span className="absolute inset-0 m-auto flex size-12 scale-90 items-center justify-center rounded-full bg-white/90 text-pax2-blue opacity-0 shadow-e3 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
          <Play className="size-5 translate-x-0.5" fill="currentColor" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="text-sm font-semibold leading-tight @max-[170px]:hidden">{v.scriptShort}</p>
          <p className="text-xs text-white/75">
            {v.voice}
            {v.variant ? ` · ${v.variant}` : ""}
          </p>
        </div>
      </div>
    </Link>
  )
}
