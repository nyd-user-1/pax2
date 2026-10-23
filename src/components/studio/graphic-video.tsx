import * as React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import type { GraphicKind, Graphics } from "@/lib/footage"

// The graphics a script's footage carries, drawn by Remotion at 1080x1920: the checklist card after the
// team's Question 3 example (a navy panel over the lower half, three white rows with orange checks, an
// orange footer bar), a callout, a stat card, a quote, an intro and end credits. `backdrop` is the take
// the graphic sits over; without one, a plain field stands in for it.

const NAVY = "#1e3a8a"
const ORANGE = "#ea6a24"
const FONT = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"

export type GraphicProps = { kind: GraphicKind; graphics: Graphics; backdrop?: string }

function useIn(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } })
}

function Check() {
  return (
    <svg width={64} height={64} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx={12} cy={12} r={12} fill={ORANGE} />
      <path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Checklist({ g }: { g: Graphics["checklist"] }) {
  const panel = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: "46%", background: NAVY, transform: `translateY(${(1 - panel) * 100}%)`, padding: "70px 80px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 92, letterSpacing: 1 }}>{g.title}</div>
        {(g.items ?? []).slice(0, 3).map((item, i) => {
          const t = interpolate(frame, [10 + i * 6, 22 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          return (
            <div key={i} style={{ width: "100%", background: "#fff", display: "flex", alignItems: "center", gap: 28, padding: "18px 30px", opacity: t, transform: `translateX(${(1 - t) * -60}px)` }}>
              <Check />
              <span style={{ color: NAVY, fontFamily: FONT, fontWeight: 900, fontSize: 64 }}>{item}</span>
            </div>
          )
        })}
        {g.footer && (
          <div style={{ width: "100%", background: ORANGE, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 46, textAlign: "center", padding: "16px 20px", opacity: interpolate(frame, [32, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            {g.footer}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

function Callout({ g }: { g: Graphics["callout"] }) {
  const s = useIn(0)
  const words = g.text.split(/\s+/).filter(Boolean)
  const hot = (g.highlight ?? "").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "")
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 640 }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 112, lineHeight: 1.05, textAlign: "center", padding: "0 60px", transform: `scale(${0.85 + 0.15 * s})`, opacity: s, textShadow: "0 6px 24px rgba(0,0,0,0.55)" }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: w.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "") === hot ? ORANGE : "#fff" }}>
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Stat({ g }: { g: Graphics["stat"] }) {
  const s = useIn(0)
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: NAVY, borderRadius: 48, padding: "70px 90px", textAlign: "center", transform: `scale(${0.8 + 0.2 * s})`, opacity: s, maxWidth: 900 }}>
        <div style={{ color: ORANGE, fontFamily: FONT, fontWeight: 900, fontSize: 230, lineHeight: 1 }}>{g.value}</div>
        <div style={{ color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 60, marginTop: 24 }}>{g.label}</div>
      </div>
    </AbsoluteFill>
  )
}

function Quote({ g }: { g: Graphics["quote"] }) {
  const s = useIn(0)
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <div style={{ background: "#fff", borderLeft: `24px solid ${ORANGE}`, padding: "60px 70px", transform: `translateY(${(1 - s) * 80}px)`, opacity: s, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>
        <div style={{ color: ORANGE, fontFamily: "Georgia, serif", fontSize: 200, lineHeight: 0.6, height: 90 }}>“</div>
        <div style={{ color: NAVY, fontFamily: FONT, fontWeight: 800, fontSize: 76, lineHeight: 1.2 }}>{g.text}</div>
        {g.by && <div style={{ color: "#475569", fontFamily: FONT, fontWeight: 600, fontSize: 46, marginTop: 30 }}>{g.by}</div>}
      </div>
    </AbsoluteFill>
  )
}

function Intro({ g }: { g: Graphics["intro"] }) {
  const s = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY, justifyContent: "center", alignItems: "flex-start", padding: "0 90px" }}>
      <div style={{ color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 130, lineHeight: 1.02, opacity: s, transform: `translateY(${(1 - s) * 50}px)` }}>{g.title}</div>
      <div style={{ height: 18, background: ORANGE, marginTop: 44, width: `${interpolate(frame, [8, 26], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%` }} />
      {g.sub && <div style={{ color: "#c7d2fe", fontFamily: FONT, fontWeight: 600, fontSize: 60, marginTop: 44, opacity: interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{g.sub}</div>}
    </AbsoluteFill>
  )
}

function End({ g }: { g: Graphics["end"] }) {
  const s = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY, justifyContent: "center", alignItems: "center", padding: "0 90px", textAlign: "center" }}>
      <div style={{ color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 120, lineHeight: 1.05, opacity: s, transform: `scale(${0.9 + 0.1 * s})` }}>{g.ask}</div>
      <div style={{ height: 18, width: "40%", background: ORANGE, marginTop: 60, opacity: interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      {g.handle && <div style={{ color: "#c7d2fe", fontFamily: FONT, fontWeight: 700, fontSize: 56, marginTop: 40 }}>{g.handle}</div>}
    </AbsoluteFill>
  )
}

export function GraphicVideo({ kind, graphics, backdrop }: GraphicProps) {
  const full = kind === "intro" || kind === "end"
  return (
    <AbsoluteFill style={{ background: backdrop ? "#000" : "linear-gradient(165deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)" }}>
      {backdrop && !full && <AbsoluteFill style={{ backgroundImage: `url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
      {kind === "checklist" && <Checklist g={graphics.checklist} />}
      {kind === "callout" && <Callout g={graphics.callout} />}
      {kind === "stat" && <Stat g={graphics.stat} />}
      {kind === "quote" && <Quote g={graphics.quote} />}
      {kind === "intro" && <Intro g={graphics.intro} />}
      {kind === "end" && <End g={graphics.end} />}
    </AbsoluteFill>
  )
}
