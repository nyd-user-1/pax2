"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { loadDataset } from "@/app/actions"
import type { LoadResult } from "@/lib/review"
import { Button } from "@/ui/components/nova/button"

export function LoadButton({ dataset, label, variant = "default" }: { dataset: string; label: string; variant?: "default" | "outline" }) {
  const [pending, start] = React.useTransition()
  const [result, setResult] = React.useState<LoadResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            try {
              setResult(await loadDataset(dataset))
            } catch (e) {
              setError((e as Error).message)
            }
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">
          {result.alreadyLoaded
            ? `This file was already loaded (fingerprint ${result.fileHash}). Nothing was counted twice.`
            : `${result.added} results added${result.duplicates ? `, ${result.duplicates} already held and skipped` : ""}.${result.referenceCreated ? " The reference scale was built from this file and is now frozen." : ""}`}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
