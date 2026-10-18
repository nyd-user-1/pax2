"use client"

import * as React from "react"

import { finishChapter, labelTrait, startChapter } from "@/app/labeling/actions"
import { ConsensusVote } from "@/components/consensus-vote"
import { CourseReveal } from "@/components/course-reveal"
import type { RevealRow } from "@/lib/course"

type Statement = { tid: number; key: string; text: string; detail?: string; label?: string }

/** One chapter in three states: the lesson, the seven questions, the reveal. The classifier's
 *  answers come from the server only once all seven are answered. */
export function CourseChapter({ n, lesson, slug, voter, statements, given, voted, reveal, next, note }: { n: number; lesson: string[]; slug: string; voter: string; statements: Statement[]; given: Record<string, 1 | -1 | 0>; voted: Record<string, number[]>; reveal: RevealRow[] | null; next: { href: string; label: string }; note: string }) {
  const [step, setStep] = React.useState<"lesson" | "questions" | "reveal">(reveal ? "reveal" : Object.keys(given).length ? "questions" : "lesson")
  const [rows, setRows] = React.useState<RevealRow[] | null>(reveal)
  const [error, setError] = React.useState<string | null>(null)
  const cast = React.useRef({ ...given })

  const vote = async (conversation: string, tid: number, v: 1 | -1 | 0) => {
    await labelTrait(conversation, tid, v)
    const s = statements.find((x) => x.tid === tid)
    if (s) cast.current[s.key] = v
    if (statements.every((x) => x.key in cast.current)) {
      try {
        setRows(await finishChapter(n, cast.current))
        setStep("reveal")
      } catch (e) {
        setError((e as Error).message)
      }
    }
  }

  if (step === "lesson")
    return (
      <div className="flex flex-col gap-4">
        {lesson.map((p) => (
          <p key={p.slice(0, 40)} className="max-w-2xl text-[15px] leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
        <button
          type="button"
          className="press mt-2 w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white"
          onClick={() => {
            startChapter(n).catch(() => {})
            setStep("questions")
          }}
        >
          Begin the questions
        </button>
      </div>
    )
  if (step === "reveal" && rows) return <CourseReveal rows={rows} next={next} />
  return (
    <div className="flex flex-col gap-3">
      <ConsensusVote slug={slug} statements={statements} voted={voted} voter={voter} cast={vote} finished="All seven answered." />
      <p className="text-xs leading-relaxed text-slate-500">{note}</p>
      {error && <p className="text-sm text-pax2-red-deep">{error}</p>}
    </div>
  )
}
