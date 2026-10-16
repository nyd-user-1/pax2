"use client"

import * as React from "react"
import { Loader2, Upload } from "lucide-react"

import { loadDataset, uploadExport } from "@/app/actions"
import type { LoadResult } from "@/lib/review"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/nova/tooltip"
import { cn } from "@/ui/lib/utils"

const EXPECTS =
  "Meta Ads Manager export (CSV), one row per ad, Ad ID ad-<video id>. Columns: Reporting starts and ends, Amount spent, Impressions, Reach, 3-second video plays, ThruPlays, Video plays at 25/50/75/100%, Video average play time, Post shares, saves, comments, reactions, Link clicks."

/** Where paid results come in: drop the Ads Manager export, or press Load Data. Until the partner's
 *  export exists, the button loads the bundled stand-in round named by `standIn`. */
export function LoadData({ standIn, className }: { standIn?: string; className?: string }) {
  const [pending, start] = React.useTransition()
  const [over, setOver] = React.useState(false)
  const [r, setR] = React.useState<LoadResult | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const run = (f: () => Promise<LoadResult>) =>
    start(async () => {
      setErr(null)
      try {
        setR(await f())
      } catch (x) {
        setErr((x as Error).message)
      }
    })
  const upload = (file?: File) => {
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    run(() => uploadExport(fd))
  }
  return (
    <div
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        upload(e.dataTransfer.files?.[0])
      }}
      className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors", over ? "border-pax2-plum bg-pax2-lavender/40" : "border-slate-300 bg-white/60", className)}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-pax2-lavender text-pax2-plum">
        <Upload className="size-5" />
      </span>
      <p className="text-sm text-slate-600">Drop the Ads Manager export here</p>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <Tooltip>
        <TooltipTrigger
          disabled={pending}
          onClick={() => (standIn ? run(() => loadDataset(standIn)) : input.current?.click())}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-pax2-blue px-4 text-sm font-medium text-white shadow-e1 transition-colors hover:bg-pax2-plum disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Load Data
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-left leading-relaxed">
          {EXPECTS}
          {standIn ? ` Until it arrives, this loads the stand-in ${standIn.replace("-", " ")}.` : ""}
        </TooltipContent>
      </Tooltip>
      {r && (
        <p className="max-w-sm text-xs text-muted-foreground">
          {r.alreadyLoaded ? "Already loaded; nothing counted twice." : `${r.added} rows added, ${r.duplicates} already held.`}
          {r.unmatched.length > 0 && ` ${r.unmatched.length} rows matched no video.`}
          {r.missingColumns.length > 0 && ` Missing columns: ${r.missingColumns.join(", ")}.`}
        </p>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
