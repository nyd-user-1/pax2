"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DEMO_ACCOUNTS } from "@/lib/demo"

// The quiet corner of the sign-in and sign-up screens: a line that reads like boilerplate and
// opens the three demo logins. "Use" lands on /signin with the fields filled.

export function DemoAccess() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="fixed bottom-4 right-5 z-40">
      {open && (
        <div className="absolute bottom-8 right-0 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-e3">
          <p className="text-sm font-semibold text-slate-900">Demo access</p>
          <p className="mt-0.5 text-xs text-slate-500">Three sandboxed accounts. They see demo content only and can't publish or move a lever.</p>
          <div className="mt-3 flex flex-col divide-y divide-slate-100">
            {DEMO_ACCOUNTS.map((a) => (
              <div key={a.email} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.role}</p>
                  <p className="truncate text-xs text-slate-500">{a.line}</p>
                  <p className="tabular mt-1 truncate font-mono text-[11px] text-slate-600">
                    {a.email} · {a.password}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push(`/signin?demo=${encodeURIComponent(a.role.toLowerCase())}`)
                  }}
                  className="shrink-0 rounded-full bg-pax2-blue px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-xs text-slate-400 transition-colors hover:text-slate-600 hover:underline">
        Terms and conditions
      </button>
    </div>
  )
}
