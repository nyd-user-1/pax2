import channels from "../../../lambda/velocity/channels.json"
import manifest from "../../../data/generated/model/training-set.manifest.json"
import vel from "../../../data/generated/model/velocity-model.json"
import lift from "../../../data/velocity/metadata-lift.json"
import { LoopDemo, type LoopData } from "@/components/loop-demo"
import { forecast, recommendations } from "@/lib/forecast"
import type { PollRow } from "@/lib/lab"
import { liveForecast } from "@/lib/velocity-live"
import { apStamp, baselines, recentPolls, videoMeta } from "@/lib/velocity-store"

export const metadata = { title: "Loop" }
export const dynamic = "force-dynamic"

// The closed loop on one screen, run with one real short the poller has already carried through
// its 72 hours: the pre-publish score and its reasons, the measured recommendations, the real
// curve with the velocity model's live calls, and the training files the tracked outcomes refit.

const GROUP = new Map((channels as { id: string; group: string }[]).map((c) => [c.id, c.group]))

export default async function LoopPage() {
  const [rows, medians, meta] = await Promise.all([recentPolls(10), baselines(), videoMeta()])
  const by = new Map<string, PollRow[]>()
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r])

  type Candidate = { sorted: PollRow[]; series: [number, number][]; views72: number; ratio: number; median: number }
  let pick: Candidate | null = null
  const now = Date.now()
  for (const rs of by.values()) {
    const sorted = rs.sort((a, b) => a.hour - b.hour)
    const last = sorted.at(-1)!
    const m = medians[last.channelId]?.median
    const age = (now - Date.parse(last.published)) / 3_600_000
    if (!m || age < 72 || sorted.length < 6 || !meta[last.id]) continue
    const hourly = new Map<number, number>()
    let peak = 0
    for (const r of sorted) if (r.hour <= 72) hourly.set(Math.floor(r.hour), (peak = Math.max(peak, r.views)))
    const series = [...hourly.entries()].map(([h, v]) => [h, v] as [number, number])
    if (series.length < 4) continue
    const views72 = series.at(-1)![1]
    const c: Candidate = { sorted, series, views72, ratio: views72 / m, median: m }
    // The best story is a real Hit; failing one, the closest to its channel's 3x line.
    if (!pick || (c.ratio >= 3 && pick.ratio < 3) || ((c.ratio >= 3) === (pick.ratio >= 3) && c.ratio > pick.ratio)) pick = c
  }

  let data: LoopData | null = null
  if (pick) {
    const last = pick.sorted.at(-1)!
    const m = meta[last.id]!
    const input = {
      title: m.title,
      description: m.description ?? "",
      tags: m.tags ?? [],
      durationSec: m.durationSec,
      published: m.published,
      group: GROUP.get(m.channelId) ?? "",
      channelMedian: pick.median,
    }
    const f = forecast(input)
    const recs = recommendations(input)
    const calls = [1, 3, 6]
      .map((h) => liveForecast(pick!.sorted, m, pick!.median, h))
      .filter((v): v is NonNullable<typeof v> => v != null)
      .map((v) => ({ hour: v.horizon as number, p: v.p }))
    const V = vel as unknown as { builtAt: string; qualifying: number; horizons?: Record<string, { metrics: { leaveOneChannelOut: { auc: number } } }> }
    const L = lift as unknown as { builtAt: string; videos: number; channels: number }
    const MAN = manifest as unknown as { builtAt: string; rows: number; positives: number }
    data = {
      short: { id: last.id, title: m.title, channel: last.channel, publishedAt: apStamp(m.published), durationSec: m.durationSec, median: pick.median },
      predict: {
        p: f.p,
        expectedViews: f.expected?.views ?? null,
        contributions: f.contributions.slice(0, 6).map((c) => ({ label: c.label, pull: c.pull })),
        model: { version: f.strength.version, auc: f.strength.auc, n: f.strength.n, builtAt: apStamp(f.strength.builtAt) },
      },
      recommend: {
        changes: recs.changes.slice(0, 5).map((r) => ({ action: r.action!, points: r.points, low: r.low, high: r.high, scope: r.scope })),
        keeps: recs.keeps.slice(0, 4).map((r) => ({ label: r.label, points: r.points })),
        measured: { videos: recs.measured.videos, channels: recs.measured.channels, builtAt: apStamp(recs.measured.builtAt) },
      },
      track: { series: pick.series, calls, views72: pick.views72, ratio: pick.ratio, hit: pick.ratio >= 3, readings: pick.sorted.length },
      learn: {
        trainingRows: MAN.rows,
        outliers: MAN.positives,
        setBuiltAt: apStamp(MAN.builtAt),
        velocityCurves: V.qualifying,
        velocityAuc6: V.horizons?.["6"]?.metrics.leaveOneChannelOut.auc ?? null,
        velocityBuiltAt: apStamp(V.builtAt),
        liftVideos: L.videos,
        liftBuiltAt: apStamp(L.builtAt),
      },
    }
  }
  return <LoopDemo data={data} />
}
