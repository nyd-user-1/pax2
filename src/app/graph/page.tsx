import "@xyflow/react/dist/style.css"

import { Toaster } from "sonner"

import { VideoGraph } from "@/components/video-graph"
import { currentUser } from "@/lib/auth"
import type { GraphData } from "@/lib/graph-data"
import { patternsData } from "@/lib/velocity-analytics"

export const metadata = { title: "Graph" }
export const dynamic = "force-dynamic"

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ view?: string; center?: string }> }) {
  const [d, user, params] = await Promise.all([patternsData(), currentUser(), searchParams])
  const data: GraphData = {
    channels: d.channels.map(({ id, name, group, subs, median, n, pushed, killed }) => ({ id, name, group, subs, median, n, pushed, killed })),
    videos: d.videos.map(({ id, title, channelId, channel, published, ratio, tier, views, likes, comments, durationSec, tags, topics }) => ({ id, title, channelId, channel, published, ratio, tier, views, likes, comments, durationSec, tags, topics })),
    start: d.start,
    readings: d.readings,
  }
  return (
    <>
      <VideoGraph data={data} email={user?.email ?? null} admin={!!user?.admin} boot={{ view: params.view, center: params.center }} />
      <Toaster position="bottom-center" richColors closeButton />
    </>
  )
}
