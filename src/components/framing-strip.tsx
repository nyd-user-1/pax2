import Link from "next/link"

import { toneOf } from "@/lib/tone"
import type { VideoCardData } from "@/components/video-card"
import { cn } from "@/ui/lib/utils"

const DOT: Record<string, string> = { above: "bg-above ring-above/25", below: "bg-below ring-below/25", even: "bg-white ring-slate-300", none: "bg-slate-300 ring-slate-200" }

/** One line per script, every take a dot on 0–100: which framing is landing, at a glance. */
export function FramingStrip({ scripts, videos }: { scripts: { id: string; short: string; framing: string }[]; videos: VideoCardData[] }) {
  let k = 0
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(140px,220px)_1fr] items-center gap-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span />
        <span className="relative h-4">
          <span className="absolute left-0">0</span>
          <span className="absolute left-1/2 -translate-x-1/2">Average</span>
          <span className="absolute right-0">100</span>
        </span>
      </div>
      {scripts.map((s) => {
        const vs = videos.filter((v) => v.script === s.id && v.score != null)
        const mean = vs.length ? vs.reduce((t, v) => t + v.score!, 0) / vs.length : null
        return (
          <div key={s.id} className="grid grid-cols-[minmax(140px,220px)_1fr] items-center gap-4 border-t border-slate-100 py-4">
            <div>
              <p className="font-semibold leading-tight text-slate-900">{s.short}</p>
              <p className="tabular text-xs text-slate-500">{mean != null ? `Average ${mean.toFixed(0)} · ${vs.length} takes` : "No scored takes"}</p>
            </div>
            <div className="relative h-10">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-below/15 via-slate-100 to-above/15" />
              <div className="absolute left-1/2 top-1 h-8 w-px bg-slate-300" />
              {mean != null && <div className="dot-in absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-pax2-ink/40" style={{ left: `${mean}%` }} />}
              {vs.map((v) => {
                const tone = toneOf(v.low, v.high)
                return (
                  <Link key={v.id} href={`/v/${v.id}`} scroll={false} className="dot-in group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${v.score}%`, ["--i" as string]: k++ }}>
                    <span className={cn("block size-4 rounded-full shadow-e1 ring-4 transition-transform group-hover:scale-150", DOT[tone])} />
                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 translate-y-1 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-e3 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <b className="tabular">{v.score!.toFixed(0)}</b> {v.voice}
                      {v.variant ? `, ${v.variant}` : ""}
                      <span className="tabular block text-white/60">
                        range {v.low!.toFixed(0)}–{v.high!.toFixed(0)}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
