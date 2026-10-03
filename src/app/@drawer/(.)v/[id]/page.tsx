import { notFound } from "next/navigation"

import { TakeDrawer } from "@/components/take-drawer"
import { TakeView } from "@/components/take-view"
import { scriptById, takeById } from "@/lib/catalog"

export const dynamic = "force-dynamic"

// Intercepts /v/[id] when navigated to from inside the app: the take opens in a drawer.
export default async function TakeInDrawer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const take = takeById(id)
  if (!take) notFound()
  return (
    <TakeDrawer title={scriptById(take.scriptId)!.short}>
      <TakeView id={id} inDrawer />
    </TakeDrawer>
  )
}
