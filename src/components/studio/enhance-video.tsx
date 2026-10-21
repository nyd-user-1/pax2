import * as React from "react"
import { AbsoluteFill, Sequence, Video, interpolate, useCurrentFrame } from "remotion"

import { FPS, LOOKS } from "@/lib/studio-style"

// The recorded take, enhanced in place: the recording full-bleed underneath; word-timed captions
// in the lower third; the hook on screen for the first two seconds (the composition table's
// cross-channel finding); an optional b-roll insert over the picture while the take's own audio
// carries on; and the ask fading in over the close. Caption timing is the script's words paced
// evenly across the measured clip length — an estimate, stated as one, until the analysis chain's
// Whisper word times exist for the take.

export type EnhanceProps = {
  src: string
  seconds: number
  script: string
  captions: boolean
  hook: boolean
  endCard: boolean
  ask: string
  broll?: { url: string; atSec: number; seconds: number } | null
}

export function pacedWords(script: string, seconds: number) {
  const sentences = script.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/).filter(Boolean)
  const words = sentences.flatMap((s, si) => s.split(" ").filter(Boolean).map((w) => ({ w, si })))
  const span = Math.max(1, seconds - 1)
  const at = (i: number) => 0.3 + (i / Math.max(1, words.length)) * span
  return { sentences, words, at }
}

const look = LOOKS[0]

export function EnhanceVideo({ src, seconds, script, captions, hook, endCard, ask, broll }: EnhanceProps) {
  const frame = useCurrentFrame()
  const sec = frame / FPS
  const total = Math.max(FPS, Math.ceil(seconds * FPS))
  const { sentences, words, at } = React.useMemo(() => pacedWords(script, seconds), [script, seconds])

  let spoken = 0
  while (spoken < words.length && at(spoken) <= sec) spoken++
  const si = words[Math.max(0, Math.min(spoken, words.length - 1))]?.si ?? 0
  const line = sentences[si] ?? ""
  const lineStart = words.findIndex((w) => w.si === si)
  const litInLine = Math.max(0, spoken - lineStart)

  const hookText = sentences[0] ?? ""
  const hookOpacity = hook ? interpolate(frame, [0, 8, 2 * FPS - 8, 2 * FPS], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0
  const endOpacity = endCard ? interpolate(frame, [total - 75, total - 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {broll && (
        <Sequence from={Math.round(broll.atSec * FPS)} durationInFrames={Math.max(FPS, Math.round(broll.seconds * FPS))}>
          <AbsoluteFill>
            <Video src={broll.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        </Sequence>
      )}

      {hook && hookOpacity > 0 && (
        <div style={{ position: "absolute", top: "14%", left: "8%", right: "8%", textAlign: "center", opacity: hookOpacity }}>
          <span style={{ display: "inline", background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: "system-ui, sans-serif", fontWeight: 800, fontSize: 64, lineHeight: 1.25, padding: "6px 18px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", borderRadius: 14 }}>
            {hookText}
          </span>
        </div>
      )}

      {captions && line && endOpacity < 1 && (
        <div style={{ position: "absolute", bottom: "12%", left: "7%", right: "7%", textAlign: "center" }}>
          <span style={{ display: "inline", background: "rgba(0,0,0,0.5)", fontFamily: "system-ui, sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1.35, padding: "4px 14px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", borderRadius: 10 }}>
            {line.split(" ").map((w, i) => (
              <span key={i} style={{ color: "#fff", opacity: i < litInLine ? 1 : 0.45 }}>
                {w}{" "}
              </span>
            ))}
          </span>
        </div>
      )}

      {endCard && endOpacity > 0 && (
        <AbsoluteFill style={{ background: look.background, opacity: endOpacity, alignItems: "center", justifyContent: "center", display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontWeight: 800, fontSize: 92, color: look.ink, textAlign: "center", padding: "0 80px", lineHeight: 1.15 }}>{ask}</span>
          <div style={{ width: 120, height: 8, background: look.accent, borderRadius: 4 }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
