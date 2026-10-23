"use client"

import * as React from "react"

import { At, SeekCtx, useSeek } from "@/components/workbench"
import { cn } from "@/ui/lib/utils"

// A partner's video from YouTube, and the seek every timestamp on the page uses: the take pages seek
// their own <video>; here a timestamp asks YouTube's embedded player to jump (its iframe API, through
// postMessage), so the reading's evidence and the transcript move this player.
export function PaidSeek({ children }: { children: React.ReactNode }) {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    const on = (e: MessageEvent) => {
      if (typeof e.data !== "string" || !e.origin.includes("youtube")) return
      try {
        const d = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } }
        if (d.event === "infoDelivery" && typeof d.info?.currentTime === "number") setNow(d.info.currentTime)
      } catch {}
    }
    window.addEventListener("message", on)
    return () => window.removeEventListener("message", on)
  }, [])
  const seek = React.useCallback((t: number) => {
    const f = document.getElementById("pax2-yt") as HTMLIFrameElement | null
    if (!f?.contentWindow) return
    const send = (func: string, args: unknown[] = []) => f.contentWindow!.postMessage(JSON.stringify({ event: "command", func, args }), "*")
    send("seekTo", [t, true])
    send("playVideo")
    f.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])
  return <SeekCtx.Provider value={{ seek, now }}>{children}</SeekCtx.Provider>
}

export function PaidVideo({ id, title }: { id: string; title: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null)
  // Ask the player to report its time, so the transcript can follow it.
  const listen = () => ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "pax2-yt" }), "*")
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-2xl bg-black shadow-e2">
      <iframe
        ref={ref}
        id="pax2-yt"
        title={title}
        src={`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0`}
        onLoad={listen}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  )
}

/** The caption lines, each with its time; the line playing now is marked. */
export function PaidTranscript({ lines, error }: { lines: { t: number; text: string }[]; error?: string }) {
  const { now } = useSeek()
  if (!lines.length) return <p className="text-sm text-slate-500">No transcript: {error ?? "the captions could not be read"}.</p>
  const on = lines.reduce((k, l, i) => (l.t <= now ? i : k), -1)
  return (
    <ol className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <li key={i} data-find className={cn("flex gap-3 rounded-lg px-2 py-1 text-sm", i === on && now > 0 && "bg-pax2-mist")}>
          <At t={l.t} className="h-fit shrink-0" />
          <span className="text-slate-700">{l.text}</span>
        </li>
      ))}
    </ol>
  )
}
