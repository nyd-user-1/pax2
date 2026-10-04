import Link from "next/link"
import { Check, PenLine, Plus, X } from "lucide-react"

import ma from "../../../data/generated/ma-house-2022.json"
import maps from "../../../data/generated/campaign-maps.json"
import codes from "../../../data/generated/model/script-codes.json"
import model from "../../../data/generated/model/reference-model.json"
import polling from "../../../data/polling.json"
import { UncontestedMap } from "@/components/map/maps"
import { ScriptReader, type ReaderScript } from "@/components/scripts/script-reader"
import { SCRIPTS } from "@/lib/catalog"
import { board, picks, workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scripts" }

type Codes = { scripts: Record<string, { codes: Record<string, number>; notes: Record<string, string>; prior: Record<string, { expected: number; low: number; high: number; average: number }> }> }
type Model = { featureLabels: Record<string, string>; outcomes: Record<string, { features: { key: string; diff: number; low: number; high: number }[] }> }

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs text-slate-400 transition-colors hover:text-pax-plum">
      {children}
    </a>
  )
}

/** The script to record next, and what decides it: the race, how the idea has fared at the ballot, where it hits home. */
export default async function ScriptsPage() {
  const ws = await workspace()
  const C = codes as unknown as Codes
  const RM = model as unknown as Model
  const vc = new Map(RM.outcomes.votechoice.features.map((f) => [f.key, f]))
  const [{ takes }, chosen] = await Promise.all([board(ws), picks(ws)])

  const scripts: ReaderScript[] = SCRIPTS.map((s) => {
    const c = C.scripts[s.id]
    const mine = takes.filter((x) => x.take.scriptId === s.id && x.take.captions && !x.take.cut)
    const timed = mine[0]?.take.lines ?? []
    const paras = s.text.split("\n").filter((l) => l.trim())
    const scored = mine.filter((x) => x.latest?.score.value != null)
    const pick = chosen.filter((x) => x.scriptId === s.id).sort((a, b) => b.at.localeCompare(a.at))[0]
    return {
      id: s.id,
      title: s.title,
      framing: s.framing,
      text: s.text,
      lines: paras.map((text, i) => ({ text, t: timed[i]?.t ?? null })),
      words: s.words,
      seconds: mine.length ? Math.round(mean(mine.map((x) => x.take.durationSec))!) : s.seconds,
      average: mean(scored.map((x) => x.latest!.score.value!)),
      averageLow: mean(scored.map((x) => x.latest!.score.low ?? x.latest!.score.value!)),
      averageHigh: mean(scored.map((x) => x.latest!.score.high ?? x.latest!.score.value!)),
      voices: mine.map((x) => ({ id: x.take.id, voice: x.take.voice, score: x.latest?.score.value ?? null, low: x.latest?.score.low ?? null, high: x.latest?.score.high ?? null })),
      prior: c?.prior.votechoice ?? null,
      features: Object.entries(c?.codes ?? {})
        .filter(([, v]) => v >= 0.5)
        .map(([k]) => ({ k, f: vc.get(k) }))
        .filter((x) => x.f)
        .sort((a, b) => Math.abs(b.f!.diff) - Math.abs(a.f!.diff))
        .slice(0, 5)
        .map(({ k, f }) => ({ label: RM.featureLabels[k], sign: (f!.low > 0 ? "up" : f!.high < 0 ? "down" : "flat") as "up" | "down" | "flat", note: c.notes[k] })),
      chosen: pick ? { at: pick.at, reason: pick.reason } : null,
    }
  })

  const q = polling.q3
  const unc = (maps.uncontested as Record<string, { races: number; uncontested: number; pct: number }>).MA
  const districts = Object.entries((ma as unknown as { districts: Record<string, number> }).districts)
  const oneName = districts.filter(([, n]) => n <= 1).map(([d]) => d)
  const votes = [...polling.votes].sort((a, b) => a.year - b.year || b.yes - a.yes)

  return (
    <div className="flex flex-col gap-14">
      <header className="rise flex flex-wrap items-end justify-between gap-4 md:pt-9">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Scripts</h1>
        <div className="flex items-center gap-2">
          <Link href="/record/personal" className="press inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-pax-ink shadow-e1">
            <PenLine className="size-4" /> Write your own
          </Link>
          <Link href="/record" className="press inline-flex items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e2">
            <Plus className="size-4" /> Record
          </Link>
        </div>
      </header>

      <ScriptReader scripts={scripts} />

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl text-slate-900">Question 3 today</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="surface flex flex-col gap-5 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">If the vote were today</span>
              <Source href={q.url}>
                {q.pollster} · {q.sample} · {q.field} · {q.moe}
              </Source>
            </div>
            <div className="flex h-12 overflow-hidden rounded-xl">
              <div className="grow flex items-center bg-above px-3 text-sm font-bold text-white" style={{ width: `${q.yes}%` }}>
                Yes {q.yes}%
              </div>
              <div className="grow flex items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600" style={{ width: `${q.undecided + q.refused}%`, ["--i" as string]: 1 }}>
                {q.undecided}%
              </div>
              <div className="grow flex items-center justify-end bg-below px-3 text-sm font-bold text-white" style={{ width: `${q.no}%`, ["--i" as string]: 2 }}>
                No {q.no}%
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-slate-900">{q.undecided}%</span>
                <span className="text-sm text-slate-600">undecided: the voters a script has to win</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-slate-900">{polling.enrollment.unenrolled}%</span>
                <span className="text-sm text-slate-600">of registered voters belong to no party</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-below">{unc.pct}%</span>
                <span className="text-sm text-slate-600">of legislative races uncontested, 2014–2022</span>
              </div>
            </div>
          </div>

          <div className="surface flex flex-col gap-4 p-6">
            <span className="text-sm font-semibold text-slate-900">The arguments</span>
            <ul className="flex flex-col gap-2.5">
              {["More candidates run when two always advance", "Every voter, in any party or none, picks from the full field", "Candidates have to answer to a majority"].map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-above-soft text-above">
                    <Check className="size-3" />
                  </span>
                  {a}
                </li>
              ))}
              {["Can leave two candidates of one party in November", "Favors self-funded candidates", "Squeezes out third parties"].map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-pax-red-soft text-below">
                    <X className="size-3" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
              {["Officials of both parties", "NAACP"].map((x) => (
                <span key={x} className="rounded-full bg-above-soft px-2.5 py-1 text-xs font-medium text-above">
                  {x}
                </span>
              ))}
              {["Both state parties", "AFL-CIO"].map((x) => (
                <span key={x} className="rounded-full bg-pax-red-soft px-2.5 py-1 text-xs font-medium text-pax-red-deep">
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl text-slate-900">On other ballots</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="surface flex flex-col gap-3 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">Yes vote on open and top-two primaries</span>
              <span className="text-xs text-slate-400">50% passes</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {votes.map((v, i) => {
                const pass = v.yes >= 50
                return (
                  <li key={`${v.state}-${v.year}`} className="grid grid-cols-[9.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                    <a href={v.url} target="_blank" rel="noreferrer" className="flex flex-col leading-tight hover:text-pax-plum">
                      <span className="text-sm font-medium text-slate-800">
                        {v.state} <span className="font-normal text-slate-400">{v.year}</span>
                      </span>
                      <span className="truncate text-[11px] text-slate-400">{v.measure}</span>
                    </a>
                    <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
                      <div className={cn("grow h-full rounded-md", pass ? "bg-above" : "bg-below/80")} style={{ width: `${v.yes}%`, ["--i" as string]: i }} />
                      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-900/40" />
                    </div>
                    <span className={cn("tabular text-right text-sm font-semibold", pass ? "text-above" : "text-below")}>{v.yes.toFixed(1)}%</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="surface flex flex-col gap-4 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">Asked in the abstract</span>
              <Source href={polling.national.url}>
                Emerson · {polling.national.field}
              </Source>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tabular font-display text-5xl text-above">{polling.national.support}%</span>
              <span className="text-sm text-slate-600">of voters nationally back open primaries</span>
            </div>
            <ul className="flex flex-col gap-2">
              {Object.entries(polling.national.byParty).map(([p, n], i) => (
                <li key={p} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                  <span className="text-slate-600">{p}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="grow h-full rounded-full bg-above" style={{ width: `${n}%`, ["--i" as string]: i }} />
                  </div>
                  <span className="tabular text-right font-semibold text-slate-800">{n}%</span>
                </li>
              ))}
            </ul>
            <ul className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-4">
              {polling.national.arguments.map((a) => (
                <li key={a.text} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-700">{a.text}</span>
                  <span className="tabular shrink-0 font-semibold text-slate-900">{a.agree}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl text-slate-900">Uncontested districts</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <UncontestedMap />
          <div className="surface flex flex-col gap-4 p-6">
            <div className="flex items-baseline gap-2">
              <span className="tabular font-display text-5xl text-below">{oneName.length}</span>
              <span className="text-sm text-slate-600">of {districts.length} House districts had one name on the 2022 ballot</span>
            </div>
            <div className="flex max-h-72 flex-wrap content-start gap-1.5 overflow-y-auto [scrollbar-width:thin]">
              {oneName.map((d) => (
                <span key={d} className="rounded-full bg-pax-red-soft px-2.5 py-1 text-xs font-medium text-pax-red-deep">
                  {d}
                </span>
              ))}
            </div>
            <Link href="/record" className="press mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e1">
              <Plus className="size-4" /> Record from one of them
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
