"use client"

import Link from "next/link"

import { SmallBlock } from "@/components/blocks"
import type { TrialEntry } from "@/lib/trials"
import { cn } from "@/ui/lib/utils"

// The video page's randomized-test result, for a short that was one arm of a message test: its lift in
// ballot support and comprehension against the test's placebo, and the voter groups where it moved Yes the
// most. Takes trialEntries(youtubeId) from src/lib/trials.ts (server side); renders nothing when empty.
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")

export function TrialBlock({ entries }: { entries: TrialEntry[] }) {
  if (!entries.length) return null
  return (
    <SmallBlock title="Message test" more={entries[0].experiments} rows={entries.map((e) => ({ test: e.test, dates: e.dates, n: e.n, yes_lift: e.yes.lift ?? null, yes_marked: e.yes.sig ?? null, comprehension_lift: e.comprehension.lift ?? null, comprehension_marked: e.comprehension.sig ?? null }))} name="message-test">
      <div className="flex flex-col gap-5">
        {entries.map((e) => (
          <div key={e.test} className="flex flex-col gap-3">
            <p className="tabular text-xs text-slate-500">
              {e.test} · {e.dates} · {e.fieldedBy} · n={e.n} against a placebo of {e.placeboN}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Ballot support", e.yes, e.placebo?.yes],
                ["Comprehension", e.comprehension, e.placebo?.comprehension],
              ].map(([label, o, base]) => {
                const out = o as TrialEntry["yes"]
                return (
                  <div key={label as string} className="flex flex-col gap-0.5 rounded-xl bg-slate-50 p-3">
                    <span className="text-xs text-slate-500">{label as string}</span>
                    <span className={cn("tabular font-display text-2xl", out.sig ? "text-above" : "text-slate-500")}>{signed(out.lift ?? 0)} pts</span>
                    <span className="text-[11px] text-slate-500">
                      {out.level != null && base != null ? `${out.level}% vs ${base}% · ` : ""}
                      {out.sig ? "above placebo" : "not distinguishable"}
                    </span>
                  </div>
                )
              })}
            </div>
            {e.groups.top.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500">
                  Above placebo in {e.groups.marked} of {e.groups.total} voter groups; largest gaps
                </span>
                <ul className="flex flex-col gap-1 text-sm">
                  {e.groups.top.map((g) => (
                    <li key={`${g.dimension}-${g.group}`} className="flex items-baseline justify-between gap-3">
                      <span className="text-slate-700">
                        {g.group} <span className="text-[11px] text-slate-400">{g.dimension}</span>
                      </span>
                      <span className="tabular shrink-0 font-semibold text-above">
                        {g.v}% <span className="font-normal text-slate-400">vs {g.placebo}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Link href={e.report} className="font-medium text-pax2-blue underline underline-offset-2 hover:text-pax2-light-blue">
                Report
              </Link>
              <Link href={e.experiments} className="font-medium text-pax2-blue underline underline-offset-2 hover:text-pax2-light-blue">
                Experiments
              </Link>
              <span className="text-slate-400">{e.cards ? "Tested with explanation cards; " : ""}the tested cut can differ from this upload.</span>
            </div>
          </div>
        ))}
      </div>
    </SmallBlock>
  )
}
