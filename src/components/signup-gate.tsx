"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { X } from "lucide-react"

/** The sign-in wall's invitation, the traditional way: a modal over the whole page with frosted glass
 *  behind it. Closing it leaves the page as it stands, the locked panels still blurred. */
export function SignupGate() {
  const [open, setOpen] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])
  if (!mounted || !open) return null
  const next = `?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 p-4 backdrop-blur-[3px]" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="signup-gate-title" onClick={(e) => e.stopPropagation()} className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-e3 ring-1 ring-slate-200">
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="size-4" />
        </button>
        <p id="signup-gate-title" className="font-display text-lg leading-snug text-slate-900">Complete Analysis</p>
        <p className="text-sm leading-relaxed text-slate-600">Sign up to see the complete analysis of this video and hundreds more.</p>
        <div className="flex items-center gap-2">
          <Link href={`/signup${next}`} className="press rounded-full bg-pax2-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e1 transition-shadow hover:shadow-e2">
            Sign up
          </Link>
          <Link href={`/signin${next}`} className="press rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-pax2-ink shadow-e1 ring-1 ring-slate-200 transition-shadow hover:shadow-e2">
            Log in
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
