"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Circle, Mic } from "lucide-react"

import { secondsAt, useDraft, words } from "@/components/record/draft"
import { cn } from "@/ui/lib/utils"

export type Research = { key: string; label: string; diff: number; low: number; high: number }

type CheckResult = { ok: boolean; title: string; detail: string }

function checks(text: string, research: Record<string, Research>): CheckResult[] {
  const first = (text.trim().split(/(?<=[.!?])\s+/)[0] ?? "").trim()
  const fw = words(first)
  const lower = text.toLowerCase()
  const r = (k: string) => research[k]
  const pts = (x?: Research) => (x ? `${x.diff >= 0 ? "+" : ""}${x.diff.toFixed(1)} pts of vote choice (95% range ${x.low.toFixed(1)} to ${x.high.toFixed(1)})` : "")
  return [
    {
      ok: fw > 0 && fw <= 12,
      title: fw ? `Opening line: ${fw} words` : "No opening line yet",
      detail: `The first line is what Stop measures: whether the scroll stops. “${first.slice(0, 80)}${first.length > 80 ? "…" : ""}”`,
    },
    {
      ok: /\bvote (yes|for)\b|\byes on (question )?3\b/.test(lower),
      title: "Ends with a clear ask",
      detail: `In tested campaign ads, an explicit ask to vote was worth ${pts(r("explicit_vote_for"))}.`,
    },
    {
      ok: /\b(i|i'm|i've|my|me)\b/.test(lower),
      title: "Sounds like you",
      detail: `Plain, first-person appeals from ordinary people: ${pts(r("technique_plain_folks"))}.`,
    },
    {
      ok: /\bquestion 3\b/.test(lower),
      title: "Names Question 3",
      detail: "Viewers can only act on a ballot question they can find on the ballot.",
    },
    {
      ok: /\d/.test(text),
      title: "Offers a fact",
      detail: "A concrete number gives the claim weight; check it against the campaign's sources before recording.",
    },
  ]
}

export function Editor({ research }: { research: Record<string, Research> }) {
  const router = useRouter()
  const own = useSearchParams().has("own")
  const { draft, update, ready } = useDraft()
  const [text, setText] = React.useState("")
  React.useEffect(() => {
    if (!ready) return
    if (own && draft.mode !== "own") {
      update({ mode: "own", scriptId: undefined, title: "My own words", text: "" })
      setText("")
    } else setText(draft.text ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  const cs = checks(text, research)
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              update({ text: e.target.value })
            }}
            placeholder="Say it the way you'd say it to a neighbor."
            className="h-96 w-full resize-y bg-transparent p-7 text-lg leading-loose text-pax-ink outline-none"
          />
          <div className="flex items-center justify-between border-t bg-pax-mist px-7 py-3 text-sm">
            <span className="text-muted-foreground">{words(text)} words</span>
            <span className="flex items-center gap-1.5 font-medium text-pax-ink">
              <Mic className="size-4" /> About {secondsAt(text)} seconds to say
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <button type="button" disabled={!words(text)} onClick={() => router.push("/record/camera")} className="flex items-center gap-2 rounded-full bg-pax-ink px-7 py-4 font-medium text-white shadow-lg disabled:opacity-40">
            Looks good, let&apos;s record <ArrowRight className="size-4" />
          </button>
          <Link href="/record/library" className="font-medium text-primary">
            Pick a different script
          </Link>
        </div>
      </div>
      <aside className="flex h-fit flex-col gap-3 rounded-3xl border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Before you record</p>
        {cs.map((c) => (
          <div key={c.title} className="flex gap-3">
            <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-primary text-white" : "border text-muted-foreground")}>{c.ok ? <Check className="size-3" /> : <Circle className="size-2" />}</span>
            <span className="flex flex-col">
              <span className={cn("text-sm font-medium", c.ok ? "text-pax-ink" : "text-muted-foreground")}>{c.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{c.detail}</span>
            </span>
          </div>
        ))}
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">Research figures come from 617 campaign ads tested against control groups. They are priors, not promises: style alone predicts little, which is why every take is measured.</p>
      </aside>
    </div>
  )
}
