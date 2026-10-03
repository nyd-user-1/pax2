"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Check, Info, Sparkles } from "lucide-react"

import { PickScript } from "@/components/pick-script"
import { RecordScript } from "@/components/record/record-script"
import { TONE_LABEL, toneClasses, toneOf } from "@/lib/tone"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/nova/popover"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/components/nova/sheet"
import { cn } from "@/ui/lib/utils"

export type ScriptVideo = { id: string; voice: string; poster?: string; score: number | null; low: number | null; high: number | null }
export type ScriptCardData = {
  id: string
  title: string
  framing: string
  text: string
  words: number
  seconds: number
  opening: string
  videos: ScriptVideo[]
  best: number | null
  average: number | null
  agree: { rate: number; votes: number; claim: string } | null
  prior: { expected: number; low: number; high: number; average: number } | null
  features: { label: string; share: number; diff: number; sign: "up" | "down" | "flat"; note?: string }[]
  leader: boolean
  chosen: { at: string; reason: string } | null
}

const research = (p: ScriptCardData["prior"]) => (!p ? "No prior" : p.low > p.average ? "Above typical" : p.high < p.average ? "Below typical" : "Typical")

function Chip({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={cn("text-sm font-semibold text-slate-900", tone)}>{value}</span>
    </div>
  )
}

function ResearchChip({ s }: { s: ScriptCardData }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">
        Research
        <Popover>
          <PopoverTrigger onClick={(e) => e.stopPropagation()} aria-label="What the research says" className="inline-flex size-4 items-center justify-center rounded-full text-slate-400 hover:text-pax-ink">
            <Info className="size-3" />
          </PopoverTrigger>
          <PopoverContent onClick={(e) => e.stopPropagation()} className="w-80 rounded-2xl p-4 text-sm leading-relaxed shadow-e3">
            <p className="font-semibold text-pax-ink">What 617 tested ads suggest</p>
            {s.prior ? (
              <p className="text-slate-600">
                Ads coded like this one moved vote choice by about {s.prior.expected.toFixed(1)} points; a new one could land anywhere from {s.prior.low.toFixed(1)} to {s.prior.high.toFixed(1)}. The typical ad: {s.prior.average.toFixed(1)}. Features predict little on their own, so treat this as a weak signal.
              </p>
            ) : (
              <p className="text-slate-600">Not coded yet.</p>
            )}
            <Link href="/scoring?tab=research" className="font-medium text-pax-plum hover:underline">
              The research, feature by feature →
            </Link>
          </PopoverContent>
        </Popover>
      </span>
      <span className="text-sm font-semibold text-slate-900">{research(s.prior)}</span>
    </div>
  )
}

