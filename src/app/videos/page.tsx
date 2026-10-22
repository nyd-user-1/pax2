import { Feed } from "@/components/record/feed"
import { feedFacets, firstPage } from "@/lib/feed-data"

// The catalog feed — the landing's video section as its own page, open to everyone.

export const metadata = { title: "Videos" }

export default async function VideosPage() {
  const { initial, total, cursor } = await firstPage()
  return <Feed initial={initial} total={total} cursor={cursor} facets={await feedFacets()} />
}
