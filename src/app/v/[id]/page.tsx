import { notFound, redirect } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { OriginalView } from "@/components/original-view"
import { ShortView } from "@/components/short-view"
import { TakeView } from "@/components/take-view"
import { takeById } from "@/lib/catalog"
import { currentUser } from "@/lib/auth"
import { canSee, isOriginalId, originalRow } from "@/lib/originals"

export const dynamic = "force-dynamic"

// Opened directly (a shared link, a reload), a take gets the whole page; from inside the app it opens in the drawer.
export default async function TakePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; publish?: string }> }) {
  const { id } = await params
  const short = id.startsWith("yt-")
  const sp = await searchParams
  const found = isOriginalId(id) ? await originalRow(id) : null
  const user = found ? await currentUser() : null
  // From an email link, signed out: sign in first, then straight back here.
  const query = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()
  if (found && !user) redirect(`/signin?next=${encodeURIComponent(`/v/${id}${query ? `?${query}` : ""}`)}`)
  const row = found && canSee(found, user) ? found : null
  if (!short && !row && !takeById(id)) notFound()
  return (
    <div className="flex flex-col gap-6">
      {/* Back stays put while the page scrolls under it: pinned to the top of the scrolling area, on the
          page's own colour, reaching over the page padding so nothing shows above it. */}
      <div className="sticky top-0 z-20 -mx-5 -mt-6 bg-hermes-mist px-5 pt-6 pb-3 md:-mx-10 md:-mt-9 md:px-10 md:pt-9">
        <BackLink />
      </div>
      {row ? <OriginalView row={row} tab={sp.tab} publish={sp.publish === "1"} /> : short ? <ShortView id={id} /> : <TakeView id={id} />}
    </div>
  )
}
