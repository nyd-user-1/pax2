"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { CardBlock } from "@/components/blocks"
import { RefreshButton } from "@/components/dash/card-tools"
import type { PageTile } from "@/lib/build-board"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/components/nova/dialog"
import { cn } from "@/ui/lib/utils"

const DOT: Record<PageTile["state"], { dot: string; label: string }> = {
  real: { dot: "bg-pax2-light-blue", label: "Real data" },
  "stand-in": { dot: "bg-pax2-red", label: "Stand-in data" },
  mixed: { dot: "bg-slate-400", label: "Real and stand-in" },
}

/** Pages as GovBlock's Jurisdictions board: a tile each, and an overlay explaining the page when a tile is opened. */
export function PagesBoard({ pages }: { pages: PageTile[] }) {
  const [open, setOpen] = React.useState<PageTile | null>(null)
  return (
    <CardBlock
      title="Pages"
      search="Search pages…"
      rows={pages.map(({ href, name, state, data }) => ({ name, href, state, data }))}
      name="pages"
      actions={
        <>
          <div className="mr-2 hidden flex-wrap gap-3 text-xs text-slate-800 lg:flex">
            {Object.values(DOT).map((d) => (
              <span key={d.label} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", d.dot)} />
                {d.label}
              </span>
            ))}
          </div>
          <RefreshButton />
        </>
      }
    >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {pages.map((p) => (
            <button key={p.href} data-find type="button" onClick={() => setOpen(p)} className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-shadow hover:shadow-e1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span title={DOT[p.state].label} className={cn("size-2.5 shrink-0 rounded-full", DOT[p.state].dot)} />
              </span>
              <span className="font-mono text-[11px] text-slate-800">{p.href}</span>
              <span className="text-xs leading-snug text-slate-800">{p.data}</span>
            </button>
          ))}
        </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] rounded-2xl border-0 bg-slate-100 p-2 shadow-lg sm:max-w-none">
          {open && (
            <div className="flex max-h-[82vh] min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
              <DialogHeader className="flex h-14 shrink-0 flex-row items-center gap-3 border-b px-5 pr-12">
                <span className={cn("size-3 shrink-0 rounded-full", DOT[open.state].dot)} />
                <DialogTitle className="text-base font-medium">{open.name}</DialogTitle>
                <span className="rounded-md border px-1.5 py-0.5 text-xs text-slate-800">{DOT[open.state].label}</span>
                <DialogDescription className="sr-only">What the {open.name} page does and what it runs on.</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4">
                  {open.facts.map(([label, value]) => (
                    <div key={label} className="border-r border-b p-4 last:border-r-0 sm:border-b-0">
                      <p className="text-xs text-slate-800">{label}</p>
                      <p className="text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <dl className="mt-5 grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-3 text-sm">
                  {(
                    [
                      ["What", open.what],
                      ["Data", open.data],
                      ["How", open.how],
                      ["When", open.when],
                    ] as const
                  ).map(([label, value]) => (
                    <React.Fragment key={label}>
                      <dt className="font-medium text-slate-800">{label}</dt>
                      <dd className="m-0 min-w-0">{value}</dd>
                    </React.Fragment>
                  ))}
                  {open.wrong.length > 0 && (
                    <>
                      <dt className="font-medium text-pax2-red-deep">Wrong</dt>
                      <dd className="m-0">
                        <ul className="m-0 list-disc space-y-1 pl-4">
                          {open.wrong.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {open.better.length > 0 && (
                    <>
                      <dt className="font-medium text-pax2-light-blue">Better</dt>
                      <dd className="m-0">
                        <ul className="m-0 list-disc space-y-1 pl-4">
                          {open.better.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                </dl>
                <Link href={open.href} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-pax2-blue px-4 py-2 text-sm font-medium text-white hover:bg-pax2-light-blue">
                  Open {open.name} <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CardBlock>
  )
}
