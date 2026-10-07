"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Loader2, Play } from "lucide-react"

import { runPipeline, type PipelineQueue } from "@/app/pipeline-actions"
import { setPoller, type PollerStatus } from "@/app/velocity-actions"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/components/nova/dialog"
import { cn } from "@/ui/lib/utils"

// The dashboard's admin controls, placed in the shell header's page-actions slot: the poller's
// on/off switch and the pipeline run. Anyone can see them; only admins can use them.

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never")

export function AdminControls({ admin, poller: initial, queue }: { admin: boolean; poller: PollerStatus | null; queue: PipelineQueue | null }) {
  const [slot, setSlot] = React.useState<HTMLElement | null>(null)
  const [poller, setPollerState] = React.useState(initial)
  const [open, setOpen] = React.useState(false)
  const [busy, start] = React.useTransition()
  const [note, setNote] = React.useState<string | null>(null)
  React.useEffect(() => setSlot(document.getElementById("page-actions")), [])
  if (!slot) return null

  const locked = admin ? undefined : "Admins only"
  const toggle = () => start(async () => setPollerState(await setPoller(!poller?.enabled)))
  const run = () =>
    start(async () => {
      try {
        const r = await runPipeline()
        setNote(`Running ${r.started} video${r.started === 1 ? "" : "s"} on the worker box.`)
      } catch (e) {
        setNote((e as Error).message)
      }
    })

  return createPortal(
    <>
      <button
        type="button"
        role="switch"
        aria-checked={!!poller?.enabled}
        disabled={!admin || !poller || busy}
        onClick={toggle}
        title={locked ?? `Poller ${poller?.enabled ? "on" : "off"} · last run ${clock(poller?.lastRunAt ?? null)}${poller?.lastWatched != null ? ` · ${poller.lastWatched} watched` : ""}`}
        className="flex h-10 items-center gap-2.5 rounded-full bg-white pl-4 pr-1.5 text-sm text-slate-600 shadow-e1 transition-shadow hover:shadow-e2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Poller
        <span className={cn("relative h-6 w-10 rounded-full transition-colors", poller?.enabled ? "bg-green-500" : "bg-slate-300")}>
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", poller?.enabled ? "left-[18px]" : "left-0.5")} />
        </span>
      </button>
      <button
        type="button"
        aria-label="Run the pipeline"
        title={locked ?? "Run the pipeline"}
        disabled={!admin}
        onClick={() => (setNote(null), setOpen(true))}
        className="flex size-10 items-center justify-center rounded-full bg-white text-pax-ink shadow-e1 transition-shadow hover:shadow-e2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="size-4 fill-current" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(520px,calc(100vw-2rem))] rounded-2xl border-0 bg-slate-100 p-2 shadow-lg sm:max-w-none">
          <div className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
            <DialogHeader className="flex h-14 shrink-0 flex-row items-center gap-3 border-b px-5 pr-12">
              <DialogTitle className="text-base font-medium">Run the pipeline</DialogTitle>
              {queue && <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">Worker box {queue.box}</span>}
              <DialogDescription className="sr-only">Analyze every queued video on the worker box.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border">
                <div className="border-r p-4">
                  <p className="text-xs text-muted-foreground">Queued</p>
                  <p className="text-lg font-semibold">{queue?.queued.length ?? "-"}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Estimated cost</p>
                  <p className="text-lg font-semibold">{queue ? `$${queue.cost.toFixed(2)}` : "-"}</p>
                </div>
              </div>
              {note && <p className="text-sm text-slate-700">{note}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-4 text-sm text-slate-600 hover:bg-muted">
                  Close
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={busy || !queue?.queued.length}
                  title={queue?.queued.length ? undefined : "Nothing is queued"}
                  className="flex h-9 items-center gap-2 rounded-full bg-pax-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5 fill-current" />} Run
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>,
    slot,
  )
}
