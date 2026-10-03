import { faceFor, scriptById } from "@/lib/catalog"
import type { TakeState } from "@/lib/review"
import type { VideoCardData } from "@/components/video-card"

/** What a video card needs from a take's latest scored state. */
export function cardOf(t: TakeState): VideoCardData {
  const s = t.latest?.score
  return {
    id: t.take.id,
    script: t.take.scriptId,
    scriptShort: scriptById(t.take.scriptId)?.short ?? t.take.scriptId,
    voice: t.take.voice,
    variant: [t.take.captions ? null : "no captions", t.take.cut ? "short cut" : null].filter(Boolean).join(", ") || null,
    seconds: t.take.durationSec,
    score: s?.value ?? null,
    low: s?.low ?? null,
    high: s?.high ?? null,
    status: s ? s.status : "none",
    impressions: t.latest?.snapshot.metrics.impressions.value ?? null,
    poster: faceFor(t.take.voice),
    published: t.history[0]?.snapshot.windowStart,
  }
}

export const byScore = (a: VideoCardData, b: VideoCardData) => (b.score ?? -1) - (a.score ?? -1)
