"use client"

import * as React from "react"

import { ts } from "@/components/bits"
import { useUsage } from "@/components/usage-beacon"
import type { Features } from "@/lib/catalog"
import { cn } from "@/ui/lib/utils"

export const SeekCtx = React.createContext<{ seek: (t: number) => void; now: number }>({ seek: () => {}, now: 0 })
export const useSeek = () => React.useContext(SeekCtx)

export function SeekProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = React.useState(0)
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const seek = React.useCallback((t: number) => {
    const v = ref.current ?? (document.getElementById("pax2-video") as HTMLVideoElement | null)
    if (!v) return
    ref.current = v
    v.currentTime = t
    void v.play().catch(() => {})
    v.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])
  React.useEffect(() => {
    const v = document.getElementById("pax2-video") as HTMLVideoElement | null
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
    <button type="button" onClick={() => seek(t)} className={cn("tabular rounded bg-pax2-lavender px-1.5 py-px text-[11px] font-medium text-pax2-light-blue hover:bg-pax2-light-blue hover:text-white", className)}>
      {children ?? ts(t)}
    </button>
  )
}

/** The video, logging its first play and the moment three quarters of it has been watched. */
export function Player({ src, poster, className, subject }: { src: string; poster?: string; className?: string; subject?: string }) {
  const log = useUsage()
  const id = subject ?? src.split("/").pop() ?? src
  const seen = React.useRef({ play: false, deep: false })
  return (
    <video
      id="pax2-video"
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      onPlay={() => {
        if (seen.current.play) return
        seen.current.play = true
        log("play", id)
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget
        if (seen.current.deep || !v.duration || v.currentTime < v.duration * 0.75) return
        seen.current.deep = true
        log("watched75", id, { sec: Math.round(v.duration) })
      }}
      className={cn("aspect-[9/16] w-full max-w-[300px] rounded-2xl bg-black object-cover shadow-lg", className)}
    />
  )
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
            <button type="button" onClick={() => seek(l.t)} className={cn("flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-pax2-mist", on && "bg-pax2-lavender")}>
              <span className="tabular w-10 shrink-0 pt-px text-xs text-pax2-light-blue">{ts(l.t)}</span>
              <span className={cn("leading-snug", on ? "text-pax2-blue" : "text-foreground/80")}>{l.text}</span>
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
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-12 w-full cursor-pointer" onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        seek(((e.clientX - r.left) / r.width) * f.durationSec)
      }}>
        {xs.map((d, i) => {
          const h = 3 + ((d - lo) / Math.max(1, hi - lo)) * 20
          const loud = f.loudestSec.includes(i)
          const quiet = f.quietestSec.includes(i)
          return <rect key={i} x={i * w + w * 0.1} y={24 - h} width={w * 0.8} height={h} rx={0.4} className={cn(loud ? "fill-pax2-light-blue" : quiet ? "fill-pax2-red" : "fill-pax2-light-blue/30")} />
        })}
        {f.pauses.map((p, i) => (
          <rect key={`p${i}`} x={(p.t / f.durationSec) * 100} y={0} width={0.4} height={3} className="fill-foreground/40" />
        ))}
        <rect x={(now / f.durationSec) * 100} y={0} width={0.35} height={24} className="fill-foreground" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-800">
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-pax2-light-blue" />loudest</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-pax2-red" />quietest</span>
        <span>{f.pauses.length} pauses ≥ 0.3s</span>
      </div>
    </div>
  )
}

export function Observations({ f, part }: { f: Features; part: "summary" | "detail" }) {
  const p = f.pegasus?.result
  if (!p) return part === "summary" ? <p className="text-sm text-slate-800">The video review has not run on this take yet.</p> : null
  if (part === "detail")
    return p.characteristics ? (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(p.characteristics).map(([k, v]) => (
          <div key={k} className="flex flex-col border-t py-1">
            <dt className="text-slate-800">{k.replace(/_/g, " ")}</dt>
            <dd className="text-foreground/90">{v}</dd>
          </div>
        ))}
      </dl>
    ) : null
  const entries = [...(p.hook ? [{ t: p.hook.t, label: "Opening", text: p.hook.assessment }] : []), ...(p.observations ?? []).map((o) => ({ t: o.t, label: null, text: o.what }))]
  return <Timeline entries={entries} />
}

/** Changelog-style: one vertical line, a dot per moment, the timestamp above its note. */
function Timeline({ entries }: { entries: { t: number; label: string | null; text: string }[] }) {
  const { now } = useSeek()
  const at = entries.reduce((k, e, i) => (now >= e.t ? i : k), -1)
  return (
    <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:inset-y-2 before:left-[5px] before:w-px before:bg-slate-200">
      {entries.map((e, i) => (
        <li key={i} className="relative flex flex-col gap-1">
          <span className={cn("absolute -left-6 top-1.5 size-[11px] rounded-full border-2 bg-white transition-colors", i === at && now > 0 ? "border-pax2-light-blue bg-pax2-light-blue" : e.label ? "border-pax2-blue" : "border-slate-300")} />
          <div className="flex items-center gap-2">
            <At t={e.t} />
            {e.label && <span className="text-xs font-semibold text-pax2-blue">{e.label}</span>}
          </div>
          <p className="text-sm leading-relaxed text-foreground/85">{e.text}</p>
        </li>
      ))}
    </ol>
  )
}
