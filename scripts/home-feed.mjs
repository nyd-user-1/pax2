// The home page feed: every channel's best-travelled shorts from the lookback catalog, newest
// first, plus each channel's YouTube avatar.
// Usage: node scripts/home-feed.mjs   (reads data/velocity/catalog.json and YOUTUBE_API_KEY from .env.local)
import fs from "node:fs"

const PER_CHANNEL = 6
const catalog = JSON.parse(fs.readFileSync("data/velocity/catalog.json", "utf8")).videos
const features = JSON.parse(fs.readFileSync("data/generated/features.json", "utf8"))

const byChannel = new Map()
for (const v of catalog) (byChannel.get(v.channelId) ?? byChannel.set(v.channelId, []).get(v.channelId)).push(v)
const ranked = [...byChannel.values()].map((vs) => vs.sort((a, b) => b.views - a.views).slice(0, PER_CHANNEL))
const videos = []
for (let r = 0; r < PER_CHANNEL; r++)
  for (const v of ranked.map((vs) => vs[r]).filter(Boolean).sort((a, b) => b.views - a.views))
    videos.push({
      id: v.id,
      title: v.title.replace(/\s*#\w+/g, "").trim() || v.title,
      channel: v.channel.trim(),
      channelId: v.channelId,
      views: v.views,
      likes: v.likes ?? null,
      comments: v.comments ?? null,
      ratio: v.ratio,
      tier: v.tier,
      published: v.published,
      duration: `PT${Math.floor(v.durationSec / 60)}M${v.durationSec % 60}S`,
      description: (v.description ?? "").split("\n")[0].replace(/\s*#\w+/g, "").trim(),
      playable: `yt-${v.id}` in features,
    })
videos.sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
fs.writeFileSync("data/generated/home-feed.json", JSON.stringify(videos))

const key = fs.readFileSync(".env.local", "utf8").match(/^YOUTUBE_API_KEY=(.*)$/m)[1].trim().replace(/^"|"$/g, "")
const ids = [...byChannel.keys()]
fs.mkdirSync("public/logos/channels", { recursive: true })
for (let i = 0; i < ids.length; i += 50) {
  const r = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ids.slice(i, i + 50).join(",")}&key=${key}`)).json()
  for (const c of r.items ?? []) {
    const t = c.snippet.thumbnails
    const buf = Buffer.from(await (await fetch((t.medium ?? t.default).url)).arrayBuffer())
    fs.writeFileSync(`public/logos/channels/${c.id}.jpg`, buf)
  }
}
console.log(`${videos.length} videos from ${ranked.length} channels; ${fs.readdirSync("public/logos/channels").length} avatars`)
