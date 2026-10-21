import homeFeed from "../../../data/generated/home-feed.json"
import { Chat } from "@/components/chat/chat"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Chat" }

export default async function ChatPage() {
  const { takes } = await board(await workspace())
  const videos = takes
    .map(({ take, latest }) => ({ id: take.id, label: `${scriptById(take.scriptId)?.short ?? take.scriptId} · ${takeLabel(take)}`, poster: take.video?.poster, score: latest?.score.value ?? null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  // The menu's Shorts: the catalog's real shorts, strongest against their own channel's median first.
  const shorts = (homeFeed as { id: string; title: string; channel: string; ratio: number | null; tier: string }[])
    .filter((v) => v.ratio != null && v.tier !== "unsettled")
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 24)
    .map((v) => ({ id: v.id, label: `${v.title} · ${v.channel}`, poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, score: v.ratio }))
  return <Chat scripts={SCRIPTS.map((s) => ({ id: s.id, title: s.title, short: s.short }))} videos={videos} shorts={shorts} />
}
