import Link from "next/link"

import { reportHref, type Test } from "@/lib/trials"
import { cn } from "@/ui/lib/utils"

// Where each test left the field open: the voter groups in which no video ran above the placebo at the
// source's threshold, and those where exactly one did. These are the next test's audiences.
export function Gaps({ tests }: { tests: Test[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {tests.map((t) => {
        const groups = t.subgroups.flatMap((d) => d.groups.map((g) => ({ dimension: d.dimension, group: g.group, small: g.small, marked: t.arms.filter((a) => a.role !== "placebo" && g.cells[a.id].sig).map((a) => a.name) })))
        const none = groups.filter((g) => g.marked.length === 0)
        const one = groups.filter((g) => g.marked.length === 1)
        return (
          <div key={t.id} className="flex flex-col gap-4">
            <span className="text-sm font-semibold text-slate-900">{t.label}</span>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-500">No video above placebo · {none.length} of {groups.length}</span>
              <div className="flex flex-wrap gap-1.5">
                {none.map((g) => (
                  <span key={`${g.dimension}-${g.group}`} data-find className={cn("rounded-full bg-pax2-red-soft px-2.5 py-1 text-xs font-medium text-pax2-red-deep", g.small && "italic opacity-70")} title={g.dimension}>
                    {g.group}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-500">One video above placebo · {one.length}</span>
              <ul className="flex flex-col gap-1 text-sm">
                {one.map((g) => (
                  <li key={`${g.dimension}-${g.group}`} data-find className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-slate-700", g.small && "italic")}>
                      {g.group} <span className="text-[11px] text-slate-400">{g.dimension}</span>
                    </span>
                    <span className="shrink-0 font-medium text-above">{g.marked[0]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** What the report leaves open, each with its page. */
export const OPEN_QUESTIONS: { q: string; page: number }[] = [
  { q: "Exact confidence intervals and direct video-to-video comparisons were not supplied; no ranking between videos is established.", page: 16 },
  { q: "Which subgroup differences were prespecified, and which groups had adequate samples? No multiplicity adjustment is documented across 36 and 38 groups.", page: 16 },
  { q: "Comprehension was asked after every arm read a written explanation of Question 3: it measures recognition after reading, not recall of the video.", page: 19 },
  { q: "The explanation cards were added between the tests, but no test compared the same video with and without them.", page: 21 },
  { q: "The 2022 turnout question's exact wording is not printed in the report.", page: 15 },
  { q: "Stated support right after viewing; nothing here measures election-day votes or how long the change lasts.", page: 16 },
]

export function OpenQuestions({ unmatched }: { unmatched: string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-slate-700 marker:text-slate-400">
      {OPEN_QUESTIONS.map((x) => (
        <li key={x.q} data-find>
          {x.q}{" "}
          <Link href={reportHref(x.page)} className="tabular text-xs font-medium text-pax2-blue underline underline-offset-2 hover:text-pax2-light-blue">
            p. {x.page}
          </Link>
        </li>
      ))}
      {unmatched.length > 0 && (
        <li data-find>
          Not yet matched to a YouTube upload, so PAX2 cannot set its measurements beside the trial: {unmatched.join(", ")}.
        </li>
      )}
    </ol>
  )
}