function Strip({ videos, size = "sm" }: { videos: ScriptVideo[]; size?: "sm" | "lg" }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {videos.map((v) => {
        const tone = toneOf(v.low, v.high)
        return (
          <Link key={v.id} href={`/v/${v.id}`} scroll={false} onClick={(e) => e.stopPropagation()} className={cn("group/v relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-200 shadow-e1", size === "lg" && "rounded-2xl")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.poster && <img src={v.poster} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/v:scale-[1.05]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0" />
            {v.score != null && (
              <span title={TONE_LABEL[tone]} className={cn("absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-xs font-bold shadow-e1", toneClasses[tone])}>
                {v.score.toFixed(0)}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-1.5 text-center text-[11px] font-medium text-white">{v.voice}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** The three scripts side by side; a card opens its sheet with the full text and the evidence. */
export function ScriptBoard({ scripts }: { scripts: ScriptCardData[] }) {
  const [open, setOpen] = React.useState<ScriptCardData | null>(null)
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {scripts.map((s, i) => {
          const tone = toneOf(s.videos.find((v) => v.score === s.best)?.low ?? null, s.videos.find((v) => v.score === s.best)?.high ?? null)
          return (
            <article
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpen(s)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(s)}
              style={{ ["--i" as string]: i }}
              className={cn("rise lift surface flex cursor-pointer flex-col gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-pax-plum", s.leader && "ring-2 ring-pax-plum/40")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{s.framing}</span>
                <span className="flex items-center gap-1.5">
                  {s.chosen && <span className="inline-flex items-center gap-1 rounded-full bg-above-soft px-2.5 py-0.5 text-xs font-semibold text-above"><Check className="size-3" /> Chosen</span>}
                  {s.leader && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pax-lavender px-2.5 py-0.5 text-xs font-semibold text-pax-plum">
                      <Sparkles className="size-3" /> Best bet
                    </span>
                  )}
                </span>
              </div>
              <h3 className="font-display text-2xl leading-tight text-slate-900">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-slate-600">“{s.opening}”</p>
              <Strip videos={s.videos} />
              <div className="mt-auto grid grid-cols-3 gap-2">
                <Chip label="Best result" value={s.best != null ? s.best.toFixed(0) : "None yet"} tone={s.best != null ? (tone === "above" ? "text-above" : tone === "below" ? "text-below" : undefined) : "text-slate-400"} />
                <Chip label="Agree" value={s.agree ? `${Math.round(s.agree.rate * 100)}%` : "No votes"} tone={s.agree ? undefined : "text-slate-400"} />
                <ResearchChip s={s} />
              </div>
            </article>
          )
        })}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-pax-mist p-0 sm:max-w-[640px] data-[side=right]:sm:max-w-[640px]">
          {open && (
            <div className="flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-1.5 pr-10">
                <span className="text-xs font-medium text-slate-500">
                  {open.framing} · {open.words} words · about {open.seconds} seconds
                </span>
                <SheetTitle className="font-display text-[28px] leading-tight text-slate-900">{open.title}</SheetTitle>
                <SheetDescription className="sr-only">The full script, its videos and the evidence for it.</SheetDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <RecordScript id={open.id} title={open.title} text={open.text} label="Record" />
              </div>

              <div className="surface p-5">
                <p className="whitespace-pre-line text-[17px] leading-[1.7] text-slate-800">{open.text}</p>
              </div>

              <section className="flex flex-col gap-3">
                <h4 className="font-semibold text-slate-900">Its videos</h4>
                <Strip videos={open.videos} size="lg" />
                {open.average != null && <p className="text-sm text-slate-500">Average Resonance {open.average.toFixed(0)} across {open.videos.filter((v) => v.score != null).length} videos.</p>}
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="font-semibold text-slate-900">Agreement on its central claim</h4>
                {open.agree ? (
                  <p className="text-sm text-slate-700">
                    “{open.agree.claim}” <span className="font-semibold text-slate-900">{Math.round(open.agree.rate * 100)}% agree</span> of {open.agree.votes} votes.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No votes yet. Volunteers can vote under “What people agree on.”</p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="font-semibold text-slate-900">What the research suggests</h4>
                {open.prior && (
                  <p className="text-sm text-slate-700">
                    {research(open.prior)}: ads coded like this one moved vote choice by about {open.prior.expected.toFixed(1)} points ({open.prior.low.toFixed(1)} to {open.prior.high.toFixed(1)}); the typical ad, {open.prior.average.toFixed(1)}. A weak signal on its own.
                  </p>
                )}
                <ul className="flex flex-col divide-y divide-slate-100 rounded-xl bg-white text-sm shadow-e1">
                  {open.features.map((f) => (
                    <li key={f.label} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <span className="text-slate-700">
                        {f.label}
                        {f.note && <span className="block text-xs text-slate-500">{f.note}</span>}
                      </span>
                      <span className={cn("tabular shrink-0 text-xs font-semibold", f.sign === "up" ? "text-above" : f.sign === "down" ? "text-below" : "text-slate-400")}>
                        {f.sign === "up" ? "Helps" : f.sign === "down" ? "Hurts" : "Unclear"}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/scoring?tab=research" className="inline-flex items-center gap-1 text-sm font-medium text-pax-plum hover:underline">
                  The research, feature by feature <ArrowUpRight className="size-3.5" />
                </Link>
              </section>

              <section className="flex flex-col gap-2 border-t border-slate-200 pt-5">
                <h4 className="font-semibold text-slate-900">{open.chosen ? "Chosen for the next round" : "Choose it for the next round"}</h4>
                {open.chosen ? (
                  <p className="text-sm text-slate-700">
                    {new Date(open.chosen.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: {open.chosen.reason}
                  </p>
                ) : (
                  <PickScript scriptId={open.id} />
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
