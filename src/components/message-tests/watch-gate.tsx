"use client"

import * as React from "react"

// The assigned video in YouTube's player, counting the seconds actually played (a second skipped past
// is not counted). `onProgress` gets the share of the video played and the seconds counted.

type YTPlayer = { getPlayerState: () => number; getCurrentTime: () => number; getDuration: () => number; destroy: () => void }
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let ready: Promise<YTNamespace> | null = null
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  ready ??= new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement("script")
    s.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(s)
  })
  return ready
}

export function WatchGate({ videoId, onProgress }: { videoId: string; onProgress: (share: number, seconds: number) => void }) {
  const host = React.useRef<HTMLDivElement>(null)
  const report = React.useRef(onProgress)
  React.useEffect(() => {
    report.current = onProgress
  }, [onProgress])
  React.useEffect(() => {
    let player: YTPlayer | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let off = false
    const seen = new Set<number>()
    loadApi().then((YT) => {
      if (off || !host.current) return
      const mount = document.createElement("div")
      host.current.appendChild(mount)
      player = new YT.Player(mount, { videoId, width: "100%", height: "100%", playerVars: { playsinline: 1, rel: 0, modestbranding: 1 } })
      timer = setInterval(() => {
        if (!player?.getPlayerState || player.getPlayerState() !== 1) return
        seen.add(Math.floor(player.getCurrentTime()))
        const d = Math.floor(player.getDuration() || 0)
        report.current(d ? Math.min(1, seen.size / d) : 0, seen.size)
      }, 400)
    })
    return () => {
      off = true
      if (timer) clearInterval(timer)
      player?.destroy()
      if (host.current) host.current.innerHTML = ""
    }
  }, [videoId])
  return <div ref={host} className="mx-auto aspect-[9/16] max-h-[68dvh] w-full max-w-[380px] overflow-hidden rounded-2xl bg-black [&_iframe]:size-full" />
}
