"use client"

import * as React from "react"
import { Vote } from "lucide-react"

import { ConsensusVote } from "@/components/consensus-vote"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/components/nova/sheet"
import { cn } from "@/ui/lib/utils"

export type AgreeRow = { tid: number; text: string; agree: number; disagree: number; votes: number; rate: number; script: boolean }

/** The statements people agree on most, ranked; voting opens in a sheet. */
export function AgreeSection({ rows, slug, statements, voted, voters, groups, source }: { rows: AgreeRow[]; slug: string; statements: { tid: number; text: string }[]; voted: Record<string, number[]>; voters: number; groups: number; source: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl text-slate-900">What people agree on</h2>
          <p className="text-sm text-slate-500">
            {voters} {voters === 1 ? "person has" : "people have"} voted{groups > 1 ? ` · ${groups} groups` : ""}. Claims everyone accepts make the safest scripts.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="press inline-flex items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e1">
          <Vote className="size-4" /> Vote
        </button>
      </div>
      {rows.length ? (
        <ol className="grid gap-3 md:grid-cols-2">
          {rows.map((r, i) => (
            <li key={r.tid} style={{ ["--i" as string]: i }} className="rise surface flex flex-col gap-3 p-4">
              <p className={cn("text-[15px] leading-snug text-slate-800", r.script && "font-medium text-pax-ink")}>{r.text}</p>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="grow h-full rounded-full bg-above" style={{ width: `${Math.round(r.rate * 100)}%`, ["--i" as string]: i }} />
                </div>
                <span className="tabular w-24 shrink-0 text-right text-xs text-slate-500">
                  {Math.round(r.rate * 100)}% of {r.votes}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="surface flex flex-col items-start gap-3 p-5">
          <p className="text-slate-600">No votes yet. A few minutes of voting shows which claims are safe ground.</p>
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-pax-mist p-0 sm:max-w-[560px] data-[side=right]:sm:max-w-[560px]">
          <div className="flex flex-col gap-4 p-6">
            <SheetTitle className="font-display text-2xl text-slate-900">Vote on the statements</SheetTitle>
            <SheetDescription className="text-sm text-slate-500">Agree, disagree or pass on each. Groups form from the votes. {source}.</SheetDescription>
            <ConsensusVote slug={slug} statements={statements} voted={voted} />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
