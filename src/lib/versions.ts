import "server-only"

import { chainOf, STAGE_LABEL, type OriginalRow } from "@/lib/originals"
import { pairDelta, pairsSummary, type Measured } from "@/lib/version-delta"
import { pollsFrom } from "@/lib/velocity-store"

// The Versions card's rows: every version of a video with its stage, persuasion lean, PAX2
// Classifier's chance of a Hit, and, once the poller has read it through its third day, its views
// and ratio to the channel's median at 72 hours. Version delta pairs each version with the one
// before it when both have that reading.

export type VersionRow = {
  id: string
  version: number
  stage: string
  lean: number | null
  p: number | null
  youtubeId: string | null
  /** The latest reading at or before hour 72, and the hour it was taken. */
  views: number | null
  hour: number | null
  ratio72: number | null
  current: boolean
  backfilled: boolean
  /** A backfilled cut's paid runs summed: spend, impressions and ThruPlays. */
  paid: { runs: number; spend: number; impressions: number; thruplays: number } | null
}

const watchOf = (r: OriginalRow) => r.events.filter((e) => e.kind === "watching").at(-1)

export async function versions(id: string) {
  const chain = await chainOf(id)
  if (chain.length < 2) return { rows: [] as VersionRow[], delta: null, pairs: 0 }
  const rows = await Promise.all(
    chain.map(async (r): Promise<VersionRow> => {
      const w = watchOf(r)
      const median = r.evaluation?.forecast?.anchor.median ?? null
      let views: number | null = null
      let hour: number | null = null
      if (w?.youtubeId) {
        // The poller's partitions from the day before it went live through its fourth day.
        const from = new Date(Date.parse(w.published ?? w.at) - 864e5).toISOString()
        const readings = (await pollsFrom(from, 5).catch(() => [])).filter((x) => x.id === w.youtubeId && x.hour <= 72).sort((a, b) => a.hour - b.hour)
        const last = readings.at(-1)
        if (last) {
          views = last.views
          hour = last.hour
        }
      }
      return {
        id: r.id,
        version: r.version,
        stage: STAGE_LABEL[r.stage],
        lean: r.evaluation?.lean ?? null,
        p: r.evaluation?.forecast?.p ?? null,
        youtubeId: w?.youtubeId ?? null,
        views,
        hour,
        // A 72-hour reading is one taken in the last hour of the third day.
        ratio72: views != null && hour != null && hour >= 71 && median ? views / median : null,
        current: r.id === id,
        backfilled: r.provenance === "backfilled",
        paid: r.paid?.length
          ? { runs: r.paid.length, spend: r.paid.reduce((t, p) => t + p.spend_usd, 0), impressions: r.paid.reduce((t, p) => t + p.impressions, 0), thruplays: r.paid.reduce((t, p) => t + p.views_15s_thruplays_reported, 0) }
          : null,
      }
    }),
  )
  const measured = rows.filter((r): r is VersionRow & { ratio72: number } => r.ratio72 != null)
  const pairs = measured.slice(1).map((b, i) => pairDelta(measured[i] as Measured, b as Measured))
  return { rows, delta: pairsSummary(pairs), pairs: pairs.length }
}
