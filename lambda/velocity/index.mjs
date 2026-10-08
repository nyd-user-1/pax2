// The velocity poller, as a Lambda on a 15-minute EventBridge schedule (rule hermes-velocity-poll,
// switched on and off from /dashboard). Every run re-reads the counts of every short the tracked
// channels published in the last 72 hours; every 30 minutes it also scans the channels for new
// uploads. Daily: each channel's baseline (median views of its settled shorts) and the 18-month
// lookback catalog. Hourly: the /break-out stat card snapshot. All state lives in S3 under velocity/;
// readings are partitioned by UTC day. Invoked with { mode: "snapshot" } it only recomputes the
// stat card snapshot. The YouTube key comes from the YOUTUBE_API_KEY environment variable.
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const BUCKET = process.env.VELOCITY_BUCKET ?? "pax-638175140432"
const P = "velocity/"
const WINDOW_H = 72
const SETTLED_H = 7 * 24
const DISCOVER_EVERY_MIN = 30
const CATALOG_EVERY_H = 24
const SNAPSHOT_EVERY_MIN = 55
const LOOKBACK_DAYS = 548

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
const CHANNELS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "channels.json"), "utf8"))
const groupOf = Object.fromEntries(CHANNELS.map((c) => [c.id, c.group]))

const getText = async (key) => {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: P + key }))
    return await r.Body.transformToString()
  } catch (e) {
    if (e.name === "NoSuchKey") return null
    throw e
  }
}
const getJson = async (key, fallback) => {
  const t = await getText(key)
  return t == null ? fallback : JSON.parse(t)
}
const put = (key, body, type = "application/json") => s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: P + key, Body: body, ContentType: type }))
const lines = (t) => (t ?? "").split("\n").filter(Boolean).map((l) => JSON.parse(l))
const day = (d) => d.toISOString().slice(0, 10)

