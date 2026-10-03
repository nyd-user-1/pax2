"use client"

import * as React from "react"
import { Loader2, Upload } from "lucide-react"

import { uploadExport } from "@/app/actions"
import type { LoadResult } from "@/lib/review"
import { Button } from "@/ui/components/nova/button"

/** The partner's own Meta Ads Manager export. Rows match takes by Ad ID (ad-<take>). */
export function UploadExport() {
  const [pending, start] = React.useTransition()
  const [r, setR] = React.useState<LoadResult | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const fd = new FormData()
          fd.set("file", file)
          start(async () => {
            setErr(null)
            try {
              setR(await uploadExport(fd))
            } catch (x) {
              setErr((x as Error).message)
            }
          })
        }}
      />
      <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Upload an Ads Manager export
      </Button>
      {r && (
        <p className="max-w-sm text-xs text-muted-foreground">
          {r.alreadyLoaded ? "Already loaded; nothing counted twice." : `${r.added} rows added, ${r.duplicates} already held.`}
          {r.unmatched.length > 0 && ` ${r.unmatched.length} rows matched no take.`}
          {r.missingColumns.length > 0 && ` Missing columns: ${r.missingColumns.join(", ")}.`}
        </p>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
