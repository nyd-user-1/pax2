import * as React from "react"
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

// A script drawn as a vertical video, in the manner of GovBlock's Clips Studio: scenes one after
// another, each entering on a spring, the look painting them. A number in a line becomes the scene's
// hero; the last scene is the ask. No camera needed.

export type Look = { id: string; label: string; background: string; ink: string; accent: string; muted: string }

export const LOOKS: Look[] = [
  { id: "navy", label: "Navy", background: "#1e3a8a", ink: "#ffffff", accent: "#fca5a5", muted: "#3b5bb5" },
  { id: "paper", label: "Paper", background: "#f8fafc", ink: "#0f172a", accent: "#dc2626", muted: "#e2e8f0" },
  { id: "flag", label: "Red", background: "#b91c1c", ink: "#ffffff", accent: "#bfdbfe", muted: "#dc2626" },
  { id: "night", label: "Night", background: "#0b1120", ink: "#f8fafc", accent: "#60a5fa", muted: "#1e293b" },
]

export type Motion = "rise" | "zoom" | "type"
export type ScriptVideoProps = { lines: string[]; look: Look; motion: Motion; ask: string; name?: string }

export const FPS = 30
export const sceneFrames = (line: string) => Math.round(Math.min(5.5, Math.max(2.2, line.split(/\s+/).length / 2.6)) * FPS)
export const totalFrames = (lines: string[]) => lines.reduce((t, l) => t + sceneFrames(l), 0) + 75

function Scene({ line, look, motion, index }: { line: string; look: Look; motion: Motion; index: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const stat = line.match(/(\d[\d,.]*\s?%|\b\d[\d,.]*\b)/)?.[0]
  const words = line.split(/\s+/)
  const shown = motion === "type" ? Math.ceil(interpolate(frame, [0, Math.max(10, words.length * 3)], [0, words.length], { extrapolateRight: "clamp" })) : words.length
  const style: React.CSSProperties = motion === "zoom" ? { transform: `scale(${0.85 + enter * 0.15})`, opacity: enter } : motion === "rise" ? { transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter } : {}
  return (
    <AbsoluteFill style={{ background: index % 2 ? look.background : look.background, padding: 96, justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 96, left: 96, display: "flex", gap: 10 }}>
        <div style={{ width: 54, height: 10, background: "#2563eb", borderRadius: 5 }} />
        <div style={{ width: 54, height: 10, background: "#ffffff", borderRadius: 5, outline: `2px solid ${look.muted}` }} />
        <div style={{ width: 54, height: 10, background: "#dc2626", borderRadius: 5 }} />
      </div>
      <div style={style}>
        {stat && (
          <div style={{ fontFamily: "system-ui, sans-serif", fontWeight: 900, fontSize: 260, lineHeight: 0.9, color: look.accent, letterSpacing: -8, marginBottom: 40 }}>{stat}</div>
        )}
        <div style={{ fontFamily: "system-ui, sans-serif", fontWeight: 800, fontSize: stat ? 72 : 96, lineHeight: 1.08, color: look.ink, letterSpacing: -2 }}>
          {words.slice(0, shown).join(" ")}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 96, left: 96, right: 96, height: 8, background: look.muted, borderRadius: 4 }}>
        <div style={{ width: `${interpolate(frame, [0, sceneFrames(line)], [0, 100], { extrapolateRight: "clamp", easing: Easing.linear })}%`, height: "100%", background: look.accent, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  )
}

function Ask({ look, ask, name }: { look: Look; ask: string; name?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 14 } })
  return (
    <AbsoluteFill style={{ background: look.accent === "#dc2626" ? "#1e3a8a" : look.background, justifyContent: "center", alignItems: "center", padding: 96, textAlign: "center" }}>
      <div style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s, fontFamily: "system-ui, sans-serif", fontWeight: 900, fontSize: 120, lineHeight: 1, color: "#ffffff", background: "#dc2626", padding: "40px 56px", borderRadius: 32 }}>{ask}</div>
      {name && <div style={{ marginTop: 48, fontFamily: "system-ui, sans-serif", fontSize: 44, color: look.accent === "#dc2626" ? "#ffffff" : look.ink, opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }) }}>— {name}</div>}
    </AbsoluteFill>
  )
}

export function ScriptVideo({ lines, look, motion, ask, name }: ScriptVideoProps) {
  let from = 0
  return (
    <AbsoluteFill style={{ background: look.background }}>
      {lines.map((l, i) => {
        const d = sceneFrames(l)
        const el = (
          <Sequence key={i} from={from} durationInFrames={d}>
            <Scene line={l} look={look} motion={motion} index={i} />
          </Sequence>
        )
        from += d
        return el
      })}
      <Sequence from={from} durationInFrames={75}>
        <Ask look={look} ask={ask} name={name} />
      </Sequence>
    </AbsoluteFill>
  )
}
