"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// Full-screen recorder: the camera behind, the script over it a sentence or two at a time. Once
// recording starts the prompter paces the reader word by word at the chosen speed: words already read
// are bright, the word to say now is underlined, the words ahead are dim, and the block advances on its
// own when its last word is reached. Space, or a tap on the words, pauses and resumes; the arrows and
// the arrow keys jump a block; the speed can change mid-read. Before recording it waits on the first
// block.

function blocks(text: string) {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/)
  const out: string[] = []
  for (const s of sentences) {
    const last = out.at(-1)
    if (last && last.split(" ").length + s.split(" ").length <= 22) out[out.length - 1] = `${last} ${s}`
    else out.push(s)
  }
  return out.filter(Boolean)
}

export function Teleprompter({ text, onClose, onDone }: { text: string; onClose: () => void; onDone: (blob: Blob, seconds: number, mime: string) => void }) {
  const video = React.useRef<HTMLVideoElement>(null)
  const stream = React.useRef<MediaStream | null>(null)
  const rec = React.useRef<MediaRecorder | null>(null)
  const chunks = React.useRef<Blob[]>([])
  const startedAt = React.useRef(0)
  const [err, setErr] = React.useState<string | null>(null)
  const [recording, setRecording] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [wpm, setWpm] = React.useState(130)
  const [w, setW] = React.useState(0)
  const parts = React.useMemo(() => blocks(text), [text])
  // Every word with its block, and where each block starts, so the pointer and the blocks agree.
  const words = React.useMemo(() => parts.flatMap((p, b) => p.split(" ").map((t) => ({ t, b }))), [parts])
  const starts = React.useMemo(() => parts.map((_, b) => words.findIndex((x) => x.b === b)), [parts, words])
  const cur = words[Math.min(w, words.length - 1)]?.b ?? 0
  const running = recording && !paused

  React.useEffect(() => {
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: true })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setErr("The camera or microphone is blocked. Allow both in the browser's address bar, or upload a video instead."))
    return () => {
      alive = false
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // The pace: one word every 60000 / wpm milliseconds while recording and not paused; the speed
  // control takes effect at once because the interval is rebuilt when wpm changes.
  React.useEffect(() => {
    if (!running) return
    const t = setInterval(() => setW((x) => Math.min(words.length - 1, x + 1)), 60000 / wpm)
    return () => clearInterval(t)
  }, [running, wpm, words.length])

  React.useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
    return () => clearInterval(t)
  }, [recording])

  const jump = React.useCallback((d: number) => setW((x) => starts[Math.max(0, Math.min(parts.length - 1, (words[Math.min(x, words.length - 1)]?.b ?? 0) + d))] ?? 0), [starts, parts.length, words])
  const togglePause = React.useCallback(() => {
    if (recording) setPaused((p) => !p)
  }, [recording])

  // Space pauses and resumes, the arrow keys jump a block, unless the focus is on a control.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return
      if (e.code === "Space") {
        e.preventDefault()
        togglePause()
      } else if (e.key === "ArrowLeft") jump(-1)
      else if (e.key === "ArrowRight") jump(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [togglePause, jump])

  const start = () => {
    if (!stream.current) return
    const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    r.onstop = () => onDone(new Blob(chunks.current, { type: r.mimeType }), (Date.now() - startedAt.current) / 1000, r.mimeType)
    rec.current = r
    setW(0)
    setPaused(false)
    startedAt.current = Date.now()
    r.start(1000)
    setRecording(true)
  }
  const stop = () => {
    rec.current?.stop()
    setRecording(false)
    setPaused(false)
  }

  const clock = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`
  const status = !recording ? "Tap to start; the words pace themselves" : paused ? `Paused ${clock} · space or tap the words to resume` : `● ${clock}`
  const curWords = parts[cur]?.split(" ") ?? []
  const curStart = starts[cur] ?? 0

  // Portaled to <body> so the app shell's page animation (a mask on the content card) can't clip it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-pax2-blue text-white">
      <video ref={video} autoPlay playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/70" />
      <div className="relative flex items-center justify-between px-6 py-4">
        <button type="button" onClick={() => (recording ? stop() : onClose())} aria-label="Close">
          <X className="size-6" />
        </button>
        <span className="text-sm text-white/80">{status}</span>
        <span className="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-xs">
          <button type="button" onClick={() => setWpm((v) => Math.max(90, v - 10))} aria-label="Slower">
            <Minus className="size-3.5" />
          </button>
          {wpm} wpm
          <button type="button" onClick={() => setWpm((v) => Math.min(190, v + 10))} aria-label="Faster">
            <Plus className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="relative flex flex-1 items-end justify-center px-16 pb-10">
        <button type="button" onClick={() => jump(-1)} className="absolute left-4 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40" aria-label="Previous">
          <ChevronLeft />
        </button>
        <div role="button" tabIndex={-1} onClick={togglePause} aria-label={paused ? "Resume" : "Pause"} className={cn("flex max-w-2xl cursor-pointer select-none flex-col gap-6 text-center", paused && "opacity-80")}>
          <p className="font-display text-3xl font-semibold leading-snug drop-shadow-lg md:text-5xl">
            {curWords.map((t, k) => {
              const idx = curStart + k
              const state = !recording ? "ahead" : idx < w ? "read" : idx === w ? "now" : "ahead"
              return (
                <React.Fragment key={idx}>
                  <span className={cn("transition-colors duration-150", state === "read" && "text-white", state === "now" && "text-white underline decoration-[var(--pax2-red)] decoration-4 underline-offset-8", state === "ahead" && (recording ? "text-white/45" : "text-white"))}>{t}</span>{" "}
                </React.Fragment>
              )
            })}
          </p>
          {parts[cur + 1] && <p className="font-display text-xl font-semibold leading-snug text-white/50 drop-shadow-lg md:text-3xl">{parts[cur + 1]}</p>}
          {err && <p className="rounded-xl bg-black/60 px-4 py-3 text-base">{err}</p>}
        </div>
        <button type="button" onClick={() => jump(1)} className="absolute right-4 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40" aria-label="Next">
          <ChevronRight />
        </button>
      </div>
      <div className="relative flex flex-col items-center gap-2 bg-black/40 py-5">
        <button type="button" disabled={!!err} onClick={recording ? stop : start} aria-label={recording ? "Stop" : "Record"} className="flex size-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-40">
          <span className={cn("bg-[var(--pax2-red)] transition-all", recording ? "size-8 rounded-md" : "size-16 rounded-full")} />
        </button>
        <span className="text-sm text-white/80">{recording ? "Tap to finish" : "Tap to start"}</span>
      </div>
    </div>,
    document.body,
  )
}
