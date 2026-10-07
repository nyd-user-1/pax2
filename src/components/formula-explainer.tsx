"use client"

import * as React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/components/nova/dialog"

// A typeset formula that explains itself: muted on hover, and a click opens the explainer in the
// same dialog the Pages board uses (GovBlock's Jurisdictions board) — facts across the top, then
// labeled rows. The formula HTML is rendered on the server and passed in.

export type FormulaExplainerProps = {
  title: string
  html: string
  pill?: string
  facts: [string, string][]
  rows: [string, React.ReactNode][]
}

export function FormulaExplainer({ title, html, pill, facts, rows }: FormulaExplainerProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Explain ${title}`}
        className="min-w-0 max-w-full cursor-pointer overflow-x-auto rounded-xl px-4 py-3 text-slate-900 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none [&_.katex-display]:my-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] rounded-2xl border-0 bg-slate-100 p-2 shadow-lg sm:max-w-none">
          <div className="flex max-h-[82vh] min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
            <DialogHeader className="flex h-14 shrink-0 flex-row items-center gap-3 border-b px-5 pr-12">
              <DialogTitle className="text-base font-medium">{title}</DialogTitle>
              {pill && <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">{pill}</span>}
              <DialogDescription className="sr-only">What the {title} formula computes and why.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="overflow-x-auto rounded-xl bg-muted/50 px-4 py-3 text-slate-900 [&_.katex-display]:my-0" dangerouslySetInnerHTML={{ __html: html }} />
              <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4">
                {facts.map(([label, value]) => (
                  <div key={label} className="border-r border-b p-4 last:border-r-0 sm:border-b-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-3 text-sm">
                {rows.map(([label, value]) => (
                  <React.Fragment key={label}>
                    <dt className="font-medium text-muted-foreground">{label}</dt>
                    <dd className="m-0 min-w-0">{value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
