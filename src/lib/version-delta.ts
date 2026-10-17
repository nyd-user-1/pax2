// Version delta: a computation, not a model. Two versions of one video, both read by the poller at
// 72 hours, compared on their ratio to the channel's median: the difference and the log ratio.
// Over many such pairs, the mean paired difference with a bootstrap 90% range over pairs.

export type Measured = { id: string; version: number; ratio72: number }
export type PairDelta = { from: string; to: string; diff: number; logRatio: number }

export function pairDelta(a: Measured, b: Measured): PairDelta {
  return { from: a.id, to: b.id, diff: b.ratio72 - a.ratio72, logRatio: Math.log(Math.max(1e-6, b.ratio72) / Math.max(1e-6, a.ratio72)) }
}

/** A small seeded generator, so the same pairs always give the same range. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pairsSummary(pairs: PairDelta[], resamples = 2000): { n: number; mean: number; low: number; high: number; meanLogRatio: number } | null {
  if (!pairs.length) return null
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const diffs = pairs.map((p) => p.diff)
  const rand = mulberry32(pairs.length * 7919)
  const means = Array.from({ length: resamples }, () => mean(diffs.map(() => diffs[Math.floor(rand() * diffs.length)]))).sort((a, b) => a - b)
  return { n: pairs.length, mean: mean(diffs), low: means[Math.floor(resamples * 0.05)], high: means[Math.ceil(resamples * 0.95) - 1], meanLogRatio: mean(pairs.map((p) => p.logRatio)) }
}
