import { notFound } from "next/navigation"

import shorts from "../../../../../data/raw/yt-shorts.json"
import { ShortView } from "@/components/short-view"
import { TakePanel } from "@/components/take-panel"
import { TakeView } from "@/components/take-view"
import { scriptById, takeById } from "@/lib/catalog"
import { channelById } from "@/lib/channels"

export const dynamic = "force-dynamic"

// Intercepts /v/[id] when navigated to from inside the app: the take opens in a drawer.
export default async function TakeInDrawer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id.startsWith("yt-")) {
    const v = (shorts as unknown as { videos: { id: string; channelId: string; channel: string }[] }).videos.find((x) => x.id === id.replace(/^yt-/, ""))
    return (
      <TakePanel title={v ? (channelById(v.channelId)?.name ?? v.channel) : "Campaign short"}>
        <ShortView id={id} inDrawer />
      </TakePanel>
    )
  }
  const take = takeById(id)
  if (!take) notFound()
  return (
    <TakePanel title={scriptById(take.scriptId)!.short}>
      <TakeView id={id} inDrawer />
    </TakePanel>
  )
}
