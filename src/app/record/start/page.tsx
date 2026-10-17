import { FlowPage, HelpLine } from "@/components/record/chrome"
import { RecordOptions } from "@/components/record/record-options"

export const metadata = { title: "How would you like to start?" }

export default function StartPage() {
  return (
    <FlowPage className="min-h-[calc(100dvh-11.5rem)] justify-center py-0">
      <RecordOptions />
      <HelpLine />
    </FlowPage>
  )
}
