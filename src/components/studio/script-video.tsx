import * as React from "react"
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { END_FRAMES, FONTS, HOOK_FRAMES, LOOKS, SIZES, isWord, timeline, wordCount, type Look, type StyleRecord, type WordMark } from "@/lib/studio-style"

// A script drawn as a vertical video, in the manner of GovBlock's Clips Studio: scenes one after
// another, each entering on a spring, the style record painting and pacing them. A number in a line
// becomes the scene's hero; numbers and names take the accent color when emphasis is on; an optional
// hook card leads and an optional closing card carries the ask. Narrated, the lines follow the voice's
// word timings and the words light up as they are spoken; silent, they run at the chosen pace. A sound
// bed loops underneath at low volume. No camera needed. The timeline is computed once, in
// src/lib/studio-style.ts, and shared with the page, so the preview and the render agree.

export { FPS, LOOKS, type Look, type Motion } from "@/lib/studio-style"

export type ScriptVideoProps = { lines: string[]; style: StyleRecord; ask: string; name?: string; voiceUrl?: string | null; marks?: WordMark[] | null; musicUrl?: string | null }

const lookOf = (id: string) => LOOKS.find((l) => l.id === id) ?? LOOKS[0]
const fontOf = (style: StyleRecord) => FONTS.find((f) => f.id === style.font)?.family ?? FONTS[0].family
const scaleOf = (style: StyleRecord) => SIZES.find((s) => s.id === style.size)?.scale ?? 1
const STAT = /(\d[\d,.]*\s?%|\b\d[\d,.]*\b)/
const NAME = /^(Massachusetts|Question|Washington|California|Democrats?|Republicans?|November|House|Senate|State)$/i

function Mark({ look, text }: { look: Look; text: string }) {
  return <div style={{ position: "absolute", right: 96, top: 96, fontFamily: "system-ui, sans-serif", fontSize: 30, fontWeight: 600, color: look.ink, opacity: 0.7, letterSpacing: 1 }}>{text}</div>
}

function Flag({ look }: { look: Look }) {
  return (
    <div style={{ position: "absolute", top: 96, left: 96, display: "flex", gap: 10 }}>
      <div style={{ width: 54, height: 10, background: "#2563eb", borderRadius: 5 }} />
      <div style={{ width: 54, height: 10, background: "#ffffff", borderRadius: 5, outline: `2px solid ${look.muted}` }} />
      <div style={{ width: 54, height: 10, background: "#dc2626", borderRadius: 5 }} />
    </div>
  )
}

/** The line's words, the spoken ones lit and the number or name in the accent when emphasis is on. */
function Words({ line, style, look, shown, lit }: { line: string; style: StyleRecord; look: Look; shown: number; lit: number }) {
  const words = line.split(/\s+/).filter(Boolean)
  let j = -1
  return (
    <>
      {words.slice(0, shown).map((w, i) => {
        if (isWord(w)) j++
        const key = w.replace(/[^\w%]/g, "")
        const accent = style.emphasis && (STAT.test(w) || NAME.test(key))
        const dim = lit >= 0 && j > lit
        return (
          <React.Fragment key={i}>
            <span style={{ color: accent ? look.accent : look.ink, opacity: dim ? 0.45 : 1 }}>{w}</span>{" "}
          </React.Fragment>
        )
      })}
    </>
  )
}

