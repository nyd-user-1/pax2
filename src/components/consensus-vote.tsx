"use client"

import * as React from "react"
import { Check, Minus, UserRoundPlus, X } from "lucide-react"

import { castVote } from "@/app/actions"
import { Button } from "@/ui/components/nova/button"

const newVoter = () => `v-${Math.random().toString(36).slice(2, 8)}`

/** One statement at a time; the person passes the phone on when done. */
export function ConsensusVote({ slug, statements, voted }: { slug: string; statements: { tid: number; text: string }[]; voted: Record<string, number[]> }) {
  const [voter, setVoter] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<number[]>([])
  const [pending, start] = React.useTransition()
  React.useEffect(() => {
    const v = localStorage.getItem("pax-voter") ?? newVoter()
    localStorage.setItem("pax-voter", v)
    setVoter(v)
    setDone(voted[v] ?? [])
  }, [voted])
  const next = statements.find((s) => !done.includes(s.tid))
  const vote = (val: 1 | -1 | 0) => {
    if (!voter || !next) return
    setDone((d) => [...d, next.tid])
    start(() => castVote(slug, voter, next.tid, val))
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-pax-mist p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {done.length} of {statements.length} judged
        </span>
        <button type="button" className="flex items-center gap-1 hover:text-pax-ink" onClick={() => {
          const v = newVoter()
          localStorage.setItem("pax-voter", v)
          setVoter(v)
          setDone([])
        }}>
          <UserRoundPlus className="size-3.5" /> Hand it to the next person
        </button>
      </div>
      {next ? (
        <>
          <p className="font-display text-2xl leading-snug text-pax-ink">{next.text}</p>
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
        <p className="text-sm text-muted-foreground">Every statement judged. Hand it to the next person to add another voice.</p>
      )}
    </div>
  )
}
