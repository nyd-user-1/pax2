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
  return <Chat scripts={SCRIPTS.map((s) => ({ id: s.id, title: s.title, short: s.short }))} videos={videos} />
}
