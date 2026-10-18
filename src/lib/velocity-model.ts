// PAX2 Velocity Classifier applied to a short's readings at a given hour: the probability it is a Hit
// at 72 hours (3x its channel's median) and which horizon's model was used: the 6-hour model from
// hour 6, the 3-hour from hour 3, the 1-hour from hour 1, nothing before. Only readings at or before
// that horizon are read, as in training (data/generated/model/velocity-model.json,
// scripts/rig/velocity.py). No imports: the caller passes the model and the pre-publish features
// (extract() from src/lib/video-features.ts), and scripts/model-check.mjs runs this under plain Node.

export type VelocityReading = { hour: number; views: number; likes: number | null; comments: number | null }

type HorizonModel = { horizon: number; intercept: number; features: { key: string; coef: number; mean: number; sd: number }[]; metrics: { leaveOneChannelOut: { auc: number | null } } }
export type VelocityModel = { name: string; qualifying: number; horizons?: Record<string, HorizonModel> }

export type VelocityForecast = { p: number; horizon: 1 | 3 | 6; auc: number | null }

/** Linear in hours on the series anchored at (0h, 0), held flat past the last reading. */
function at(h: number[], v: number[], t: number): number {
  if (!h.length || t <= 0) return 0
  let ph = 0
  let pv = 0
  for (let i = 0; i < h.length; i++) {
    if (t <= h[i]) return h[i] === ph ? v[i] : pv + ((v[i] - pv) * (t - ph)) / (h[i] - ph)
    ph = h[i]
    pv = v[i]
  }
  return pv
}

const runningMax = (xs: number[]) => xs.reduce<number[]>((a, x) => (a.push(Math.max(x, a.length ? a[a.length - 1] : -Infinity)), a), [])

export function velocityFeatures(readings: VelocityReading[], channelMedian: number, horizon: 1 | 3 | 6): Record<string, number> {
  const all = [...readings].sort((a, b) => a.hour - b.hour)
  const hasCounts = all.every((r) => r.likes != null && r.comments != null)
  const first = all.length ? all[0].hour : horizon
  const kept = all.filter((r) => r.hour <= horizon)
  const h = kept.map((r) => r.hour)
  const v = runningMax(kept.map((r) => r.views))
  const f: Record<string, number> = {}
  for (const hh of [1, 3, 6] as const) {
    if (hh > horizon) break
    const views = at(h, v, hh)
    f[`logViews${hh}h`] = Math.log10(views + 1)
    f[`ratio${hh}h`] = Math.log10((views + 1) / (channelMedian + 1))
  }
  if (horizon >= 6) {
    f.hasCounts6h = hasCounts ? 1 : 0
    f.logLikes6h = hasCounts ? Math.log10(at(h, runningMax(kept.map((r) => r.likes as number)), 6) + 1) : 0
    f.logComments6h = hasCounts ? Math.log10(at(h, runningMax(kept.map((r) => r.comments as number)), 6) + 1) : 0
  }
  f.firstHour = Math.min(first, horizon)
  return f
}

export function velocityForecast(model: VelocityModel, video: { readings: VelocityReading[]; channelMedian: number; x: Record<string, number> }, hour: number): VelocityForecast | null {
  const horizon = hour >= 6 ? 6 : hour >= 3 ? 3 : hour >= 1 ? 1 : null
  const m = horizon ? model.horizons?.[String(horizon)] : null
  if (!horizon || !m) return null
  const x = { ...video.x, ...velocityFeatures(video.readings, video.channelMedian, horizon) }
  let z = m.intercept
  for (const f of m.features) z += f.coef * (((x[f.key] ?? 0) - f.mean) / f.sd)
  return { p: 1 / (1 + Math.exp(-z)), horizon, auc: m.metrics.leaveOneChannelOut.auc }
}
