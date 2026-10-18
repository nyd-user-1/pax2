"use client"

import * as React from "react"
import { Check, Minus, UserRoundPlus, X } from "lucide-react"

import { castVote } from "@/app/actions"
import { Button } from "@/ui/components/nova/button"

const newVoter = () => `v-${Math.random().toString(36).slice(2, 8)}`

/** One statement at a time; the person passes the phone on when done. Given a `voter` (a signed-in
 *  labeler), the phone stays with them and `cast` records the vote under their session instead. */
export function ConsensusVote({ slug, statements, voted, voter: fixed, cast, finished }: { slug: string; statements: { tid: number; text: string; detail?: string; label?: string }[]; voted: Record<string, number[]>; voter?: string; cast?: (slug: string, tid: number, vote: 1 | -1 | 0) => Promise<void>; finished?: string }) {
  const [voter, setVoter] = React.useState<string | null>(fixed ?? null)
  const [done, setDone] = React.useState<number[]>([])
  const [pending, start] = React.useTransition()
  React.useEffect(() => {
    const v = fixed ?? localStorage.getItem("pax2-voter") ?? newVoter()
    if (!fixed) localStorage.setItem("pax2-voter", v)
    setVoter(v)
    setDone(voted[v] ?? [])
  }, [voted, fixed])
  const next = statements.find((s) => !done.includes(s.tid))
  const vote = (val: 1 | -1 | 0) => {
    if (!voter || !next) return
    setDone((d) => [...d, next.tid])
    start(() => (cast ? cast(slug, next.tid, val) : castVote(slug, voter, next.tid, val)))
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-pax2-mist p-5">
      <div className="flex items-center justify-between text-xs text-slate-800">
        <span>
          {done.length} of {statements.length} judged
        </span>
        {!fixed && (
          <button type="button" className="flex items-center gap-1 hover:text-pax2-blue" onClick={() => {
            const v = newVoter()
            localStorage.setItem("pax2-voter", v)
            setVoter(v)
            setDone([])
          }}>
            <UserRoundPlus className="size-3.5" /> Hand it to the next person
          </button>
        )}
      </div>
      {next ? (
        <>
          {next.label && <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{next.label}</span>}
          <p className="font-display text-2xl leading-snug text-pax2-blue">{next.text}</p>
          {next.detail && <p className="text-sm leading-relaxed text-slate-700">{next.detail}</p>}
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => vote(1)}>
              <Check className="size-4" /> Agree
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => vote(-1)}>
              <X className="size-4" /> Disagree
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => vote(0)}>
              <Minus className="size-4" /> Pass
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-800">{finished ?? "Every statement judged. Hand it to the next person to add another voice."}</p>
      )}
    </div>
  )
}
