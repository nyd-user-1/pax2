import Link from "next/link"

import type { RevealRow } from "@/lib/course"
import { cn } from "@/ui/lib/utils"

const ANSWER = { 1: "Yes", [-1]: "No", 0: "Pass" } as const
/** The learner and the classifier agree: the learner answered yes or no and it matches. A pass never agrees. */
export const agrees = (r: RevealRow) => r.present != null && r.answer !== 0 && (r.answer === 1) === r.present
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`

/** A chapter's seven traits: the learner's answer beside the classifier's, what the archive's
 *  tests measured the trait to be worth, and how well the archive's raters agreed on it. */
export function CourseReveal({ rows, next }: { rows: RevealRow[]; next: { href: string; label: string } }) {
  const agreed = rows.filter(agrees).length
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-800">
        <span className="tabular font-semibold">{agreed} of {rows.length}</span> agreed with the classifier.
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="[&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium">
              <th>Trait</th>
              <th>Learner</th>
              <th>Classifier</th>
              <th />
              <th>Lean in the tests</th>
              <th>Raters&apos; agreement</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top">
            {rows.map((r) => {
              const same = agrees(r)
              return (
                <tr key={r.key}>
                  <td className="font-medium text-slate-900">{r.name}</td>
                  <td className="text-slate-700">{ANSWER[r.answer]}</td>
                  <td className="text-slate-700">{r.present == null ? "-" : r.present ? "Present" : "Absent"}</td>
                  <td>
                    {r.answer !== 0 && r.present != null && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", same ? "bg-above-soft text-above" : "bg-pax2-red-soft text-pax2-red-deep")}>{same ? "Agree" : "Differ"}</span>
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap text-slate-700">
                    {r.lean ? (
                      <>
                        {signed(r.lean.diff)} <span className="text-slate-500">({signed(r.lean.low)} to {signed(r.lean.high)})</span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap text-slate-700">{r.icc ? `${r.icc.icc.toFixed(2)} (${r.icc.year})` : "-"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Lean: points of vote choice, ads with the trait against ads without in the same randomized test, with its 90% range. Raters&apos; agreement: the archive&apos;s ICC for the trait, latest year measured, 1 perfect.</p>
      <Link href={next.href} className="press w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
        {next.label}
      </Link>
    </div>
  )
}
