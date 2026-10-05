import { VideoGrid } from "@/components/video-grid"
import { SCRIPTS } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"
import { cardOf } from "@/lib/view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Videos" }

export default async function VideosPage() {
  const { takes } = await board(await workspace())
  const cards = takes.map(cardOf)
  return (
    <div className="flex flex-col gap-8">
      <VideoGrid videos={cards} scripts={SCRIPTS.filter((s) => cards.some((c) => c.script === s.id)).map((s) => ({ id: s.id, short: s.short }))} />
    </div>
  )
}
