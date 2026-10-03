"use client"

import * as React from "react"

import { pickScript } from "@/app/actions"
import { Button } from "@/ui/components/nova/button"
import { Textarea } from "@/ui/components/nova/textarea"

export function PickScript({ scriptId }: { scriptId: string }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, start] = React.useTransition()
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Note why this one is next
      </button>
    )
  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this script, now? The reason is kept with the choice." className="min-h-14 text-sm" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !reason.trim()} onClick={() => start(async () => { await pickScript(scriptId, reason); setOpen(false); setReason("") })}>
          Save the choice
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
