"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"

import { refreshSnapshot } from "@/app/velocity-actions"
import { cn } from "@/ui/lib/utils"

/** Recomputes the stat card snapshot, then re-reads everything on the page. */
export function SnapshotRefresh() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  return (
    <button
      type="button"
      aria-label="Refresh"
      title="Refresh"
      disabled={pending}
      onClick={() => start(async () => {
        await refreshSnapshot()
        router.refresh()
      })}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <RefreshCwIcon className={cn("size-3.5", pending && "animate-spin")} />
    </button>
  )
}