function Scene({ line, style, look, duration, lineMarks, from }: { line: string; style: StyleRecord; look: Look; duration: number; lineMarks: WordMark[] | null; from: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const stat = line.match(STAT)?.[0]
  const words = line.split(/\s+/).filter(Boolean)
  const shown = style.motion === "type" && !lineMarks ? Math.ceil(interpolate(frame, [0, Math.max(10, words.length * 3)], [0, words.length], { extrapolateRight: "clamp" })) : words.length
  // Narrated: the index of the word being spoken at this frame, from the marks relative to the scene's start.
  let lit = -1
  if (lineMarks && lineMarks.length) {
    const sec = (from + frame) / fps
    lit = lineMarks.reduce((acc, m, i) => (m.t <= sec ? i : acc), -1)
  }
  const motion: React.CSSProperties = style.motion === "zoom" ? { transform: `scale(${0.85 + enter * 0.15})`, opacity: enter } : style.motion === "rise" ? { transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter } : {}
  const scale = scaleOf(style)
  const family = fontOf(style)
  const lower = style.position === "lower"
  return (
    <AbsoluteFill style={{ background: look.background, padding: 96, justifyContent: lower ? "flex-end" : "center", paddingBottom: lower ? 240 : 96 }}>
      <Flag look={look} />
      {style.mark && style.markText && <Mark look={look} text={style.markText} />}
      <div style={motion}>
        {stat && !lower && (
          <div style={{ fontFamily: family, fontWeight: 900, fontSize: 260 * scale, lineHeight: 0.9, color: look.accent, letterSpacing: -8, marginBottom: 40 }}>{stat}</div>
        )}
        <div style={{ fontFamily: family, fontWeight: 800, fontSize: (stat && !lower ? 72 : 96) * scale, lineHeight: 1.08, color: look.ink, letterSpacing: style.font === "mono" ? 0 : -2 }}>
          <Words line={line} style={style} look={look} shown={shown} lit={lit} />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 96, left: 96, right: 96, height: 8, background: look.muted, borderRadius: 4 }}>
        <div style={{ width: `${interpolate(frame, [0, duration], [0, 100], { extrapolateRight: "clamp", easing: Easing.linear })}%`, height: "100%", background: look.accent, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  )
}

/** The hook card: the script's first number, or its first line, alone and large. */
function Hook({ lines, style, look }: { lines: string[]; style: StyleRecord; look: Look }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 16 } })
  const first = lines[0] ?? ""
  const stat = lines.map((l) => l.match(STAT)?.[0]).find(Boolean)
  const family = fontOf(style)
  return (
    <AbsoluteFill style={{ background: look.background, justifyContent: "center", alignItems: "center", padding: 96, textAlign: "center" }}>
      <Flag look={look} />
      {style.mark && style.markText && <Mark look={look} text={style.markText} />}
      <div style={{ transform: `scale(${0.7 + s * 0.3})`, opacity: s }}>
        {stat ? (
          <div style={{ fontFamily: family, fontWeight: 900, fontSize: 320 * scaleOf(style), lineHeight: 0.9, color: look.accent, letterSpacing: -10 }}>{stat}</div>
        ) : (
          <div style={{ fontFamily: family, fontWeight: 800, fontSize: 100 * scaleOf(style), lineHeight: 1.05, color: look.ink, letterSpacing: -2 }}>{first}</div>
        )}
      </div>
    </AbsoluteFill>
  )
}

function Ask({ look, style, ask, name }: { look: Look; style: StyleRecord; ask: string; name?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 14 } })
  const family = fontOf(style)
  return (
    <AbsoluteFill style={{ background: look.accent === "#dc2626" ? "#1e3a8a" : look.background, justifyContent: "center", alignItems: "center", padding: 96, textAlign: "center" }}>
      {style.mark && style.markText && <Mark look={look} text={style.markText} />}
      <div style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s, fontFamily: family, fontWeight: 900, fontSize: 120 * scaleOf(style), lineHeight: 1, color: "#ffffff", background: "#dc2626", padding: "40px 64px", borderRadius: 32 }}>{ask}</div>
      {name && <div style={{ marginTop: 48, fontFamily: family, fontSize: 44, color: look.accent === "#dc2626" ? "#ffffff" : look.ink, opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }) }}>{name}</div>}
    </AbsoluteFill>
  )
}

export function ScriptVideo({ lines, style, ask, name, voiceUrl, marks, musicUrl }: ScriptVideoProps) {
  const look = lookOf(style.color)
  const t = timeline(lines, style, marks ?? null)
  // Each line's own word marks, for the lit word.
  let k = 0
  const perLine = lines.map((l) => {
    const n = wordCount(l)
    const slice = marks ? marks.slice(k, k + n) : null
    k += n
    return slice
  })
  return (
    <AbsoluteFill style={{ background: look.background }}>
      {style.hookCard && (
        <Sequence from={0} durationInFrames={HOOK_FRAMES}>
          <Hook lines={lines} style={style} look={look} />
        </Sequence>
      )}
      {lines.map((l, i) => (
        <Sequence key={i} from={t.from[i]} durationInFrames={t.durations[i]}>
          <Scene line={l} style={style} look={look} duration={t.durations[i]} lineMarks={perLine[i]} from={t.from[i] - t.hook} />
        </Sequence>
      ))}
      {style.endCard && (
        <Sequence from={t.total - END_FRAMES} durationInFrames={END_FRAMES}>
          <Ask look={look} style={style} ask={ask} name={name} />
        </Sequence>
      )}
      {voiceUrl && (
        <Sequence from={t.hook}>
          <Audio src={voiceUrl} />
        </Sequence>
      )}
      {musicUrl && <Audio src={musicUrl} volume={0.12} loop />}
    </AbsoluteFill>
  )
}
