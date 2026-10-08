import { notFound } from "next/navigation"

import homeFeed from "../../../../../data/generated/home-feed.json"
import shorts from "../../../../../data/raw/yt-shorts.json"
import { OriginalView } from "@/components/original-view"
import { ShortView } from "@/components/short-view"
import { TakePanel } from "@/components/take-panel"
import { TakeView } from "@/components/take-view"
import { scriptById, takeById } from "@/lib/catalog"
import { channelById } from "@/lib/channels"
import { currentUser } from "@/lib/auth"
import { canSee, isOriginalId, originalRow } from "@/lib/originals"

export const dynamic = "force-dynamic"

// Intercepts /v/[id] when navigated to from inside the app: the take opens in a drawer.
export default async function TakeInDrawer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; publish?: string }> }) {
  const { id } = await params
  if (isOriginalId(id)) {
    const row = await originalRow(id)
    if (!row || !canSee(row, await currentUser())) notFound()
    const sp = await searchParams
    return (
      <TakePanel title={row.title ?? "Original video"}>
        <OriginalView row={row} tab={sp.tab} publish={sp.publish === "1"} />
      </TakePanel>
    )
  }
  if (id.startsWith("yt-")) {
    const v = (shorts as unknown as { videos: { id: string; channelId: string; channel: string }[] }).videos.find((x) => x.id === id.replace(/^yt-/, "")) ?? homeFeed.find((x) => x.id === id.replace(/^yt-/, ""))
    return (
      <TakePanel title={v ? (channelById(v.channelId)?.name ?? v.channel) : "Campaign short"} search={v?.channel}>
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
