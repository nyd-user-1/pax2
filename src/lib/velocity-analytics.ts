import "server-only"

import channelsJson from "../../data/velocity/channels.json"
import subsJson from "../../data/generated/channel-subscribers.json"

import { tierOf, type Tier } from "@/lib/lab"
import { baselines, recentPolls, videoMeta } from "@/lib/velocity-store"

// Everything the poller has written since live tracking began (2026-10-06), shaped for
// /patterns and /graph: one summary row per video, its full 15-minute series inside the
// 72-hour window, publish-time bins in Eastern time, and per-channel aggregates.

const START = Date.UTC(2026, 9, 6)

export type PatternVideo = {
  id: string
  title: string
  channel: string
  channelId: string
  group: string
  published: string
  median: number | null
  ratio: number | null
  tier: Tier
  views: number
  likes: number | null
  comments: number | null
  durationSec: number | null
  tags: string[]
  topics: string[]
  pubDow: number // 0 = Monday … 6 = Sunday, Eastern time
  pubHour: number // 0–23, Eastern time
}

export type PatternsData = {
  videos: PatternVideo[]
  /** id -> [hours since publish (2 dp), views] for every 15-minute reading inside 0–72h. */
  series: Record<string, [number, number][]>
  /** [dow][hour] publish bins: how many, how many ended above 3x. */
  heat: { n: number; pushed: number }[][]
  channels: { id: string; name: string; group: string; subs: number | null; median: number | null; n: number; pushed: number; killed: number }[]
  start: string
  readings: number
}

const CH = channelsJson as { id: string; name: string; group: string }[]
const SUBS = subsJson as Record<string, number | null>

const et = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false })
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
function etBin(iso: string): { dow: number; hour: number } {
  const parts = et.formatToParts(new Date(iso))
  const dow = DOW.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Mon")
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24
  return { dow: Math.max(0, dow), hour }
}

let cache: { at: number; data: PatternsData } | null = null

export async function patternsData(): Promise<PatternsData> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.data
  const days = Math.min(60, Math.ceil((Date.now() - START) / 864e5) + 1)
  const [rows, meds, meta] = await Promise.all([recentPolls(days), baselines(), videoMeta()])
  const chName = new Map(CH.map((c) => [c.id, c.name]))
  const chGroup = new Map(CH.map((c) => [c.id, c.group]))

  const by = new Map<string, typeof rows>()
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r])

  const videos: PatternVideo[] = []
  const series: Record<string, [number, number][]> = {}
  for (const rs of by.values()) {
    // A cumulative count never falls; dips in the readings are API noise, clamped away.
    let peak = 0
    const sorted = rs.sort((a, b) => a.hour - b.hour).map((r) => ({ ...r, views: (peak = Math.max(peak, r.views)) }))
    const last = sorted.at(-1)!
    const m = meds[last.channelId]?.median ?? null
    const v = meta[last.id] ?? null
    series[last.id] = sorted.filter((r) => r.hour <= 72).map((r) => [Math.round(r.hour * 100) / 100, r.views])
    videos.push({
      id: last.id,
      title: (last.title ?? "").replace(/\s*#\w+/g, "").trim() || last.title,
      channel: last.channel,
      channelId: last.channelId,
      group: chGroup.get(last.channelId) ?? "other",
      published: last.published,
      median: m,
      ratio: m ? last.views / m : null,
      tier: tierOf(m ? last.views / m : 1),
      views: last.views,
      likes: last.likes ?? null,
      comments: last.comments ?? null,
      durationSec: v?.durationSec ?? null,
      tags: v?.tags ?? [],
      topics: v?.topics ?? [],
      pubDow: etBin(last.published).dow,
      pubHour: etBin(last.published).hour,
    })
  }

  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, pushed: 0 })))
  for (const v of videos) {
    const cell = heat[v.pubDow][v.pubHour]
    cell.n += 1
    if (v.tier === "breakout") cell.pushed += 1
  }

  const channels = CH.map((c) => {
    const vs = videos.filter((v) => v.channelId === c.id)
    return {
      id: c.id,
      name: c.name,
      group: c.group,
      subs: SUBS[c.id] ?? null,
      median: meds[c.id]?.median ?? null,
      n: vs.length,
      pushed: vs.filter((v) => v.tier === "breakout").length,
      killed: vs.filter((v) => v.tier === "killed").length,
    }
  }).filter((c) => c.n > 0)

  const data: PatternsData = { videos, series, heat, channels, start: "2026-10-06", readings: rows.length }
  cache = { at: Date.now(), data }
  return data
}
