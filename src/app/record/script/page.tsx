import { Suspense } from "react"

import model from "../../../../data/generated/model/reference-model.json"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { Editor, type Research } from "@/components/record/editor"

export const metadata = { title: "Make it yours" }

export default function ScriptPage() {
  const vc = (model as unknown as { outcomes: { votechoice: { features: Research[] } } }).outcomes.votechoice.features
  const research = Object.fromEntries(vc.map((f) => [f.key, f]))
  return (
    <>
      <StepBar back={{ href: "/record/library", label: "Scripts" }} />
      <FlowPage title="Make it yours." lead="Change anything you'd like. It should sound like you." wide>
        <Suspense>
          <Editor research={research} />
        </Suspense>
      </FlowPage>
    </>
  )
}