const api = async (route, params) => {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${route}?${new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY })}`)
  const j = await r.json()
  if (j.error) throw new Error(`${route}: ${j.error.message}`)
  return j
}
const videos = async (ids, part = "snippet,statistics") => {
  const items = []
  for (let i = 0; i < ids.length; i += 50) items.push(...((await api("videos", { part, id: ids.slice(i, i + 50).join(",") })).items ?? []))
  return items
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}
const secs = (iso) => {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0
}

/** Readings from the last few days, enough to cover every short still inside its window. */
async function recentReadings(now, days = 5) {
  const out = []
  for (let i = 0; i < days; i++) out.push(...lines(await getText(`polls/${day(new Date(now - i * 864e5))}.jsonl`)))
  return out
}

/** The 18-month lookback: every short's lifetime counts, labeled against its channel's settled median. */
async function harvestCatalog(now) {
  const since = now - LOOKBACK_DAYS * 864e5
  const settledBy = now - SETTLED_H * 3_600_000
  const all = []
  for (const ch of CHANNELS) {
    try {
      const ids = []
      let tok = ""
      do {
        const j = await api("playlistItems", { part: "contentDetails", maxResults: "50", playlistId: `UUSH${ch.id.slice(2)}`, ...(tok && { pageToken: tok }) })
        const items = j.items ?? []
        for (const it of items) if (Date.parse(it.contentDetails.videoPublishedAt) >= since) ids.push(it.contentDetails.videoId)
        const oldest = Math.min(...items.map((it) => Date.parse(it.contentDetails.videoPublishedAt)))
        tok = items.length && oldest >= since ? j.nextPageToken : ""
      } while (tok)
      const vs = (await videos(ids, "snippet,statistics,contentDetails")).map((v) => ({
        id: v.id,
        channelId: ch.id,
        channel: ch.name,
        group: ch.group,
        title: v.snippet.title,
        description: (v.snippet.description ?? "").slice(0, 600),
        tags: v.snippet.tags ?? [],
        published: v.snippet.publishedAt,
        durationSec: secs(v.contentDetails.duration),
        views: Number(v.statistics.viewCount ?? 0),
        likes: v.statistics.likeCount == null ? null : Number(v.statistics.likeCount),
        comments: v.statistics.commentCount == null ? null : Number(v.statistics.commentCount),
      }))
      const med = median(vs.filter((v) => Date.parse(v.published) <= settledBy).map((v) => v.views)) || 1
      for (const v of vs) {
        const settled = Date.parse(v.published) <= settledBy
        v.channelMedian = med
        v.ratio = Math.round((v.views / med) * 100) / 100
        v.tier = !settled ? "unsettled" : v.ratio >= 3 ? "breakout" : v.ratio <= 0.5 ? "killed" : "baseline"
        all.push(v)
      }
    } catch (e) {
      console.error(`catalog ${ch.name}: ${e.message}`)
    }
  }
  const settled = all.filter((v) => v.tier !== "unsettled")
  const summary = {
    at: new Date(now).toISOString(),
    shorts: settled.length,
    channels: new Set(all.map((v) => v.channelId)).size,
    hits: settled.filter((v) => v.tier === "breakout").length,
    misses: settled.filter((v) => v.tier === "killed").length,
  }
  await put("catalog.json", JSON.stringify({ fetchedAt: summary.at, source: "YouTube Data API v3, shorts playlists, 18-month lookback", videos: all }))
  await put("catalog-summary.json", JSON.stringify(summary))
  return summary
}

/** The five /break-out stat card numbers right now, appended to the snapshot history. */
async function snapshot(now, readings, baselines) {
  const summary = await getJson("catalog-summary.json", null)
  if (!summary) return null
  const latest = new Map()
  for (const r of readings) if (!latest.has(r.id) || r.hour > latest.get(r.id).hour) latest.set(r.id, r)
  const tracking = [...latest.values()].filter((r) => (now - Date.parse(r.published)) / 3_600_000 < WINDOW_H)
  const snap = {
    at: new Date(now).toISOString(),
    shorts: summary.shorts,
    channels: summary.channels,
    hits: summary.hits,
    misses: summary.misses,
    tracking: tracking.length,
    live: tracking.filter((r) => baselines[r.channelId]?.median && r.views / baselines[r.channelId].median >= 3).length,
  }
  const history = (await getText("tiles.jsonl")) ?? ""
  await put("tiles.jsonl", history + JSON.stringify(snap) + "\n", "application/x-ndjson")
  return snap
}

export async function handler(event = {}) {
  const now = Date.now()
  const ageH = (iso) => (now - Date.parse(iso)) / 3_600_000
  const baselines = await getJson("baselines.json", {})

  if (event.mode === "snapshot") return { snapshot: await snapshot(now, await recentReadings(now), baselines) }

  const state = await getJson("state.json", {})
  const discover = !state.discoveredAt || ageH(state.discoveredAt) * 60 >= DISCOVER_EVERY_MIN - 2

  // New uploads sit at the top of each channel's shorts playlist (UUSH + the id after "UC").
  const fresh = new Set()
  for (const ch of discover ? CHANNELS : []) {
    try {
      const items = (await api("playlistItems", { part: "contentDetails", maxResults: "50", playlistId: `UUSH${ch.id.slice(2)}` })).items ?? []
      for (const it of items) if (ageH(it.contentDetails.videoPublishedAt) <= WINDOW_H) fresh.add(it.contentDetails.videoId)
      const b = baselines[ch.id]
      if (!b || ageH(b.at) >= 24) {
        const settled = items.filter((it) => ageH(it.contentDetails.videoPublishedAt) >= SETTLED_H).map((it) => it.contentDetails.videoId)
        const views = (await videos(settled)).map((v) => Number(v.statistics.viewCount ?? 0))
        baselines[ch.id] = { median: median(views), n: views.length, at: new Date(now).toISOString() }
      }
    } catch (e) {
      console.error(`${ch.name}: ${e.message}`)
    }
  }

  // Keep watching anything already under watch that is still inside its window.
  const readings = await recentReadings(now)
  for (const r of readings) if (ageH(r.published) <= WINDOW_H) fresh.add(r.id)
  // Videos Hermes published (written by the app's publishing step), watched beside the channels' uploads.
  for (const w of await getJson("watch.json", [])) if (ageH(w.at) <= WINDOW_H) fresh.add(w.youtubeId)

  const rows = (await videos([...fresh])).map((v) => ({
    at: new Date(now).toISOString(),
    id: v.id,
    channelId: v.snippet.channelId,
    channel: v.snippet.channelTitle,
    group: groupOf[v.snippet.channelId] ?? null,
    title: v.snippet.title,
    published: v.snippet.publishedAt,
    hour: Math.round(ageH(v.snippet.publishedAt) * 10) / 10,
    views: Number(v.statistics.viewCount ?? 0),
    likes: v.statistics.likeCount == null ? null : Number(v.statistics.likeCount),
    comments: v.statistics.commentCount == null ? null : Number(v.statistics.commentCount),
  }))

  // Each video's metadata, fetched once: everything YouTube returns beyond the counts (same quota as a
  // counts call). The first run with this code backfills every video in the recent readings.
  const meta = await getJson("meta.json", {})
  const missing = [...new Set([...readings, ...rows].map((r) => r.id))].filter((id) => !(id in meta))
  if (missing.length) {
    const got = new Map((await videos(missing, "snippet,contentDetails,status,topicDetails")).map((v) => [v.id, v]))
    for (const id of missing) {
      const v = got.get(id)
      if (!v) {
        meta[id] = null // deleted or private; not asked again
        continue
      }
      const s = v.snippet
      const t = s.thumbnails ?? {}
      meta[id] = {
        at: new Date(now).toISOString(),
        channelId: s.channelId,
        published: s.publishedAt,
        title: s.title,
        description: s.description ?? "",
        tags: s.tags ?? [],
        categoryId: s.categoryId ?? null,
        language: s.defaultAudioLanguage ?? s.defaultLanguage ?? null,
        thumbnail: (t.maxres ?? t.standard ?? t.high ?? t.default)?.url ?? null,
        durationSec: secs(v.contentDetails?.duration),
        captions: v.contentDetails?.caption === "true",
        definition: v.contentDetails?.definition ?? null,
        madeForKids: v.status?.madeForKids ?? null,
        topics: (v.topicDetails?.topicCategories ?? []).map((u) => decodeURIComponent(u.split("/").pop()).replace(/_/g, " ")),
      }
    }
    await put("meta.json", JSON.stringify(meta))
  }

  const todayKey = `polls/${day(new Date(now))}.jsonl`
  if (rows.length) await put(todayKey, ((await getText(todayKey)) ?? "") + rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "application/x-ndjson")
  await put("baselines.json", JSON.stringify(baselines))
  const nextState = { ...state, lastRunAt: new Date(now).toISOString(), lastWatched: rows.length, ...(discover && { discoveredAt: new Date(now).toISOString() }) }

  let catalog = null
  if (!state.catalogAt || ageH(state.catalogAt) >= CATALOG_EVERY_H) {
    catalog = await harvestCatalog(now)
    nextState.catalogAt = new Date(now).toISOString()
  }
  let snap = null
  const history = (await getText("tiles.jsonl")) ?? ""
  const last = history.trim().split("\n").filter(Boolean).at(-1)
  if (catalog || !last || ageH(JSON.parse(last).at) * 60 >= SNAPSHOT_EVERY_MIN) snap = await snapshot(now, [...readings, ...rows], baselines)
  await put("state.json", JSON.stringify(nextState))

  const summary = { watched: rows.length, scanned: discover ? CHANNELS.length : 0, catalog: catalog?.shorts ?? null, snapshot: !!snap }
  console.log(JSON.stringify(summary))
  return summary
}
