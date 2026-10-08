// The home page feed: every channel's best-travelled shorts from the lookback catalog, plus every
// short that has had the full analysis, plus every short on /campaigns (data/raw/yt-shorts.json),
// newest first, plus each channel's YouTube avatar and public subscriber count. The reform-core
// channels' videos carry the tag "reform" (not shown yet).
// Usage: node scripts/home-feed.mjs   (reads data/velocity/catalog.json and YOUTUBE_API_KEY from .env.local)
import fs from "node:fs"

const PER_CHANNEL = 6
const catalog = JSON.parse(fs.readFileSync("data/velocity/catalog.json", "utf8")).videos
const features = JSON.parse(fs.readFileSync("data/generated/features.json", "utf8"))
const campaignShorts = JSON.parse(fs.readFileSync("data/raw/yt-shorts.json", "utf8")).videos
const groups = Object.fromEntries(JSON.parse(fs.readFileSync("lambda/velocity/channels.json", "utf8")).map((c) => [c.id, c.group]))
const secs = (iso) => {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0) : 0
}

const byChannel = new Map()
for (const v of catalog) (byChannel.get(v.channelId) ?? byChannel.set(v.channelId, []).get(v.channelId)).push(v)
const ranked = [...byChannel.values()].map((vs) => vs.sort((a, b) => b.views - a.views).slice(0, PER_CHANNEL))
const picked = new Map()
for (const vs of ranked) for (const v of vs) picked.set(v.id, v)
for (const v of catalog) if (`yt-${v.id}` in features) picked.set(v.id, v)
// Every /campaigns short, from the catalog when it is there, else from the campaign pull, measured
// against its channel's catalog median.
const inCatalog = new Map(catalog.map((v) => [v.id, v]))
const channelMedian = new Map(catalog.map((v) => [v.channelId, v.channelMedian]))
for (const c of campaignShorts) {
  if (c.views == null || picked.has(c.id)) continue
  const v = inCatalog.get(c.id)
  if (v) {
    picked.set(c.id, v)
    continue
  }
  const median = channelMedian.get(c.channelId) ?? null
  const ratio = median ? c.views / median : null
  picked.set(c.id, { ...c, durationSec: secs(c.duration), channelMedian: median, ratio, tier: ratio == null ? "unsettled" : ratio >= 3 ? "breakout" : ratio <= 0.5 ? "killed" : "baseline" })
}
const videos = []
for (const v of picked.values())
  videos.push({
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
    description: (v.description ?? "").split("\n")[0].replace(/\s*#\w+/g, "").trim(),
    playable: `yt-${v.id}` in features,
    ...(groups[v.channelId] === "reform-core" && { tags: ["reform"] }),
  })
videos.sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
fs.writeFileSync("data/generated/home-feed.json", JSON.stringify(videos))

const key = fs.readFileSync(".env.local", "utf8").match(/^YOUTUBE_API_KEY=(.*)$/m)[1].trim().replace(/^"|"$/g, "")
const ids = [...byChannel.keys()]
fs.mkdirSync("public/logos/channels", { recursive: true })
const subscribers = {}
for (let i = 0; i < ids.length; i += 50) {
  const r = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.slice(i, i + 50).join(",")}&key=${key}`)).json()
  for (const c of r.items ?? []) {
    // A channel can hide its count; YouTube rounds the rest to three significant figures.
    subscribers[c.id] = c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? NaN) || null
    const t = c.snippet.thumbnails
    const buf = Buffer.from(await (await fetch((t.medium ?? t.default).url)).arrayBuffer())
    fs.writeFileSync(`public/logos/channels/${c.id}.jpg`, buf)
  }
}
fs.writeFileSync("data/generated/channel-subscribers.json", JSON.stringify(subscribers))
console.log(`${videos.length} videos from ${ranked.length} channels; ${fs.readdirSync("public/logos/channels").length} avatars`)
