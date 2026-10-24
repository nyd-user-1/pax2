"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

import { createTest } from "@/app/message-test-actions"
import { MainBlock } from "@/components/blocks"
import type { MessageTest } from "@/lib/message-tests"
import { cn } from "@/ui/lib/utils"

const STATUS = { draft: "bg-slate-100 text-slate-600", live: "bg-above-soft text-above", closed: "bg-pax2-lavender text-pax2-blue" } as const

export function TestList({ tests }: { tests: (MessageTest & { complete: number })[] }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const add = async () => {
    setBusy(true)
    try {
      router.push(`/message-tests/${await createTest()}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <MainBlock
      title="Message tests"
      actions={
        <button type="button" onClick={add} disabled={busy} className="flex h-8 items-center gap-1.5 rounded-full bg-pax2-blue px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} New test
        </button>
      }
    >
      {tests.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {tests.map((t) => {
            const videos = t.arms.filter((a) => !a.placebo).length
            return (
              <li key={t.id}>
                <Link href={`/message-tests/${t.id}`} className="flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">
                      {t.measure} · {videos} {videos === 1 ? "video" : "videos"} and a placebo
                    </span>
                  </span>
                  <span className="tabular text-sm text-slate-600">
                    {t.complete} of {t.perArm * t.arms.length}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS[t.status])}>{t.status}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No tests yet.</p>
      )}
    </MainBlock>
  )
}
