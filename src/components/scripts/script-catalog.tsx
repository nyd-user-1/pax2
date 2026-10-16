"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Minus, PenLine, X } from "lucide-react"

import { AccordionBlock, CardBlock, ListBlock, MainBlock, TwoThirdBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { RecordScript } from "@/components/record/record-script"
import { toneClasses, toneOf } from "@/lib/tone"
import { cn } from "@/ui/lib/utils"

export type CatalogResearch = { label: string; diff: number; low: number; high: number; ads: number; outcome: "votechoice" | "favorability" }
export type CatalogWhy = { line: number; note: string; research: CatalogResearch | null; source: { label: string; href: string } | null }
export type CatalogScript = {
  id: string
  title: string
  approach: string
  framing: string
  provenance: string
  text: string
  lines: { t: number | null; text: string }[]
  words: number
  seconds: number
  average: number | null
  averageLow: number | null
  averageHigh: number | null
  voices: { id: string; voice: string; score: number | null; low: number | null; high: number | null }[]
  prior: { expected: number; low: number; high: number; average: number } | null
  features: { label: string; diff: number; sign: "up" | "down" | "flat"; note?: string }[]
  why: CatalogWhy[]
}

const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
const pts = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`
const OUTCOME = { votechoice: "vote choice", favorability: "favorability" } as const

function Marker({ n, hot, onHot }: { n: number; hot: boolean; onHot: (n: number | null) => void }) {
  return (
    <sup>
      <span
        onMouseEnter={() => onHot(n)}
        onMouseLeave={() => onHot(null)}
        className={cn("ml-1 inline-flex size-[17px] cursor-default items-center justify-center rounded-full align-baseline text-[10px] font-bold transition-colors", hot ? "bg-pax2-plum text-white" : "bg-pax2-lavender text-pax2-blue")}
      >
        {n}
      </span>
    </sup>
  )
}

function SourceLink({ source }: { source: { label: string; href: string } }) {
  const cls = "w-fit text-xs font-medium text-pax2-plum hover:underline"
  return source.href.startsWith("http") ? (
    <a href={source.href} target="_blank" rel="noreferrer" className={cls}>
      {source.label}
    </a>
  ) : (
    <Link href={source.href} className={cls}>
      {source.label}
    </Link>
  )
}

/** The catalog: every script a card, the chosen one read line by line with the reason for every line beside it. */
export function ScriptCatalog({ scripts, opposition }: { scripts: CatalogScript[]; opposition: { items: string[]; note: string; href: string } }) {
  const [id, setId] = React.useState(scripts[0]?.id)
  const [hot, setHot] = React.useState<number | null>(null)
  const s = scripts.find((x) => x.id === id) ?? scripts[0]
  React.useEffect(() => setHot(null), [id])
  if (!s) return null
  const hasTimes = s.lines.some((l) => l.t != null)
  const scored = s.voices.filter((v) => v.score != null)
  const marksOf = (line: number) => s.why.map((w, k) => ({ w, n: k + 1 })).filter(({ w }) => w.line === line)

  return (
    <BlockOrder page="scripts" initial={["scripts", "reading", "hear"]}>
      <OrderedBlock id="scripts" label="Scripts">
        <CardBlock title="Scripts" search="Search scripts…">
          <div role="tablist" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/record/personal"
              data-find
              className="lift flex flex-col justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-3 text-left hover:border-pax2-plum/50"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-pax2-lavender text-pax2-blue">
                <PenLine className="size-4" />
              </span>
              <span className="font-display text-[17px] leading-snug text-slate-900">Your own story</span>
              <span className="text-[13px] leading-relaxed text-slate-500">Three questions turn what you’ve seen into a script in your own words.</span>
            </Link>
            {scripts.map((x) => {
              const on = x.id === s.id
              const t = toneOf(x.averageLow, x.averageHigh)
              return (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={on}
                  type="button"
                  data-find
                  onClick={() => setId(x.id)}
                  className={cn("flex flex-col gap-2 rounded-2xl px-4 py-3 text-left transition-all", on ? "bg-white shadow-e2 ring-2 ring-pax2-plum/50" : "bg-white/60 shadow-e1 hover:bg-white hover:shadow-e2")}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="rounded-full bg-pax2-lavender px-2.5 py-0.5 text-[11px] font-semibold text-pax2-blue">{x.approach}</span>
                    {x.average != null && (
                      <span className={cn("tabular rounded-full px-2 py-0.5 text-xs font-bold", toneClasses[t], t === "even" && "outline outline-1 outline-slate-200")}>{x.average.toFixed(0)}</span>
                    )}
                  </span>
                  <span className={cn("font-display text-[17px] leading-snug", on ? "text-slate-900" : "text-slate-800")}>{x.title}</span>
                  <span className="flex-1 text-[13px] leading-relaxed text-slate-500">{x.framing}</span>
                  <span className="tabular text-xs text-slate-400">
                    ~{x.seconds}s · {x.words} words
                    {x.voices.length > 0 && ` · ${x.voices.length} takes`}
                  </span>
                </button>
              )
            })}
          </div>
        </CardBlock>
      </OrderedBlock>

      <OrderedBlock id="reading" label="Script">
        <TwoThirdBlock key={s.id} className="rise">
          <MainBlock title={s.title} id="script" className="xl:col-span-2" actions={<RecordScript id={s.id} title={s.title} text={s.text} label="Record" />}>
            <span className="tabular mb-5 block text-sm text-slate-500">
              {s.words} words · {s.seconds}s
            </span>
            <ol className="flex flex-col gap-5">
              {s.lines.map((l, i) => {
                const marks = marksOf(i)
                const lit = marks.some((m) => m.n === hot)
                return (
                  <li key={i} className={cn("grid gap-4", hasTimes && "grid-cols-[3rem_minmax(0,1fr)]")}>
                    {hasTimes && <span className="tabular pt-1 text-xs font-medium text-pax2-plum">{l.t != null ? ts(l.t) : ""}</span>}
                    <p className={cn("-mx-2 rounded-xl px-2 leading-relaxed text-slate-800 transition-colors", i === 0 ? "text-xl font-medium text-slate-900 md:text-[22px]" : "text-[17px]", lit && "bg-pax2-lavender/50")}>
                      {l.text}
                      {marks.map((m) => (
                        <Marker key={m.n} n={m.n} hot={hot === m.n} onHot={setHot} />
                      ))}
                    </p>
                  </li>
                )
              })}
            </ol>
            <p className="mt-8 text-xs leading-relaxed text-slate-400">{s.provenance}</p>
          </MainBlock>

          <AccordionBlock title="Why it’s written this way">
            <ol className="flex flex-col gap-4">
              {s.why.map((w, k) => (
                <li
                  key={k}
                  onMouseEnter={() => setHot(k + 1)}
                  onMouseLeave={() => setHot(null)}
                  className={cn("-m-2 flex gap-2.5 rounded-xl p-2 transition-colors", hot === k + 1 && "bg-pax2-lavender/50")}
                >
                  <span className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors", hot === k + 1 ? "bg-pax2-plum text-white" : "bg-pax2-lavender text-pax2-blue")}>{k + 1}</span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-sm leading-relaxed text-slate-700">{w.note}</p>
                    {w.research && (
                      <p className="tabular text-xs leading-relaxed text-slate-500">
                        In {w.research.ads} tested ads, “{w.research.label}” moved {OUTCOME[w.research.outcome]} {pts(w.research.diff)} points ({w.research.low.toFixed(1)} to {w.research.high.toFixed(1)}).
                      </p>
                    )}
                    {w.source && <SourceLink source={w.source} />}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-col gap-3 border-t pt-4">
              <span className="text-sm font-semibold text-slate-900">In tested ads</span>
              {s.prior ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  Ads coded like this one moved vote choice about {s.prior.expected.toFixed(1)} points ({s.prior.low.toFixed(1)} to {s.prior.high.toFixed(1)}); the typical tested ad, {s.prior.average.toFixed(1)}. Style alone predicts little — which is why a script gets recorded and tested.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-slate-600">This script gets its coded features and research prior when it is first analyzed.</p>
              )}
              {s.features.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {s.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-2 text-sm" title={f.note}>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", f.sign === "up" ? "bg-above-soft text-above" : f.sign === "down" ? "bg-pax2-red-soft text-below" : "bg-slate-100 text-slate-400")}>
                        {f.sign === "up" ? <Check className="size-3" /> : f.sign === "down" ? <X className="size-3" /> : <Minus className="size-3" />}
                      </span>
                      <span className="flex-1 text-slate-700">{f.label}</span>
                      <span className="tabular text-xs text-slate-400">{pts(f.diff)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/scoring/method?tab=research" className="w-fit text-xs font-medium text-pax2-plum hover:underline">
                What controlled tests found
              </Link>
            </div>

            {scored.length > 0 && (
              <div className="mt-5 flex flex-col gap-3 border-t pt-4">
                <span className="text-sm font-semibold text-slate-900">Recorded here</span>
                <ul className="flex flex-col gap-2">
                  {scored.map((v) => {
                    const t = toneOf(v.low, v.high)
                    return (
                      <li key={v.id}>
                        <Link href={`/v/${v.id}`} scroll={false} className="group flex items-center gap-2 text-sm">
                          <span className="flex-1 text-slate-700 group-hover:text-pax2-blue">{v.voice}</span>
                          {v.low != null && v.high != null && (
                            <span className="tabular text-xs text-slate-400">
                              {v.low.toFixed(0)}–{v.high.toFixed(0)}
                            </span>
                          )}
                          <span className={cn("tabular rounded-full px-2 py-0.5 text-xs font-bold", toneClasses[t], t === "even" && "outline outline-1 outline-slate-200")}>{v.score!.toFixed(0)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <p className="text-xs text-slate-400">Synthetic readings by stand-in voices.</p>
              </div>
            )}
          </AccordionBlock>
        </TwoThirdBlock>
      </OrderedBlock>

      <OrderedBlock id="hear" label="What you’ll hear back">
        <ListBlock title="What you’ll hear back">
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-slate-500">
              {opposition.note}{" "}
              <a href={opposition.href} target="_blank" rel="noreferrer" className="font-medium text-pax2-plum hover:underline">
                Who’s for and against (WBUR)
              </a>
            </p>
            <ul className="flex flex-col">
              {opposition.items.map((a) => (
                <li key={a} data-find className="flex items-start gap-2.5 border-t py-3 text-sm leading-relaxed text-slate-700">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-pax2-red-soft text-below">
                    <X className="size-3" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </ListBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
