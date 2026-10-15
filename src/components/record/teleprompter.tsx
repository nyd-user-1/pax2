"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// Full-screen recorder: the camera behind, the script over it a sentence or two at a time,
// advancing at the chosen pace once recording starts.

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
  const [elapsed, setElapsed] = React.useState(0)
  const [wpm, setWpm] = React.useState(130)
  const [i, setI] = React.useState(0)
  const parts = React.useMemo(() => blocks(text), [text])

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

  // Advance the script at the chosen pace while recording.
  React.useEffect(() => {
    if (!recording) return
    const n = parts[i]?.split(" ").length ?? 0
    const t = setTimeout(() => setI((x) => Math.min(parts.length - 1, x + 1)), (n / wpm) * 60000)
    return () => clearTimeout(t)
  }, [recording, i, wpm, parts])

  React.useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
    return () => clearInterval(t)
  }, [recording])

  const start = () => {
    if (!stream.current) return
    const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    r.onstop = () => onDone(new Blob(chunks.current, { type: r.mimeType }), (Date.now() - startedAt.current) / 1000, r.mimeType)
    rec.current = r
    setI(0)
    startedAt.current = Date.now()
    r.start(1000)
    setRecording(true)
  }
  const stop = () => {
    rec.current?.stop()
    setRecording(false)
  }

  // Portaled to <body> so the app shell's page animation (a mask on the content card) can't clip it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-pax2-ink text-white">
      <video ref={video} autoPlay playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/70" />
      <div className="relative flex items-center justify-between px-6 py-4">
        <button type="button" onClick={() => (recording ? stop() : onClose())} aria-label="Close">
          <X className="size-6" />
        </button>
        <span className="text-sm text-white/80">{recording ? `● ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}` : "Read at your own pace"}</span>
        <span className="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-xs">
          <button type="button" onClick={() => setWpm((w) => Math.max(90, w - 10))} aria-label="Slower">
            <Minus className="size-3.5" />
          </button>
          {wpm} wpm
          <button type="button" onClick={() => setWpm((w) => Math.min(190, w + 10))} aria-label="Faster">
            <Plus className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="relative flex flex-1 items-end justify-center px-16 pb-10">
        <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} className="absolute left-4 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40" aria-label="Previous">
          <ChevronLeft />
        </button>
        <div className="flex max-w-2xl flex-col gap-6 text-center">
          {parts.slice(i, i + 2).map((p, k) => (
            <p key={i + k} className={cn("font-display font-semibold leading-snug drop-shadow-lg transition-opacity", k === 0 ? "text-3xl md:text-5xl" : "text-xl text-white/50 md:text-3xl")}>
              {p}
            </p>
          ))}
          {err && <p className="rounded-xl bg-black/60 px-4 py-3 text-base">{err}</p>}
        </div>
        <button type="button" onClick={() => setI((x) => Math.min(parts.length - 1, x + 1))} className="absolute right-4 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40" aria-label="Next">
          <ChevronRight />
        </button>
      </div>
      <div className="relative flex flex-col items-center gap-2 bg-black/40 py-5">
        <button type="button" disabled={!!err} onClick={recording ? stop : start} aria-label={recording ? "Stop" : "Record"} className="flex size-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-40">
          <span className={cn("bg-[var(--pax2-red)] transition-all", recording ? "size-8 rounded-md" : "size-16 rounded-full")} />
        </button>
        <span className="text-sm text-white/80">{recording ? "Tap to finish" : "Tap to start"}</span>
      </div>
    </div>
    ,
    document.body,
  )
}
