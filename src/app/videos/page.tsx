import homeFeed from "../../../data/generated/home-feed.json"
import { Feed, type FeedVideo } from "@/components/record/feed"
import { tagsFor } from "@/lib/tags"

// The catalog feed — the landing's video section as its own page, open to everyone.

export const metadata = { title: "Videos" }

export default function VideosPage() {
  const feed = (homeFeed as FeedVideo[]).map((v) => ({ ...v, tags: tagsFor(`yt-${v.id}`) }))
  return <Feed videos={feed} />
}
