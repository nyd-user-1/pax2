// The velocity poller: every 15 minutes, every short the tracked channels published in the last 72
// hours, with its public counts, appended as one row per video to data/velocity/polls.jsonl. New
// uploads are looked for every 30 minutes (the channel scan is the costly call; re-reading counts
// is about 3 quota units a pass).
// Once a day it also refreshes each channel's baseline — the median views of its settled shorts —
// which every Breakout label is divided by. Run by the com.hermes.velocity LaunchAgent; the key is
// read from .env.local and never printed. Channels and their groups live in data/velocity/channels.json.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIR = path.join(root, "data/velocity")
const OUT = path.join(DIR, "polls.jsonl")
const BASE = path.join(DIR, "baselines.json")
const WINDOW_H = 72
const SETTLED_H = 7 * 24
const BASELINE_EVERY_H = 24
const DISCOVER_EVERY_MIN = 30
const STATE = path.join(DIR, "state.json")

const CHANNELS = JSON.parse(fs.readFileSync(path.join(DIR, "channels.json"), "utf8"))
const groupOf = Object.fromEntries(CHANNELS.map((c) => [c.id, c.group]))

const env = fs.readFileSync(path.join(root, ".env.local"), "utf8")
const KEY = env.match(/^YOUTUBE_API_KEY=(.*)$/m)?.[1]?.replace(/^"|"$/g, "").trim()
if (!KEY) throw new Error("YOUTUBE_API_KEY missing from .env.local")

const api = async (route, params) => {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${route}?${new URLSearchParams({ ...params, key: KEY })}`)
  const j = await r.json()
  if (j.error) throw new Error(`${route}: ${j.error.message}`)
  return j
}
const videos = async (ids) => {
  const items = []
  for (let i = 0; i < ids.length; i += 50) items.push(...((await api("videos", { part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") })).items ?? []))
  return items
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}

const now = new Date()
const ageH = (iso) => (now.getTime() - new Date(iso).getTime()) / 3_600_000
const baselines = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, "utf8")) : {}

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {}
const discover = !state.discoveredAt || ageH(state.discoveredAt) * 60 >= DISCOVER_EVERY_MIN - 2

// New uploads sit at the top of each channel's shorts playlist (UUSH + the id after "UC").
const fresh = new Set()
for (const ch of discover ? CHANNELS : []) {
  try {
    const j = await api("playlistItems", { part: "contentDetails", maxResults: "50", playlistId: `UUSH${ch.id.slice(2)}` })
    const items = j.items ?? []
    for (const it of items) if (ageH(it.contentDetails.videoPublishedAt) <= WINDOW_H) fresh.add(it.contentDetails.videoId)
    const b = baselines[ch.id]
    if (!b || ageH(b.at) >= BASELINE_EVERY_H) {
      const settled = items.filter((it) => ageH(it.contentDetails.videoPublishedAt) >= SETTLED_H).map((it) => it.contentDetails.videoId)
      const views = (await videos(settled)).map((v) => Number(v.statistics.viewCount ?? 0))
      baselines[ch.id] = { median: median(views), n: views.length, at: now.toISOString() }
    }
  } catch (e) {
    console.error(`${now.toISOString()} ${ch.name}: ${e.message}`)
  }
}

// Keep watching anything already under watch that is still inside its window.
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line) continue
    const row = JSON.parse(line)
    if (ageH(row.published) <= WINDOW_H) fresh.add(row.id)
  }
}

const rows = (await videos([...fresh])).map((v) => ({
  at: now.toISOString(),
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

fs.mkdirSync(DIR, { recursive: true })
fs.writeFileSync(BASE, JSON.stringify(baselines, null, 1) + "\n")
if (discover) fs.writeFileSync(STATE, JSON.stringify({ ...state, discoveredAt: now.toISOString() }) + "\n")
if (rows.length) fs.appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n")
console.log(`${now.toISOString()} watched ${rows.length} video(s)${discover ? ` · scanned ${CHANNELS.length} channels` : ""}`)

// Once a day the lookback catalog is re-harvested, so settled shorts keep joining the counts.
const CATALOG = path.join(DIR, "catalog.json")
const catalogAt = fs.existsSync(CATALOG) ? fs.statSync(CATALOG).mtimeMs : 0
if (Date.now() - catalogAt >= 24 * 3_600_000) {
  const r = spawnSync(process.execPath, [path.join(root, "scripts/yt-catalog.mjs")], { cwd: root, encoding: "utf8" })
  console.log(`${new Date().toISOString()} catalog re-harvest ${r.status === 0 ? "done" : `failed: ${(r.stderr || "").slice(-300)}`}`)
}

// Once an hour, the five /break-out tile numbers, so the page can show how each has moved.
const TILES = path.join(DIR, "tiles.jsonl")
const lastTile = fs.existsSync(TILES) ? fs.readFileSync(TILES, "utf8").trim().split("\n").filter(Boolean).at(-1) : null
if (!lastTile || ageH(JSON.parse(lastTile).at) >= 55 / 60) {
  const { videos: cat } = JSON.parse(fs.readFileSync(CATALOG, "utf8"))
  const settled = cat.filter((v) => v.tier !== "unsettled")
  const latest = new Map()
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line) continue
    const r = JSON.parse(line)
    if (!latest.has(r.id) || r.hour > latest.get(r.id).hour) latest.set(r.id, r)
  }
  const tracking = [...latest.values()].filter((r) => ageH(r.published) < WINDOW_H)
  const snap = {
    at: now.toISOString(),
    shorts: settled.length,
    channels: new Set(cat.map((v) => v.channelId)).size,
    hits: settled.filter((v) => v.tier === "breakout").length,
    misses: settled.filter((v) => v.tier === "killed").length,
    tracking: tracking.length,
    live: tracking.filter((r) => baselines[r.channelId]?.median && r.views / baselines[r.channelId].median >= 3).length,
  }
  fs.appendFileSync(TILES, JSON.stringify(snap) + "\n")
}
