import "@xyflow/react/dist/style.css"

import { VideoGraph, type GraphData } from "@/components/video-graph"
import { patternsData } from "@/lib/velocity-analytics"

export const metadata = { title: "Graph" }
export const dynamic = "force-dynamic"

export default async function GraphPage() {
  const d = await patternsData()
  const data: GraphData = {
    channels: d.channels.map(({ id, name, group, subs, n, pushed }) => ({ id, name, group, subs, n, pushed })),
    videos: d.videos.map(({ id, title, channelId, channel, ratio, tier, views, tags, topics }) => ({ id, title, channelId, channel, ratio, tier, views, tags, topics })),
  }
  return <VideoGraph data={data} />
}
