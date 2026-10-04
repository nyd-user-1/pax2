"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Info, Minus, X } from "lucide-react"

import { PickScript } from "@/components/pick-script"
import { RecordScript } from "@/components/record/record-script"
import { toneClasses, toneOf } from "@/lib/tone"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/nova/popover"
import { cn } from "@/ui/lib/utils"

export type ReaderScript = {
  id: string
  title: string
  framing: string
  text: string
  lines: { t: number | null; text: string }[]
  words: number
  seconds: number
  average: number | null
  averageLow: number | null
  averageHigh: number | null
  voices: { id: string; voice: string; score: number | null; low: number | null; high: number | null }[]
  prior: { expected: number; low: number; high: number; average: number } | null
  features: { label: string; sign: "up" | "down" | "flat"; note?: string }[]
  chosen: { at: string; reason: string } | null
}

const verdict = (p: ReaderScript["prior"]) => (!p ? "Not coded" : p.low > p.average ? "Above typical" : p.high < p.average ? "Below typical" : "Typical")
const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Scripts read as scripts: one at a time, timed line by line, with what is known about each beside it. */
export function ScriptReader({ scripts }: { scripts: ReaderScript[] }) {
  const [id, setId] = React.useState(scripts[0]?.id)
  const s = scripts.find((x) => x.id === id) ?? scripts[0]
  if (!s) return null
  const tone = toneOf(s.averageLow, s.averageHigh)
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid gap-3 sm:grid-cols-3">
        {scripts.map((x) => {
          const on = x.id === s.id
          const t = toneOf(x.averageLow, x.averageHigh)
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setId(x.id)}
              className={cn("flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-all", on ? "bg-white shadow-e2 ring-2 ring-pax-plum/50" : "bg-white/60 shadow-e1 hover:bg-white hover:shadow-e2")}
            >
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate font-semibold", on ? "text-slate-900" : "text-slate-700")}>{x.title}</span>
                <span className="text-xs text-slate-500">{x.framing}</span>
              </span>
              {x.average != null && <span className={cn("tabular shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold", toneClasses[t])}>{x.average.toFixed(0)}</span>}
            </button>
          )
        })}
      </div>

      <div key={s.id} className="rise grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="surface px-6 py-7 md:px-10 md:py-9">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl text-slate-900 md:text-[28px]">{s.title}</h3>
            <span className="tabular text-sm text-slate-500">
              {s.words} words · {s.seconds}s
            </span>
          </div>
          <ol className="flex flex-col gap-5">
            {s.lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4">
                <span className="tabular pt-1 text-xs font-medium text-pax-plum">{l.t != null ? ts(l.t) : ""}</span>
                <p className={cn("leading-relaxed text-slate-800", i === 0 ? "text-xl font-medium text-slate-900 md:text-[22px]" : "text-[17px]")}>{l.text}</p>
              </li>
            ))}
          </ol>
        </article>

        <aside className="flex flex-col gap-4">
          <div className="surface flex flex-col gap-3 p-5">
            <RecordScript id={s.id} title={s.title} text={s.text} label="Record this script" />
            {s.chosen ? (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 size-4 shrink-0 text-above" />
                <span>
                  Chosen {new Date(s.chosen.at).toLocaleDateString([], { month: "short", day: "numeric" })}: {s.chosen.reason}
                </span>
              </p>
            ) : (
              <PickScript scriptId={s.id} />
            )}
          </div>

          <div className="surface flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Resonance</span>
              {s.average != null ? <span className={cn("tabular rounded-full px-2.5 py-0.5 text-sm font-bold", toneClasses[tone])}>{s.average.toFixed(0)}</span> : <span className="text-sm text-slate-400">No results</span>}
            </div>
            <ul className="flex flex-col">
              {s.voices.map((v) => {
                const t = toneOf(v.low, v.high)
                return (
                  <li key={v.id}>
                    <Link href={`/v/${v.id}`} scroll={false} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <span className="text-slate-700">{v.voice}</span>
                      <span className={cn("tabular font-semibold", t === "above" ? "text-above" : t === "below" ? "text-below" : "text-slate-500")}>{v.score?.toFixed(0) ?? "—"}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="surface flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                Research
                <Popover>
                  <PopoverTrigger aria-label="What the research says" className="inline-flex size-5 items-center justify-center rounded-full text-slate-400 hover:text-pax-ink">
                    <Info className="size-3.5" />
                  </PopoverTrigger>
                  <PopoverContent className="w-80 rounded-2xl p-4 text-sm leading-relaxed shadow-e3">
                    {s.prior ? (
                      <p className="text-slate-600">
                        In 617 tested campaign ads, ads coded like this one moved vote choice by about {s.prior.expected.toFixed(1)} points ({s.prior.low.toFixed(1)} to {s.prior.high.toFixed(1)}); the typical ad, {s.prior.average.toFixed(1)}. Style predicts little on its own.
                      </p>
                    ) : (
                      <p className="text-slate-600">Not coded yet.</p>
                    )}
                    <Link href="/scoring?tab=research" className="mt-2 inline-block font-medium text-pax-plum hover:underline">
                      What controlled tests found →
                    </Link>
                  </PopoverContent>
                </Popover>
              </span>
              <span className="text-sm font-semibold text-slate-700">{verdict(s.prior)}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {s.features.map((f) => (
                <li key={f.label} className="flex items-center gap-2 text-sm" title={f.note}>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", f.sign === "up" ? "bg-above-soft text-above" : f.sign === "down" ? "bg-pax-red-soft text-below" : "bg-slate-100 text-slate-400")}>
                    {f.sign === "up" ? <Check className="size-3" /> : f.sign === "down" ? <X className="size-3" /> : <Minus className="size-3" />}
                  </span>
                  <span className="text-slate-700">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
