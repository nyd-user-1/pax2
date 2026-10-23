import * as React from "react"
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { BRAND_PRESETS, FONTS, type Brand, type GraphicKind, type Graphics } from "@/lib/footage"

// The graphics a script's footage carries, drawn by Remotion at 1080x1920 in the campaign's brand kit:
// the checklist card after the team's Question 3 example (a panel over the lower half, three white rows
// with checks, a footer bar), captions with the spoken word in color, a lower third, a callout, a stat
// card, a quote, an intro and end credits. `bare` drops the backdrop so the storyboard can lay a graphic
// over a shot; on its own, a plain field stands in for the take.

export type TimedWord = { w: string; t: number }
export type GraphicProps = { kind: GraphicKind; graphics: Graphics; brand?: Brand; words?: TimedWord[]; bare?: boolean; logo?: boolean }

function useIn(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } })
}

const fade = (frame: number, a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

function Check({ color }: { color: string }) {
  return (
    <svg width={64} height={64} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx={12} cy={12} r={12} fill={color} />
      <path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Checklist({ g, b, font }: { g: Graphics["checklist"]; b: Brand; font: string }) {
  const panel = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: "46%", background: b.primary, transform: `translateY(${(1 - panel) * 100}%)`, padding: "70px 80px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ color: "#fff", fontFamily: font, fontWeight: 900, fontSize: 92, letterSpacing: 1 }}>{g.title}</div>
        {(g.items ?? []).slice(0, 3).map((item, i) => {
          const t = fade(frame, 10 + i * 6, 22 + i * 6)
          return (
            <div key={i} style={{ width: "100%", background: "#fff", display: "flex", alignItems: "center", gap: 28, padding: "18px 30px", opacity: t, transform: `translateX(${(1 - t) * -60}px)` }}>
              <Check color={b.accent} />
              <span style={{ color: b.primary, fontFamily: font, fontWeight: 900, fontSize: 64 }}>{item}</span>
            </div>
          )
        })}
        {g.footer && (
          <div style={{ width: "100%", background: b.accent, color: "#fff", fontFamily: font, fontWeight: 800, fontSize: 46, textAlign: "center", padding: "16px 20px", opacity: fade(frame, 32, 42) }}>{g.footer}</div>
        )}
      </div>
    </AbsoluteFill>
  )
}

/** The phrase being spoken, up to four words, the current word in the accent color. */
function Captions({ words, b, font }: { words: TimedWord[]; b: Brand; font: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sec = frame / fps
  let i = -1
  for (let k = 0; k < words.length && words[k].t <= sec; k++) i = k
  if (i < 0) return null
  const start = i - (i % 4)
  const phrase = words.slice(start, start + 4)
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 980 }}>
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: 96, lineHeight: 1.05, textAlign: "center", padding: "0 70px", textTransform: "uppercase", textShadow: "0 6px 24px rgba(0,0,0,0.6)" }}>
        {phrase.map((x, k) => (
          <span key={k} style={{ color: start + k === i ? b.accent : "#fff" }}>
            {x.w}{k < phrase.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function LowerThird({ g, b, font }: { g: Graphics["lowerThird"]; b: Brand; font: string }) {
  const s = useIn(0)
  const name = g.name || "Your name"
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: "0 0 1080px 70px" }}>
      <div style={{ display: "flex", transform: `translateX(${(1 - s) * -110}%)` }}>
        <div style={{ width: 18, background: b.accent }} />
        <div style={{ background: b.primary, padding: "22px 40px 24px" }}>
          <div style={{ color: g.name ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: font, fontWeight: 900, fontSize: 64 }}>{name}</div>
          {(g.role || !g.name) && <div style={{ color: "rgba(255,255,255,0.85)", fontFamily: font, fontWeight: 600, fontSize: 42, marginTop: 6 }}>{g.role || "Role"}</div>}
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Callout({ g, b, font }: { g: Graphics["callout"]; b: Brand; font: string }) {
  const s = useIn(0)
  const words = (g.text ?? "").split(/\s+/).filter(Boolean)
  const hot = (g.highlight ?? "").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "")
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 640 }}>
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: 112, lineHeight: 1.05, textAlign: "center", padding: "0 60px", transform: `scale(${0.85 + 0.15 * s})`, opacity: s, textShadow: "0 6px 24px rgba(0,0,0,0.55)" }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: w.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "") === hot ? b.accent : "#fff" }}>
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Stat({ g, b, font }: { g: Graphics["stat"]; b: Brand; font: string }) {
  const s = useIn(0)
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: b.primary, borderRadius: 48, padding: "70px 90px", textAlign: "center", transform: `scale(${0.8 + 0.2 * s})`, opacity: s, maxWidth: 900 }}>
        <div style={{ color: b.accent, fontFamily: font, fontWeight: 900, fontSize: 230, lineHeight: 1 }}>{g.value}</div>
        <div style={{ color: "#fff", fontFamily: font, fontWeight: 800, fontSize: 60, marginTop: 24 }}>{g.label}</div>
      </div>
    </AbsoluteFill>
  )
}

