// The feed index: every catalog short — not a per-channel cut — in the home feed's field shape,
// for the /api/feed route to page and search server-side. The root page ships only its first page;
// this file never reaches the browser. Same field mapping as scripts/home-feed.mjs.
//
// Usage: node scripts/feed-index.mjs   (reads data/velocity/catalog.json)
import fs from "node:fs"

const catalog = JSON.parse(fs.readFileSync("data/velocity/catalog.json", "utf8")).videos
const features = JSON.parse(fs.readFileSync("data/generated/features.json", "utf8"))
const campaignShorts = JSON.parse(fs.readFileSync("data/raw/yt-shorts.json", "utf8")).videos
const paidIds = new Set(JSON.parse(fs.readFileSync("data/generated/voter-freedom-paid.json", "utf8")).creatives.map((c) => c.videoId))
const paidUploads = JSON.parse(fs.readFileSync("data/raw/voter-freedom.json", "utf8")).videos.filter((v) => paidIds.has(v.id))
const groups = Object.fromEntries(JSON.parse(fs.readFileSync("lambda/velocity/channels.json", "utf8")).map((c) => [c.id, c.group]))
const secs = (iso) => {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0) : 0
}

const picked = new Map()
for (const v of catalog) picked.set(v.id, v)
const channelMedian = new Map(catalog.map((v) => [v.channelId, v.channelMedian]))
for (const c of [...campaignShorts, ...paidUploads]) {
  if (c.views == null || picked.has(c.id)) continue
  const median = channelMedian.get(c.channelId) ?? null
  const ratio = median ? c.views / median : null
  picked.set(c.id, { ...c, durationSec: secs(c.duration), channelMedian: median, ratio, tier: ratio == null ? "unsettled" : ratio >= 3 ? "breakout" : ratio <= 0.5 ? "killed" : "baseline" })
}
const videos = [...picked.values()].map((v) => ({
  id: v.id,
  title: v.title.replace(/\s*#\w+/g, "").trim() || v.title,
  channel: v.channel.trim(),
  channelId: v.channelId,
  views: v.views,
  likes: v.likes ?? null,
  comments: v.comments ?? null,
  ratio: v.ratio,
  channelMedian: v.channelMedian,
  tier: v.tier,
  published: v.published,
  duration: `PT${Math.floor(v.durationSec / 60)}M${v.durationSec % 60}S`,
  description: (v.description ?? "").split("\n")[0].replace(/\s*#\w+/g, "").trim().slice(0, 200),
  playable: `yt-${v.id}` in features,
  ...(paidIds.has(v.id) && { paid: true }),
  ...(groups[v.channelId] === "reform-core" && { tags: ["reform"] }),
}))
videos.sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
fs.writeFileSync("data/generated/feed-index.json", JSON.stringify(videos))
console.log(`feed-index.json: ${videos.length} videos, ${(fs.statSync("data/generated/feed-index.json").size / 1e6).toFixed(1)} MB`)
