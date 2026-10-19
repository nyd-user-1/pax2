import "@xyflow/react/dist/style.css"

import { FlowCanvas } from "@/components/flow/flow-canvas"

export const metadata = { title: "Flows" }

export default async function FlowCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FlowCanvas key={id} id={id} />
}
