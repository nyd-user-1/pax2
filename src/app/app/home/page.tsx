// The home the refinement builds toward, shaped on the ElevenLabs home (elevenlabs.io/app/home):
// /chat's working input under the headline, the create tiles where its Explore row was, the promo
// carousel at the foot of the first viewport, and past the fold the Recents / Quickstarts shelf —
// the scored takes, and the Studio's effects staged one click deep. The chat itself is unchanged —
// send a message and the page becomes the conversation, as /chat does.

import { Chat } from "@/components/chat/chat"
import { CreateTiles } from "@/components/home/create-tiles"
import { Promos } from "@/components/home/promos"
import { Shelf } from "@/components/home/shelf"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Home" }

export default async function HomePage() {
  const { takes } = await board(await workspace())
  const sorted = takes.slice().sort((a, b) => (b.latest?.score.value ?? -1) - (a.latest?.score.value ?? -1))
  const videos = sorted.map(({ take, latest }) => ({
    id: take.id,
    label: `${scriptById(take.scriptId)?.short ?? take.scriptId} · ${takeLabel(take)}`,
    poster: take.video?.poster,
    voice: take.voice,
    score: latest?.score.value ?? null,
  }))
  // The quickstarts are the Studio's effects; the scripts here resolve each effect's script.
  const quickstarts = SCRIPTS.map((s) => ({ id: s.id, title: s.title, text: s.text }))
  return (
    <Chat
      scripts={SCRIPTS.map((s) => ({ id: s.id, title: s.title, short: s.short }))}
      videos={videos}
      explore={false}
      heading={<h2 className="font-display text-center text-3xl text-slate-900 md:text-4xl">What would you like to create?</h2>}
      below={
        <div className="flex w-full max-w-[1094px] flex-col gap-10">
          <CreateTiles />
          <Promos />
        </div>
      }
      shelf={<Shelf takes={videos} scripts={quickstarts} />}
    />
  )
}
