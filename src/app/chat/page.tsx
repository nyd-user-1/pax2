import { Chat } from "@/components/chat/chat"
import { openChat } from "@/app/chat-actions"
import type { VideoChip } from "@/components/chat/plus-menu"
import type { FeedVideo } from "@/components/record/feed"
import { SCRIPTS } from "@/lib/catalog"
import { feedIndex } from "@/lib/feed-data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Chat" }

const VF = "Voter Freedom"
const CHANNELS = new Set(["Unite America", VF])

const settled = (v: FeedVideo) => v.ratio != null && v.tier !== "unsettled"
const chip = (v: FeedVideo): VideoChip => ({ id: v.id, label: `${v.title} · ${v.channel}`, poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, score: v.ratio, youtube: true })

// ?c=<id> reopens a saved chat; without it the page is a new chat with a fresh id, so following the
// sidebar's Chat from a saved one starts clean. ?record=1 opens in record mode.
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string; record?: string }> }) {
  const { c, record } = await searchParams
  const saved = c ? await openChat(c) : null
  const chatId = saved ? saved.meta.id : crypto.randomUUID()
  // Unite America's and Voter Freedom's shorts, highest Outlier Score first.
  const ours = (await feedIndex()).filter((v) => CHANNELS.has(v.channel)).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
  // The menu's Videos: the four e2 videos, then seven of Voter Freedom's lab-measured shorts.
  const videos = [...ours.filter((v) => v.e2), ...ours.filter((v) => !v.e2 && v.lab && v.channel === VF && settled(v)).slice(0, 7)].map(chip)
  // The menu's Shorts: every one of their shorts with a settled number.
  const shorts = ours.filter(settled).map(chip)
  return <Chat key={chatId} chatId={chatId} initialMessages={saved?.messages} record={record === "1"} scripts={SCRIPTS.map((s) => ({ id: s.id, title: s.title, short: s.short }))} videos={videos} shorts={shorts} />
}
