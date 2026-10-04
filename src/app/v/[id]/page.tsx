import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

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
      <Link href={short ? "/campaigns" : "/videos"} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-pax-ink">
        <ArrowLeft className="size-4" /> {short ? "Campaigns" : "Videos"}
      </Link>
      {short ? <ShortView id={id} /> : <TakeView id={id} />}
    </div>
  )
}
