import { FlowPage, StepBar } from "@/components/record/chrome"

export const metadata = { title: "Volunteer guide" }

const SECTIONS = [
  { t: "Before you start", items: ["Pick a quiet room. A closed door helps more than a good microphone.", "Face a window or a lamp so the light is on your face, not behind you.", "Phone upright, at eye level, about an arm's length away. Lean it on books if you can."] },
  { t: "While you record", items: ["Look at the lens, not at yourself on screen. The words scroll just under it.", "Go at your own pace. The plus and minus buttons speed the words up or slow them down.", "Stumbled? Keep going, or tap to finish and try again. The team edits the rest."] },
  { t: "What happens next", items: ["The team reviews your video and may trim it, add captions, and run it as a paid ad.", "You're described only by what you write about yourself: name, who you are, town.", "If it runs, the partner sees how it did and what to try next, so the next video is better informed."] },
]

export default function GuidePage() {
  return (
    <>
      <StepBar step={1} back={{ href: "/record/start", label: "Start" }} />
      <FlowPage title="The volunteer guide" lead="Five minutes, a phone, and your own words. Here's everything that helps.">
        <div className="flex flex-col gap-4">
          {SECTIONS.map((s) => (
            <section key={s.t} className="surface p-6">
              <h2 className="mb-3 text-lg font-semibold text-hermes-ink">{s.t}</h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </FlowPage>
    </>
  )
}
