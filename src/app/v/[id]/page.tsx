import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { ShortView } from "@/components/short-view"
import { TakeView } from "@/components/take-view"
import { takeById } from "@/lib/catalog"

export const dynamic = "force-dynamic"

// Opened directly (a shared link, a reload), a take gets the whole page; from inside the app it opens in the drawer.
export default async function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const short = id.startsWith("yt-")
  if (!short && !takeById(id)) notFound()
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      {short ? <ShortView id={id} /> : <TakeView id={id} />}
    </div>
  )
}
