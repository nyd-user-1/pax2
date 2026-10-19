import "@xyflow/react/dist/style.css"

import { FlowCanvas } from "@/components/flow/flow-canvas"
import { currentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata = { title: "Flows" }

export default async function FlowCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/flow")
  const { id } = await params
  return <FlowCanvas key={id} id={id} />
}
