"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Loader2, Minus } from "lucide-react"

import { labCheck, type Check as Result, type Stage } from "@/app/lab-actions"
import { whiteButton } from "@/components/white-button"
import { cn } from "@/ui/lib/utils"

// The scan screen: the video in the video page's portrait frame, a shimmer sweeping it while checks
// run, and beside it one vertical timeline, a node per stage. Stages are asked in order, each through
// its own server check, and a node turns into a checkmark only when that check answers done; a
// measured video sweeps through as fast as its lookups return, an unmeasured one stops open.

const STAGES: { id: Stage; label: string }[] = [
  { id: "media", label: "Media in hand" },
  { id: "cuts", label: "Cuts and pacing" },
  { id: "loudness", label: "Loudness" },
  { id: "text", label: "On-screen text" },
  { id: "transcript", label: "Transcript" },
  { id: "embedding", label: "Embedding" },
  { id: "headline", label: "Headline read" },
  { id: "neighbors", label: "Neighbors" },
  { id: "read", label: "The read" },
]

type State = { phase: "waiting" | "checking" | "answered"; result?: Result }

export function ScanScreen({ id, title }: { id: string; title: string }) {
  const [states, setStates] = React.useState<State[]>(() => STAGES.map(() => ({ phase: "waiting" })))
  const [running, setRunning] = React.useState(true)

  React.useEffect(() => {
    let live = true
    ;(async () => {
      for (let i = 0; i < STAGES.length; i++) {
        if (!live) return
        setStates((s) => s.map((x, j) => (j === i ? { phase: "checking" } : x)))
        const result = await labCheck(id, STAGES[i].id).catch(() => ({ done: false, detail: "The check failed" }))
        if (!live) return
        setStates((s) => s.map((x, j) => (j === i ? { phase: "answered", result } : x)))
      }
      if (live) setRunning(false)
    })()
    return () => {
      live = false
    }
  }, [id])

  const done = states.filter((s) => s.result?.done).length
  const complete = !running && done === STAGES.length

  return (
    <div className="grid items-start gap-10 md:grid-cols-[300px_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
        {running && <span aria-hidden className="scan-sweep" />}
      </div>

      <div className="flex flex-col gap-6">
        <ol className="relative flex flex-col">
          {STAGES.map((s, i) => {
            const st = states[i]
            const ok = st.result?.done
            const last = i === STAGES.length - 1
            return (
              <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && <span aria-hidden className={cn("absolute left-[13px] top-7 bottom-0 w-px", ok ? "bg-pax2-blue" : "bg-slate-300")} />}
                <span
                  className={cn(
                    "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    ok ? "border-pax2-blue bg-pax2-blue text-white" : st.phase === "checking" ? "border-pax2-light-blue bg-white text-pax2-light-blue" : st.phase === "answered" ? "border-dashed border-slate-400 bg-white text-slate-400" : "border-slate-300 bg-white",
                  )}
                >
                  {ok ? <Check className="size-4" strokeWidth={3} /> : st.phase === "checking" ? <Loader2 className="size-4 animate-spin" /> : st.phase === "answered" ? <Minus className="size-3.5" /> : null}
                </span>
                <span className="flex flex-col pt-0.5">
                  <span className={cn("text-[15px] font-medium", ok ? "text-slate-900" : st.phase === "answered" ? "text-slate-500" : "text-slate-700")}>{s.label}</span>
                  {st.result?.detail && <span className={cn("text-sm", ok ? "text-slate-500" : "text-slate-400")}>{st.result.detail}</span>}
                </span>
              </li>
            )
          })}
        </ol>

        {!running && (
          <div className="flex flex-col gap-3">
            <p className="tabular text-sm text-slate-600">
              {done} of {STAGES.length} stages measured
            </p>
            {!complete && (
              <div className="rounded-xl border border-dashed border-slate-400 px-4 py-3 text-sm text-slate-500">
                Planned: running the boxes on a video the Lab has not measured. Until then, the open stages fill as the catalog runs reach this video.
              </div>
            )}
            <Link href={`/v/yt-${id}`} className={whiteButton("md", "w-fit")}>
              Open the measured record
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
