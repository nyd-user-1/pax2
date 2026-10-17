import { FlowPage, HelpLine, StepBar } from "@/components/record/chrome"
import { LibraryCard } from "@/components/record/library-card"
import { libraryCards } from "@/lib/library-cards"

export const dynamic = "force-dynamic"
export const metadata = { title: "Choose a script" }

export default async function LibraryPage() {
  const cards = await libraryCards()
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
