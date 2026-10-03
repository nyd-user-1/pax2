"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import { pickScript } from "@/app/actions"
import { Button } from "@/ui/components/nova/button"
import { Textarea } from "@/ui/components/nova/textarea"

/** Choose a script for the next round, with the reason kept beside the choice. Confirms in place. */
export function PickScript({ scriptId }: { scriptId: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, start] = React.useTransition()
  if (done)
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-above">
        <Check className="size-4" /> Chosen. It is listed under Choices made.
      </p>
    )
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-pax-ink shadow-e1 transition-shadow hover:shadow-e2">
        Choose for the next round
      </button>
    )
  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this script, now?" className="min-h-16 bg-white text-sm" />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !reason.trim()}
          onClick={() =>
            start(async () => {
              await pickScript(scriptId, reason)
              setDone(true)
              router.refresh()
            })
          }
        >
          Save the choice
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