function Quote({ g, b, font }: { g: Graphics["quote"]; b: Brand; font: string }) {
  const s = useIn(0)
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <div style={{ background: "#fff", borderLeft: `24px solid ${b.accent}`, padding: "60px 70px", transform: `translateY(${(1 - s) * 80}px)`, opacity: s, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>
        <div style={{ color: b.accent, fontFamily: "Georgia, serif", fontSize: 200, lineHeight: 0.6, height: 90 }}>“</div>
        <div style={{ color: b.primary, fontFamily: font, fontWeight: 800, fontSize: 76, lineHeight: 1.2 }}>{g.text}</div>
        {g.by && <div style={{ color: "#475569", fontFamily: font, fontWeight: 600, fontSize: 46, marginTop: 30 }}>{g.by}</div>}
      </div>
    </AbsoluteFill>
  )
}

function Intro({ g, b, font }: { g: Graphics["intro"]; b: Brand; font: string }) {
  const s = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: b.primary, justifyContent: "center", alignItems: "flex-start", padding: "0 90px" }}>
      <div style={{ color: "#fff", fontFamily: font, fontWeight: 900, fontSize: 130, lineHeight: 1.02, opacity: s, transform: `translateY(${(1 - s) * 50}px)` }}>{g.title}</div>
      <div style={{ height: 18, background: b.accent, marginTop: 44, width: `${interpolate(frame, [8, 26], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%` }} />
      {g.sub && <div style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 64, lineHeight: 1.2, marginTop: 44, opacity: fade(frame, 12, 22) }}>{g.sub}</div>}
    </AbsoluteFill>
  )
}

function End({ g, b, font }: { g: Graphics["end"]; b: Brand; font: string }) {
  const s = useIn(0)
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: b.primary, justifyContent: "center", alignItems: "center", padding: "0 90px", textAlign: "center" }}>
      <div style={{ color: "#fff", fontFamily: font, fontWeight: 900, fontSize: 120, lineHeight: 1.05, opacity: s, transform: `scale(${0.9 + 0.1 * s})` }}>{g.ask}</div>
      <div style={{ height: 18, width: "40%", background: b.accent, marginTop: 60, opacity: fade(frame, 14, 26) }} />
      {g.handle && <div style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 56, marginTop: 40 }}>{g.handle}</div>}
    </AbsoluteFill>
  )
}

/** The campaign's logo, top left, as on the team's cards. */
export function LogoBug({ src }: { src: string }) {
  return <Img src={src} style={{ position: "absolute", top: 70, left: 70, width: 190, height: 190, objectFit: "contain", borderRadius: 24 }} />
}

const PLAIN = "linear-gradient(165deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)"

export function GraphicVideo({ kind, graphics, brand = BRAND_PRESETS[0], words, bare = false, logo = true }: GraphicProps) {
  const font = FONTS[brand.font]?.stack ?? FONTS.jakarta.stack
  const full = kind === "intro" || kind === "end"
  return (
    <AbsoluteFill style={{ background: bare ? "transparent" : PLAIN }}>
      {kind === "checklist" && graphics.checklist && <Checklist g={graphics.checklist} b={brand} font={font} />}
      {kind === "captions" && <Captions words={words ?? []} b={brand} font={font} />}
      {kind === "lowerThird" && <LowerThird g={graphics.lowerThird ?? { name: "", role: "" }} b={brand} font={font} />}
      {kind === "callout" && graphics.callout && <Callout g={graphics.callout} b={brand} font={font} />}
      {kind === "stat" && graphics.stat && <Stat g={graphics.stat} b={brand} font={font} />}
      {kind === "quote" && graphics.quote && <Quote g={graphics.quote} b={brand} font={font} />}
      {kind === "intro" && graphics.intro && <Intro g={graphics.intro} b={brand} font={font} />}
      {kind === "end" && graphics.end && <End g={graphics.end} b={brand} font={font} />}
      {logo && !full && brand.logo && <LogoBug src={brand.logo} />}
    </AbsoluteFill>
  )
}
