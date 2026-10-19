import { MyVideos } from "@/components/my-videos"

export const dynamic = "force-dynamic"
export const metadata = { title: "My videos" }

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  return <MyVideos filter={q} />
}
