"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { TableBlock } from "@/components/blocks"
import { cn } from "@/ui/lib/utils"

export type UpworthyData = {
  built: string
  method: string
  counts: { packages: number; headlines: number; top: number; tests: number; winners: number; losers: number }
  ctr: { top: number; all: number }
  words: { top: number; all: number }
  swing: number
  patterns: { key: string; label: string; top: number; all: number; won: number; lost: number }[]
  rows: { h: string; i: number; c: number; r: number; w: boolean }[]
}

type SortKey = "rank" | "h" | "i" | "c" | "r"

export function UpworthyTable({ data }: { data: UpworthyData }) {
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<{ k: SortKey; d: 1 | -1 }>({ k: "i", d: -1 })
  const ranked = React.useMemo(() => data.rows.map((r, i) => ({ ...r, rank: i + 1 })), [data.rows])
  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    const xs = needle ? ranked.filter((r) => r.h.toLowerCase().includes(needle)) : [...ranked]
    const { k, d } = sort
    xs.sort((a, b) => (k === "h" ? a.h.localeCompare(b.h) * d : (a[k] - b[k]) * d))
    return xs
  }, [ranked, q, sort])

  const flip = (k: SortKey, firstDesc: boolean) => setSort((s) => (s.k === k ? { k, d: (s.d * -1) as 1 | -1 } : { k, d: firstDesc ? -1 : 1 }))
  const Th = ({ k, label, firstDesc = true, className }: { k: SortKey; label: string; firstDesc?: boolean; className?: string }) => (
    <th className={cn("whitespace-nowrap px-3 py-2 font-medium", className)}>
      <button type="button" onClick={() => flip(k, firstDesc)} className="inline-flex items-center gap-1 hover:text-pax-ink">
        {label}
        {sort.k === k && (sort.d === 1 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    </th>
  )

  return (
    <TableBlock
      title="Headlines"
      search="Search headlines…"
      searchValue={q}
      onSearch={setQ}
      rows={shown.map((r) => ({ rank: r.rank, headline: r.h, impressions: r.i, clicks: r.c, rate: r.r, won: r.w }))}
      name="headlines"
    >
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="bg-muted/60">
              <Th k="rank" label="#" firstDesc={false} className="w-12" />
              <Th k="h" label="Headline" firstDesc={false} />
              <Th k="i" label="Impressions" className="text-right" />
              <Th k="c" label="Clicks" className="text-right" />
              <Th k="r" label="Click rate" className="text-right" />
              <th className="whitespace-nowrap px-3 py-2 font-medium">Won its test</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {shown.map((r) => (
              <tr key={r.rank} className="border-t border-slate-100">
                <td className="px-3 py-2.5 text-xs text-slate-400">{r.rank}</td>
                <td className="min-w-72 px-3 py-2.5 leading-snug text-slate-800">{r.h}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.i.toLocaleString()}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.c.toLocaleString()}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-900">{r.r.toFixed(1)}%</td>
                <td className="px-3 py-2.5">{r.w ? <Check className="size-4 text-above" /> : null}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  No headline matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </TableBlock>
  )
}

export function UpworthyLessons({ data }: { data: UpworthyData }) {
  const p = (key: string) => data.patterns.find((x) => x.key === key)
  const lessons = [
    `The words are worth testing: across the ${data.counts.tests.toLocaleString()} stories tried with two or more headlines, the best wording drew ${data.swing}× the clicks of the worst at the median — same story, same day, same audience.`,
    p("question") && p("whatwhyhow") && `State, don't ask: questions sit in ${p("question")!.won}% of winning headlines and ${p("question")!.lost}% of losing ones, and “What”, “Why” or “How” openers skew the same way (${p("whatwhyhow")!.won}% against ${p("whatwhyhow")!.lost}%).`,
    p("watch") && `Name the act of viewing: “watch”, “see” or “listen” appears in ${p("watch")!.won}% of winners against ${p("watch")!.lost}% of losers, and in ${p("watch")!.top}% of the top 500 against ${p("watch")!.all}% of the archive. For a video, the opening line promises what's about to be seen.`,
    p("caps") && `Shouting loses: a word in ALL CAPS sits in ${p("caps")!.won}% of winners against ${p("caps")!.lost}% of losers.`,
    p("firstperson") && `First person edges ahead: “I” or “my” in ${p("firstperson")!.won}% of winners against ${p("firstperson")!.lost}% of losers — a person telling their own story.`,
    p("digit") && `A number helps a little: ${p("digit")!.won}% of winners carry one, against ${p("digit")!.lost}% of losers.`,
    p("you") && `“You” is not the lever: it appears in ${p("you")!.won}% of winners and ${p("you")!.lost}% of losers alike — what the line promises matters, not who it addresses.`,
    `Length teaches nothing here: the archive held headlines near ${data.words.all} words, so it cannot say whether shorter wins.`,
  ].filter((x): x is string => typeof x === "string")

  return (
    <div className="surface flex flex-col gap-3 p-5 md:p-6">
      <ul className="flex flex-col gap-2.5">
        {lessons.map((x) => (
          <li key={x} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-pax-plum" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
