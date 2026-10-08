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
      {/* Back stays put while the page scrolls under it: pinned to the top of the scrolling area, on the
          page's own colour, reaching over the page padding so nothing shows above it. */}
      <div className="sticky top-0 z-20 -mx-5 -mt-6 bg-pax-mist px-5 pt-6 pb-3 md:-mx-10 md:-mt-9 md:px-10 md:pt-9">
        <BackLink />
      </div>
      {short ? <ShortView id={id} /> : <TakeView id={id} />}
    </div>
  )
}
