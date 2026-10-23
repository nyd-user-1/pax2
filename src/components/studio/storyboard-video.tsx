import * as React from "react"
import { AbsoluteFill, Audio, Sequence, Video } from "remotion"

import { GraphicVideo, LogoBug, type TimedWord } from "@/components/studio/graphic-video"
import { FULL_FRAME, type Brand, type GraphicKind, type Graphics } from "@/lib/footage"
import { FPS } from "@/lib/studio-style"

// The whole short as the storyboard lays it out: line after line, each line's shot full-bleed (a plain
// field until it is generated) with its graphic over it; the captions and the lower third across the
// top; the campaign's logo top left; the narration underneath. When the voice runs longer than the
// shots, the last line holds until it ends.

export type StoryRow = { seconds: number; clip?: string | null; graphic: GraphicKind | null }
export type StoryboardProps = { rows: StoryRow[]; graphics: Graphics; brand: Brand; captions: boolean; lowerThird: boolean; words: TimedWord[]; voiceUrl?: string | null; voiceSeconds?: number }

/** Each line's first frame and length, and the whole, at `fps`. */
export function storyTiming(rows: StoryRow[], fps: number, voiceSeconds = 0) {
  const lens = rows.map((r) => Math.max(1, Math.round(r.seconds * fps)))
  const sum = lens.reduce((a, b) => a + b, 0)
  const voice = Math.round(voiceSeconds * fps)
  if (lens.length && voice > sum) lens[lens.length - 1] += voice - sum
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0))
  return { starts, lens, total: Math.max(fps, lens.reduce((a, b) => a + b, 0)) }
}

const PLAIN = "linear-gradient(165deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)"

export function StoryboardVideo({ rows, graphics, brand, captions, lowerThird, words, voiceUrl, voiceSeconds = 0 }: StoryboardProps) {
  const { starts, lens } = storyTiming(rows, FPS, voiceSeconds)
  return (
    <AbsoluteFill style={{ background: PLAIN }}>
      {rows.map((r, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={lens[i]}>
          <AbsoluteFill style={{ background: PLAIN }}>
            {r.clip && <Video src={r.clip} muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            {r.graphic && r.graphic !== "captions" && r.graphic !== "lowerThird" && <GraphicVideo kind={r.graphic} graphics={graphics} brand={brand} bare logo={false} />}
          </AbsoluteFill>
        </Sequence>
      ))}
      {lowerThird && (
        <Sequence from={0} durationInFrames={4 * FPS}>
          <GraphicVideo kind="lowerThird" graphics={graphics} brand={brand} bare logo={false} />
        </Sequence>
      )}
      {captions && <GraphicVideo kind="captions" graphics={graphics} brand={brand} words={words} bare logo={false} />}
      {brand.logo && <LogoOutsideFullFrame rows={rows} starts={starts} lens={lens} src={brand.logo} />}
      {voiceUrl && <Audio src={voiceUrl} />}
    </AbsoluteFill>
  )
}

/** The logo on every line except the full-frame cards, which carry their own field. */
function LogoOutsideFullFrame({ rows, starts, lens, src }: { rows: StoryRow[]; starts: number[]; lens: number[]; src: string }) {
  return (
    <>
      {rows.map((r, i) =>
        r.graphic && FULL_FRAME.includes(r.graphic) ? null : (
          <Sequence key={i} from={starts[i]} durationInFrames={lens[i]}>
            <LogoBug src={src} />
          </Sequence>
        ),
      )}
    </>
  )
}
