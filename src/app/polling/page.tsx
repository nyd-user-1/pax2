import Link from "next/link"
import { Video } from "lucide-react"

import ma from "../../../data/generated/ma-house-2022.json"
import maps from "../../../data/generated/campaign-maps.json"
import polling from "../../../data/polling.json"
import { ChartBlock, ListBlock, MapBlock, TwoThirdBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { UncontestedMap } from "@/components/map/maps"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Polling" }

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs text-slate-400 transition-colors hover:text-pax2-plum">
      {children}
    </a>
  )
}

/** Where Question 3 stands, how the idea has fared on other ballots, and where races go uncontested. */
export default function PollingPage() {
  const q = polling.q3
  const unc = (maps.uncontested as Record<string, { races: number; uncontested: number; pct: number }>).MA
  const districts = Object.entries((ma as unknown as { districts: Record<string, number> }).districts)
  const oneName = districts.filter(([, n]) => n <= 1).map(([d]) => d)
  const votes = [...polling.votes].sort((a, b) => a.year - b.year || b.yes - a.yes)

  return (
    <BlockOrder page="polling" initial={["q3", "ballots", "uncontested"]}>
      <OrderedBlock id="q3" label="Top-Two Primary Elections Initiative (2026)">
        <ChartBlock title="Top-Two Primary Elections Initiative (2026)" rows={[{ yes: q.yes, no: q.no, undecided: q.undecided, refused: q.refused, pollster: q.pollster, sample: q.sample, field: q.field, moe: q.moe }]} name="question-3">
          <div className="flex flex-col gap-5">
            <div>
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
        </ChartBlock>
      </OrderedBlock>

      <OrderedBlock id="ballots" label="On other ballots">
        <TwoThirdBlock>
          <ChartBlock title="On other ballots" className="xl:col-span-2" tools={<span className="text-xs text-slate-400">50% passes</span>} rows={votes.map((v) => ({ state: v.state, year: v.year, measure: v.measure, yes: v.yes, source: v.url }))} name="other-ballots">
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-slate-900">Yes vote on open and top-two primaries</span>
              <ul className="flex flex-col gap-2.5">
                {votes.map((v, i) => {
                  const pass = v.yes >= 50
                  return (
                    <li key={`${v.state}-${v.year}`} className="grid grid-cols-[9.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                      <a href={v.url} target="_blank" rel="noreferrer" className="flex flex-col leading-tight hover:text-pax2-plum">
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
          </ChartBlock>
          <ChartBlock title="Nationally" rows={Object.entries(polling.national.byParty).map(([party, support]) => ({ party, support }))} name="national">
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="tabular font-display text-5xl text-above">{polling.national.support}%</span>
                <span className="text-sm text-slate-600">back open primaries</span>
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
              <ul className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                {polling.national.arguments.map((x) => (
                  <li key={x.text} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700">{x.text}</span>
                    <span className="tabular shrink-0 font-semibold text-slate-900">{x.agree}%</span>
                  </li>
                ))}
              </ul>
              <a href={polling.national.url} target="_blank" rel="noreferrer" className="mt-auto text-xs text-slate-400 hover:text-pax2-plum">
                Emerson · {polling.national.field}
              </a>
            </div>
          </ChartBlock>
        </TwoThirdBlock>
      </OrderedBlock>

      <OrderedBlock id="uncontested" label="Uncontested districts">
        <TwoThirdBlock>
          <MapBlock title="Uncontested districts" className="xl:col-span-2">
            <UncontestedMap height="100%" bare />
          </MapBlock>
          <ListBlock title="One name on the ballot" search="Search districts…" rows={oneName.map((district) => ({ district }))} name="uncontested-districts" actions={<Link href="/record" className="press inline-flex w-fit items-center gap-2 rounded-full bg-pax2-ink px-4 py-1.5 text-sm font-semibold text-white shadow-e1"><Video className="size-4" /> Record</Link>}>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline gap-2">
                <span className="tabular font-display text-5xl text-below">{oneName.length}</span>
                <span className="text-sm text-slate-600">uncontested districts</span>
              </div>
              <div className="flex flex-wrap content-start gap-1.5">
                {oneName.map((d) => (
                  <span key={d} data-find className="rounded-full bg-pax2-red-soft px-2.5 py-1 text-xs font-medium text-pax2-red-deep">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </ListBlock>
        </TwoThirdBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
