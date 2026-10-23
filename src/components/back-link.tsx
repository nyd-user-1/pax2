"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

/** Back means back: to whichever page the reader came from inside the app; arriving on a direct link or
 *  from the front door (the landing, sign-in, sign-up), to `fallback` — /videos for a video. */
export function BackLink({ fallback = "/videos" }: { fallback?: string }) {
  const router = useRouter()
  const back = () => {
    const from = document.referrer.startsWith(location.origin) ? new URL(document.referrer).pathname : null
    const door = from === "/" || from === "/signin" || from === "/signup"
    if (from && !door && history.length > 1) return router.back()
    router.push(fallback)
  }
  return (
    <button type="button" onClick={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-pax2-blue">
      <ArrowLeft className="size-4" /> Back
    </button>
  )
}
