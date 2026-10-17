import codes from "../../../../data/generated/model/script-codes.json"
import { FlowPage, HelpLine, StepBar } from "@/components/record/chrome"
import { LibraryCard, type CardData } from "@/components/record/library-card"
import { SCRIPTS } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Choose a script" }

type Codes = { scripts: Record<string, { prior: Record<string, { expected: number; average: number }> }> }

export default async function LibraryPage() {
  const { takes } = await board(await workspace())
  const C = codes as unknown as Codes
  const cards: CardData[] = SCRIPTS.map((s) => {
    const scored = takes.filter((t) => t.take.scriptId === s.id && t.latest?.score.value != null)
    const best = scored.length ? Math.max(...scored.map((t) => t.latest!.score.value!)) : null
    const prior = C.scripts[s.id]?.prior.votechoice
    const notes: CardData["notes"] = []
    if (best != null) notes.push({ label: `Recorded ${scored.length} times so far · best Resonance ${best.toFixed(0)}`, tone: best >= 60 ? "good" : best < 40 ? "caution" : "neutral" })
    else notes.push({ label: "Not yet recorded with paid results", tone: "neutral" })
    if (prior) notes.push({ label: `Ads in this style moved vote choice about ${prior.expected.toFixed(1)} pts in tested campaigns (average ${prior.average.toFixed(1)})`, tone: "neutral" })
    return { id: s.id, title: s.title, framing: s.framing, text: s.text, seconds: Math.round((s.words / 130) * 60), place: "Massachusetts", notes }
  })
  return (
    <>
      <StepBar step={1} back={{ href: "/recording", label: "Start" }} />
      <FlowPage title="Choose a script" lead="Ready to use as they are, and yours to change once you pick one." wide>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <LibraryCard key={c.id} s={c} />
          ))}
        </div>
        <HelpLine />
      </FlowPage>
    </>
  )
}
