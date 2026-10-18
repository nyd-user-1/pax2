import "server-only"

import model from "../../data/generated/model/velocity-model.json"
import channels from "../../lambda/velocity/channels.json"
import type { PollRow } from "@/lib/lab"
import { velocityForecast, type VelocityForecast, type VelocityModel } from "@/lib/velocity-model"
import type { VideoMeta } from "@/lib/velocity-store"
import { extract } from "@/lib/video-features"

// PAX2 Velocity Classifier on the poller's live rows: for a short under watch, the chance it ends
// its 72 hours as a Hit (3x its channel's median) from the readings it has so far; for a short that
// has finished, the call the model would have made at hour 6, to set beside the verdict. The model
// needs the short's pre-publish features too (title, tags, length, when it went out), which come from
// the poller's meta.json; without them, or without a channel median, there is no forecast.

const VEL = model as unknown as VelocityModel
const GROUP = new Map((channels as { id: string; group: string }[]).map((c) => [c.id, c.group]))

/** What the model file says about itself, for the footer; nothing typed in. */
export const VELOCITY_STRENGTH = (() => {
  const h6 = VEL.horizons?.["6"]
  const h3 = VEL.horizons?.["3"]
  const h1 = VEL.horizons?.["1"]
  return { shorts: VEL.qualifying, auc1: h1?.metrics.leaveOneChannelOut.auc ?? null, auc3: h3?.metrics.leaveOneChannelOut.auc ?? null, auc6: h6?.metrics.leaveOneChannelOut.auc ?? null }
})()

export function liveForecast(rows: PollRow[], meta: VideoMeta | null | undefined, median: number | null | undefined, hour: number): VelocityForecast | null {
  if (!meta || median == null || !rows.length) return null
  const x = extract({ title: meta.title, description: meta.description ?? "", tags: meta.tags ?? [], durationSec: meta.durationSec, published: meta.published, group: GROUP.get(meta.channelId) ?? "", channelMedian: median })
  const readings = rows.map((r) => ({ hour: r.hour, views: r.views, likes: r.likes ?? null, comments: r.comments ?? null }))
  return velocityForecast(VEL, { readings, channelMedian: median, x }, hour)
}
