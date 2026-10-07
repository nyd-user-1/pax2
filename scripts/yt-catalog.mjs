// The lookback: every short the tracked channels posted in the last 18 months, with lifetime counts,
// labeled the way /break-out labels — views over the channel's own median of settled shorts
// (3x and up pushed, half or less killed). Writes data/velocity/catalog.json. Free quota only.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIR = path.join(root, "data/velocity")
const CHANNELS = JSON.parse(fs.readFileSync(path.join(DIR, "channels.json"), "utf8"))
const KEY = fs.readFileSync(path.join(root, ".env.local"), "utf8").match(/^YOUTUBE_API_KEY=(.*)$/m)?.[1]?.replace(/^"|"$/g, "").trim()
const SINCE = Date.now() - 548 * 864e5
const SETTLED = Date.now() - 7 * 864e5

const api = async (route, params) => {
  const j = await (await fetch(`https://www.googleapis.com/youtube/v3/${route}?${new URLSearchParams({ ...params, key: KEY })}`)).json()
  if (j.error) throw new Error(`${route}: ${j.error.message}`)
  return j
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const secs = (iso) => {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0
}

const videos = []
for (const ch of CHANNELS) {
  try {
    const ids = []
    let tok = ""
    do {
      const j = await api("playlistItems", { part: "contentDetails", maxResults: "50", playlistId: `UUSH${ch.id.slice(2)}`, ...(tok && { pageToken: tok }) })
      const items = j.items ?? []
      for (const it of items) if (Date.parse(it.contentDetails.videoPublishedAt) >= SINCE) ids.push(it.contentDetails.videoId)
      const oldest = Math.min(...items.map((it) => Date.parse(it.contentDetails.videoPublishedAt)))
      tok = items.length && oldest >= SINCE ? j.nextPageToken : ""
    } while (tok)
    const vs = []
    for (let i = 0; i < ids.length; i += 50) {
      const j = await api("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") })
      for (const v of j.items ?? [])
        vs.push({
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
        })
    }
    const med = median(vs.filter((v) => Date.parse(v.published) <= SETTLED).map((v) => v.views)) || 1
    for (const v of vs) {
      const settled = Date.parse(v.published) <= SETTLED
      v.channelMedian = med
      v.ratio = Math.round((v.views / med) * 100) / 100
      v.tier = !settled ? "unsettled" : v.ratio >= 3 ? "breakout" : v.ratio <= 0.5 ? "killed" : "baseline"
      videos.push(v)
    }
    console.log(`${ch.name}: ${vs.length}`)
  } catch (e) {
    console.error(`${ch.name}: ${e.message}`)
  }
}

fs.writeFileSync(path.join(DIR, "catalog.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), source: "YouTube Data API v3, shorts playlists, 18-month lookback", videos }) + "\n")
const count = (k) => videos.reduce((m, v) => ((m[v[k]] = (m[v[k]] ?? 0) + 1), m), {})
console.log(`TOTAL ${videos.length}`)
console.log("by tier", count("tier"))
console.log("by group", count("group"))
