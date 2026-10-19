import "@xyflow/react/dist/style.css"

import fs from "node:fs"
import path from "node:path"

import manifest from "../../../data/generated/model/training-set.manifest.json"
import varModel from "../../../data/generated/model/var-model.json"
import vel from "../../../data/generated/model/velocity-model.json"
import velFeatures from "../../../data/generated/model/velocity-features.json"
import lift from "../../../data/velocity/metadata-lift.json"
import { LoopDemo, type LoopData, type TickerItem } from "@/components/loop-demo"
import type { PollRow } from "@/lib/lab"
import { liveForecast } from "@/lib/velocity-live"
import { apStamp, baselines, recentPolls, videoMeta } from "@/lib/velocity-store"

export const metadata = { title: "Loop" }
export const dynamic = "force-dynamic"

// The closed loop, drawn live: aggregate counts on the stages, the poller's freshest shorts in the
// hub, the model files' own fit times on Score and Learn.

const catalogCount = (() => {
  try {
    return (JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/velocity/catalog.json"), "utf8")) as { videos: unknown[] }).videos.length
  } catch {
    return (manifest as { rows: number }).rows
  }
})()

export default async function LoopPage() {
  const [rows, medians, meta] = await Promise.all([recentPolls(10), baselines(), videoMeta()])
  const by = new Map<string, PollRow[]>()
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r])
  const now = Date.now()
  const ticker: TickerItem[] = [...by.values()]
    .map((rs) => rs.sort((a, b) => a.hour - b.hour))
    .sort((a, b) => Date.parse(b.at(-1)!.published) - Date.parse(a.at(-1)!.published))
    .slice(0, 10)
    .map((rs) => {
      const last = rs.at(-1)!
      const m = meta[last.id]
      const median = medians[last.channelId]?.median
      const age = (now - Date.parse(last.published)) / 3_600_000
      const f = m && median ? liveForecast(rs, m, median, Math.min(age, 6)) : null
      return { title: (m?.title ?? last.title).replace(/\s*#\w+/g, "").trim(), channel: last.channel, p: f?.p ?? null, views: last.views, hour: Math.min(age, 72) }
    })

  const V = vel as unknown as { builtAt: string; qualifying: number }
  const VM = varModel as unknown as { builtAt: string; image: { metrics: { leaveOneChannelOut: { auc: number } } } }
  const L = lift as unknown as { videos: number }
  const MAN = manifest as unknown as { rows: number; positives: number; channels: number }
  const VF = velFeatures as unknown as { readings: number }
  const data: LoopData = {
    ticker,
    stats: {
      catalog: catalogCount,
      channels: MAN.channels,
      scored: MAN.rows,
      outliers: MAN.positives,
      classifierAuc: VM.image.metrics.leaveOneChannelOut.auc,
      classifierFit: apStamp(VM.builtAt),
      liftVideos: L.videos,
      watched: by.size,
      readings: VF.readings,
      curves: V.qualifying,
      velocityFit: apStamp(V.builtAt),
    },
  }
  return <LoopDemo data={data} />
}
