import { ScoreInfo } from "@/components/ui-pax"
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
      <header className="rise flex flex-col gap-2">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Videos</h1>
        <p className="flex items-center gap-1.5 text-slate-500">
          {cards.length} takes of {SCRIPTS.length} scripts. Open one to watch it, see its score and get PAX&apos;s read. <ScoreInfo />
        </p>
      </header>
      <VideoGrid videos={cards} scripts={SCRIPTS.map((s) => ({ id: s.id, short: s.short }))} />
    </div>
  )
}
