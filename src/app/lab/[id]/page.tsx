import { notFound, redirect } from "next/navigation"

import { ScanScreen } from "@/components/lab/scan-screen"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { currentUser } from "@/lib/auth"
import { feedIndex } from "@/lib/feed-data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Lab" }

// The Button door: the flask on a video card opens this, and the video goes through the Lab's
// stages in the record flow's dress (src/components/lab/scan-screen.tsx runs the checks).
export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await currentUser())) redirect(`/signin?next=${encodeURIComponent(`/lab/${id}`)}`)
  if (!/^[\w-]{11}$/.test(id)) notFound()
  const v = (await feedIndex()).find((x) => x.id === id)
  if (!v) notFound()
  return (
    <>
      <StepBar back={{ href: "/", label: "Feed" }} />
      <FlowPage title={v.title} wide>
        <ScanScreen id={id} title={v.title} />
      </FlowPage>
    </>
  )
}
