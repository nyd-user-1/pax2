import { Chat } from "@/components/chat/chat"
import { openChat } from "@/app/chat-actions"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"
import { homeFeedFile } from "@/lib/data-files"

const homeFeed = homeFeedFile()

export const dynamic = "force-dynamic"
export const metadata = { title: "Chat" }

// ?c=<id> reopens a saved chat; without it the page is a new chat with a fresh id, so following the
// sidebar's Chat from a saved one starts clean.
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const saved = c ? await openChat(c) : null
  const chatId = saved ? saved.meta.id : crypto.randomUUID()
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
  return <Chat key={chatId} chatId={chatId} initialMessages={saved?.messages} scripts={SCRIPTS.map((s) => ({ id: s.id, title: s.title, short: s.short }))} videos={videos} shorts={shorts} />
}
