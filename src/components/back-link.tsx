"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

/** Back means back: to whichever page the reader came from, or the home feed when they arrived on a direct link. */
export function BackLink() {
  const router = useRouter()
  const back = () => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) return router.back()
    // Home, but at the feed, where the search bar has stuck.
    sessionStorage.setItem("pax2:feed-return", JSON.stringify({ y: 0, cycles: 1 }))
    router.push("/")
  }
  return (
    <button type="button" onClick={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-pax2-ink">
      <ArrowLeft className="size-4" /> Back
    </button>
  )
}
