"use client"

import * as React from "react"

import { SourceBadge, ts } from "@/components/bits"
import type { Features } from "@/lib/catalog"
import { cn } from "@/ui/lib/utils"

const SeekCtx = React.createContext<{ seek: (t: number) => void; now: number }>({ seek: () => {}, now: 0 })
export const useSeek = () => React.useContext(SeekCtx)

export function SeekProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = React.useState(0)
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const seek = React.useCallback((t: number) => {
    const v = ref.current ?? (document.getElementById("pax-video") as HTMLVideoElement | null)
    if (!v) return
    ref.current = v
    v.currentTime = t
    void v.play().catch(() => {})
    v.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])
  React.useEffect(() => {
    const v = document.getElementById("pax-video") as HTMLVideoElement | null
    if (!v) return
    ref.current = v
    const on = () => setNow(v.currentTime)
    v.addEventListener("timeupdate", on)
    return () => v.removeEventListener("timeupdate", on)
  }, [])
  return <SeekCtx.Provider value={{ seek, now }}>{children}</SeekCtx.Provider>
}

/** A timestamp anyone can click to jump the video there. */
export function At({ t, children, className }: { t: number; children?: React.ReactNode; className?: string }) {
  const { seek } = useSeek()
  return (
    <button type="button" onClick={() => seek(t)} className={cn("tabular rounded bg-pax-lavender px-1.5 py-px text-[11px] font-medium text-pax-plum hover:bg-pax-plum hover:text-white", className)}>
      {children ?? ts(t)}
    </button>
  )
}

export function Player({ src, poster }: { src: string; poster?: string }) {
  return <video id="pax-video" src={src} poster={poster} controls playsInline preload="metadata" className="aspect-[9/16] w-full max-w-[300px] rounded-2xl bg-black object-cover shadow-lg" />
}

export function ScriptTimeline({ lines, duration }: { lines: { t: number; text: string }[]; duration: number }) {
  const { now, seek } = useSeek()
  return (
    <ol className="flex flex-col gap-1">
      {lines.map((l, i) => {
        const end = lines[i + 1]?.t ?? duration
        const on = now >= l.t && now < end
        return (
          <li key={i}>
            <button type="button" onClick={() => seek(l.t)} className={cn("flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-pax-mist", on && "bg-pax-lavender")}>
              <span className="tabular w-10 shrink-0 pt-px text-xs text-pax-plum">{ts(l.t)}</span>
              <span className={cn("leading-snug", on ? "text-pax-ink" : "text-foreground/80")}>{l.text}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Loudness per second, measured; the loudest and quietest seconds marked, pauses as ticks. */
export function Loudness({ f }: { f: NonNullable<Features["audio"]> }) {
  const { now, seek } = useSeek()
  const xs = f.loudnessDb
  if (!xs?.length) return null
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const w = 100 / xs.length
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>dB</span>
        <SourceBadge source="derived" />
      </div>
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-12 w-full cursor-pointer" onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        seek(((e.clientX - r.left) / r.width) * f.durationSec)
      }}>
        {xs.map((d, i) => {
          const h = 3 + ((d - lo) / Math.max(1, hi - lo)) * 20
          const loud = f.loudestSec.includes(i)
          const quiet = f.quietestSec.includes(i)
          return <rect key={i} x={i * w + w * 0.1} y={24 - h} width={w * 0.8} height={h} rx={0.4} className={cn(loud ? "fill-pax-plum" : quiet ? "fill-pax-red" : "fill-pax-plum/30")} />
        })}
        {f.pauses.map((p, i) => (
          <rect key={`p${i}`} x={(p.t / f.durationSec) * 100} y={0} width={0.4} height={3} className="fill-foreground/40" />
        ))}
        <rect x={(now / f.durationSec) * 100} y={0} width={0.35} height={24} className="fill-foreground" />
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-pax-plum" />loudest</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-pax-red" />quietest</span>
        <span>{f.pauses.length} pauses ≥ 0.3s</span>
        {f.pitchMedianHz && <span>pitch {f.pitchRangeHz?.[0]}–{f.pitchRangeHz?.[1]} Hz</span>}
      </div>
    </div>
  )
}

export function Observations({ f }: { f: Features }) {
  const p = f.pegasus?.result
  if (!p) return <p className="text-sm text-muted-foreground">The video review has not run on this take yet.</p>
  return (
    <div className="flex flex-col gap-3">
      {p.hook && (
        <div className="flex gap-2 rounded-lg bg-pax-mist px-3 py-2 text-sm">
          <At t={p.hook.t} />
          <span>
            <span className="font-medium text-pax-ink">Opening:</span> {p.hook.assessment}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {p.observations?.map((o, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <At t={o.t} />
            <span className="text-foreground/85">{o.what}</span>
          </li>
        ))}
      </ul>
      {p.characteristics && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {Object.entries(p.characteristics).map(([k, v]) => (
            <div key={k} className="flex flex-col border-t py-1">
              <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
              <dd className="text-foreground/90">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
