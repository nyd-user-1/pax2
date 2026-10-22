import type { FeedVideo } from "@/components/record/feed"
import { TagsExplorer } from "@/components/tags-explorer"
import { labVideos } from "@/lib/lab"
import { taggedVideos } from "@/lib/tags"
import { homeFeedFile, ytShortsFile } from "@/lib/data-files"

const homeFeed = homeFeedFile()
const shorts = ytShortsFile()

export const metadata = { title: "Tags" }

type Raw = { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; description?: string }

export default function TagsPage() {
  const feed = new Map((homeFeed as FeedVideo[]).map((v) => [v.id, v]))
  const raw = new Map((shorts as unknown as { videos: Raw[] }).videos.map((v) => [v.id, v]))
  const lab = new Map(labVideos().map((v) => [v.id, v]))
  // A tagged video in the card's shape: the feed's own record, else built from the original catalog.
  const card = (ytId: string): FeedVideo | null => {
    const f = feed.get(ytId)
    if (f) return f
    const r = raw.get(ytId)
    const l = lab.get(ytId)
    if (!r || !l) return null
    return {
      id: ytId,
      title: r.title.replace(/\s*#\w+/g, "").trim() || r.title,
      channel: r.channel,
      channelId: r.channelId,
      views: r.views ?? 0,
      ratio: l.ratio,
      tier: l.tier,
      published: r.published,
      duration: r.duration,
      description: (r.description ?? "").split("\n")[0].replace(/\s*#\w+/g, "").trim(),
      playable: true,
    }
  }

  const byTag = new Map<string, FeedVideo[]>()
  for (const t of taggedVideos()) {
    const v = card(t.id.replace(/^yt-/, ""))
    if (v) for (const tag of t.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), v])
  }
  // A tag earns its section with two videos; single-video categories surface later, once a second
  // lands. Aggrieved is off the page by ruling.
  const sections = [...byTag]
    .filter(([tag, vs]) => tag !== "aggrieved" && vs.length >= 2)
    .map(([tag, vs]) => ({ tag, videos: vs.sort((a, b) => Date.parse(b.published) - Date.parse(a.published)) }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
  return <TagsExplorer sections={sections} />
}
