import "server-only"

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

import type { PollRow } from "@/lib/lab"

// The velocity poller's state in S3 (written by lambda/velocity): readings partitioned by UTC day,
// channel baselines, the hourly stat card snapshots and the poller's own run state.

const BUCKET = process.env.VELOCITY_BUCKET ?? "pax-2-velocity-638175140432"
const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })

async function getText(key: string): Promise<string | null> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `velocity/${key}` }))
    return (await r.Body?.transformToString()) ?? null
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null
    throw e
  }
}

const lines = <T,>(t: string | null): T[] => (t ?? "").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T)

/** Every reading from the last `days` UTC days, oldest day first. */
export async function recentPolls(days = 7): Promise<PollRow[]> {
  const keys = Array.from({ length: days }, (_, i) => `polls/${new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10)}.jsonl`)
  return (await Promise.all(keys.map(getText))).flatMap((t) => lines<PollRow>(t))
}

// The poller writes every 15 minutes; an hourly per-server copy (every 15-minute reading included),
// shared by concurrent requests, spares each page view the download of a week of poll files.
const recentCache = new Map<number, { at: number; rows: Promise<PollRow[]> }>()

/** recentPolls, cached for an hour per server. */
export function recentPollsCached(days = 7): Promise<PollRow[]> {
  const hit = recentCache.get(days)
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.rows
  const rows = recentPolls(days)
  recentCache.set(days, { at: Date.now(), rows })
  rows.catch(() => recentCache.delete(days))
  return rows
}

/** Every reading from `days` UTC days starting at `from`, for a video whose first hours are older
 *  than the last week. */
export async function pollsFrom(from: string, days: number): Promise<PollRow[]> {
  const start = Date.parse(from.slice(0, 10))
  const keys = Array.from({ length: days }, (_, i) => `polls/${new Date(start + i * 864e5).toISOString().slice(0, 10)}.jsonl`)
  return (await Promise.all(keys.map(getText))).flatMap((t) => lines<PollRow>(t))
}

export async function baselines(): Promise<Record<string, { median: number | null }>> {
  return JSON.parse((await getText("baselines.json")) ?? "{}")
}

export type StatSnapshot = { at: string; shorts: number; channels: number; hits: number; misses: number; tracking: number; live: number }

export async function snapshots(): Promise<StatSnapshot[]> {
  return lines<StatSnapshot>(await getText("tiles.jsonl"))
}

export type PollerState = { lastRunAt?: string; lastWatched?: number; discoveredAt?: string; catalogAt?: string }

export async function pollerState(): Promise<PollerState> {
  return JSON.parse((await getText("state.json")) ?? "{}")
}

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]

/** "Oct. 7, 2026 7:32 a.m." in Eastern time. */
export function apStamp(iso: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${AP_MONTHS[Number(parts.month) - 1]} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod === "AM" ? "a.m." : "p.m."}`
}

export type WatchEntry = { youtubeId: string; original: string; at: string }

/** Videos PAX2 published, which the poller watches beside the 65 channels' uploads. */
export async function watchList(): Promise<WatchEntry[]> {
  return JSON.parse((await getText("watch.json")) ?? "[]")
}

export async function addToWatch(entry: WatchEntry) {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const list = (await watchList()).filter((w) => w.youtubeId !== entry.youtubeId)
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "velocity/watch.json", Body: JSON.stringify([...list, entry]), ContentType: "application/json" }))
}

export type VideoMeta = { at: string; channelId: string; published: string; title: string; description: string; tags: string[]; categoryId: string | null; language: string | null; thumbnail: string | null; durationSec: number; captions: boolean; definition: string | null; madeForKids: boolean | null; topics: string[] }

/** Everything YouTube returns about each polled video beyond its counts, by YouTube id; null when it was deleted or made private. */
export async function videoMeta(): Promise<Record<string, VideoMeta | null>> {
  return JSON.parse((await getText("meta.json")) ?? "{}")
}
