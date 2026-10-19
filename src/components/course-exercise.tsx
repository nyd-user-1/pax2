"use client"

import * as React from "react"
import Link from "next/link"

import { answerRound, finishCourseChapter, startCourseChapter } from "@/app/learn/course-actions"
import type { Answer, Card, Result, Round } from "@/lib/courses"
import { Button } from "@/ui/components/nova/button"
import { cn } from "@/ui/lib/utils"

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

function VideoCard({ c, rank, small }: { c: Card; rank?: number; small?: boolean }) {
  return (
    <span className="relative flex min-w-0 flex-col gap-2 text-left">
      <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(c.id)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        {rank != null && <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-pax2-blue text-sm font-semibold text-white">{rank}</span>}
      </span>
      {c.title && <span className={cn("line-clamp-3 font-medium leading-snug text-slate-900", small ? "text-xs" : "text-sm")}>{c.title}</span>}
      {c.channel && <span className="text-xs text-slate-500">{c.channel}</span>}
    </span>
  )
}

const option = "rounded-2xl border bg-card p-3 transition hover:border-pax2-blue hover:shadow-e1 disabled:opacity-50"

function RoundView({ r, onAnswer, pending }: { r: Round; onAnswer: (a: Answer) => void; pending: boolean }) {
  const [order, setOrder] = React.useState<number[]>([])
  const [num, setNum] = React.useState("")
  const [hi, setHi] = React.useState("")
  const [text, setText] = React.useState("")
  const cols = (r.cards?.length ?? 0) >= 4 ? "grid-cols-2 sm:grid-cols-4" : (r.cards?.length ?? 0) === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
  const n = Number(num.replace(/,/g, ""))
  const h = Number(hi.replace(/,/g, ""))
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-2xl leading-snug text-pax2-blue">{r.prompt}</p>
      {r.anchor && (
        <div className="w-1/2 max-w-64 rounded-2xl border-2 border-pax2-blue/40 bg-pax2-mist p-3 sm:w-1/3">
          <VideoCard c={r.anchor} small />
        </div>
      )}
      {r.embed && (
        <div className="aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
          <iframe src={`https://www.youtube.com/embed/${r.embed}`} title={r.cards?.[0]?.title ?? "Short"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0" />
        </div>
      )}
      {r.context && <p className={cn("leading-relaxed text-slate-800", r.kind === "text" || r.from === "choices" ? "rounded-xl border-l-4 border-pax2-light-blue bg-pax2-mist px-4 py-3 text-base" : "text-sm")}>{r.context}</p>}
      {r.note && <p className="-mt-2 text-xs text-slate-500">{r.note}</p>}

      {r.kind === "pick" && r.from === "cards" && (
        <div className={cn("grid gap-3", cols)}>
          {r.cards!.map((c, i) => (
            <button key={c.id} type="button" disabled={pending} className={option} onClick={() => onAnswer(i)}>
              <VideoCard c={c} />
            </button>
          ))}
        </div>
      )}
      {r.kind === "pick" && r.from === "texts" && (
        <div className="flex flex-col gap-3">
          {r.texts!.map((t, i) => (
            <button key={t} type="button" disabled={pending} className={cn(option, "px-4 py-3 text-left text-base leading-relaxed text-slate-800")} onClick={() => onAnswer(i)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {r.kind === "pick" && r.from === "choices" && (
        <>
          {!r.embed && r.cards && (
            <div className={cn("grid gap-3", r.cards.length === 1 ? "max-w-sm grid-cols-1" : cols)}>
              {r.cards.map((c) => (
                <div key={c.id} className="rounded-2xl border bg-card p-3">
                  <VideoCard c={c} />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {r.choices!.map((c, i) => (
              <Button key={c} variant={i === 0 ? "default" : "outline"} disabled={pending} onClick={() => onAnswer(i)}>
                {c}
              </Button>
            ))}
          </div>
        </>
      )}
      {r.kind === "pick" && r.cant && (
        <Button variant="ghost" className="w-fit" disabled={pending} onClick={() => onAnswer(-1)}>
          Can&apos;t tell
        </Button>
      )}

      {r.kind === "order" && (
        <>
          <div className={cn("grid gap-3", cols)}>
            {r.cards!.map((c, i) => {
              const at = order.indexOf(i)
              return (
                <button key={c.id} type="button" disabled={pending || at >= 0} className={cn(option, at >= 0 && "border-pax2-blue opacity-100 disabled:opacity-100")} onClick={() => setOrder((o) => [...o, i])}>
                  <VideoCard c={c} rank={at >= 0 ? at + 1 : undefined} />
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button disabled={pending || order.length !== r.cards!.length} onClick={() => onAnswer(order)}>
              Submit
            </Button>
            <Button variant="outline" disabled={pending || !order.length} onClick={() => setOrder([])}>
              Start over
            </Button>
          </div>
        </>
      )}

      {r.kind !== "pick" && r.kind !== "order" && r.cards && !r.embed && (
        <div className="max-w-sm rounded-2xl border bg-card p-3">
          <VideoCard c={r.cards[0]} />
        </div>
      )}
      {r.kind === "number" && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => (e.preventDefault(), onAnswer(n))}>
          <input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} className="tabular h-10 w-40 rounded-lg border bg-card px-3 text-base" aria-label={r.unit} />
          <span className="text-sm text-slate-500">{r.unit}</span>
          <Button type="submit" disabled={pending || !num.trim() || !Number.isFinite(n) || n < 0 || (r.max != null && n > r.max)}>
            Submit
          </Button>
        </form>
      )}
      {r.kind === "range" && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => (e.preventDefault(), onAnswer([n, h]))}>
          <input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Low" className="tabular h-10 w-32 rounded-lg border bg-card px-3 text-base" />
          <span className="text-sm text-slate-500">to</span>
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} placeholder="High" className="tabular h-10 w-32 rounded-lg border bg-card px-3 text-base" />
          <span className="text-sm text-slate-500">{r.unit}</span>
          <Button type="submit" disabled={pending || !num.trim() || !hi.trim() || !Number.isFinite(n) || !Number.isFinite(h) || n < 0 || h < 0}>
            Submit
          </Button>
        </form>
      )}
      {r.kind === "text" && (
        <form className="flex flex-col gap-2" onSubmit={(e) => (e.preventDefault(), onAnswer(text))}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-xl border bg-card px-3 py-2 text-base leading-relaxed" />
          <Button type="submit" className="w-fit" disabled={pending || text.trim().length < 2}>
            Submit
          </Button>
        </form>
      )}
    </div>
  )
}

function ResultView({ result, next }: { result: Result; next: { href: string; label: string } }) {
  const actual = result.rows.some((r) => r.actual)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-slate-800">{result.headline}</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="[&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium">
              <th>Shown</th>
              <th>Answer</th>
              {actual && <th>What happened</th>}
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top">
            {result.rows.map((r, i) => (
              <tr key={i}>
                <td className="max-w-72 text-slate-700">{r.shown}</td>
                <td className="max-w-72 text-slate-900">{r.answer}</td>
                {actual && <td className="max-w-72 text-slate-700">{r.actual ?? "-"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href={next.href} className="press w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
        {next.label}
      </Link>
    </div>
  )
}

/** One chapter: the lesson, then the exercise one round at a time, then what the answers showed. */
export function CourseExercise({ course, n, lesson, rounds, given, result, next }: { course: string; n: number; lesson: string[]; rounds: Round[]; given: Record<string, Answer>; result: Result | null; next: { href: string; label: string } }) {
  const [step, setStep] = React.useState<"lesson" | "rounds" | "result">(result ? "result" : Object.keys(given).length ? "rounds" : "lesson")
  const [answers, setAnswers] = React.useState<Record<string, Answer>>(given)
  const [shown, setShown] = React.useState<Result | null>(result)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, start] = React.useTransition()
  const current = rounds.find((r) => !(r.id in answers))
  const answer = (a: Answer) => {
    if (!current) return
    setError(null)
    start(async () => {
      try {
        await answerRound(course, n, current.id, a)
        const all = { ...answers, [current.id]: a }
        setAnswers(all)
        if (rounds.every((r) => r.id in all)) {
          setShown(await finishCourseChapter(course, n, all))
          setStep("result")
        }
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  if (step === "lesson")
    return (
      <div className="flex flex-col gap-4">
        {lesson.map((p) => (
          <p key={p.slice(0, 40)} className="text-[15px] leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
        <button
          type="button"
          className="press mt-2 w-fit rounded-full bg-pax2-blue px-6 py-3 font-medium text-white"
          onClick={() => {
            startCourseChapter(course, n).catch(() => {})
            setStep("rounds")
          }}
        >
          Begin the exercise
        </button>
      </div>
    )
  if (step === "result" && shown) return <ResultView result={shown} next={next} />
  const done = rounds.filter((r) => r.id in answers).length
  return (
    <div className="flex flex-col gap-4">
      <span className="tabular text-xs text-slate-500">
        {Math.min(done + 1, rounds.length)} of {rounds.length}
      </span>
      {current ? <RoundView key={current.id} r={current} onAnswer={answer} pending={pending} /> : <p className="text-sm text-slate-600">Every round answered.</p>}
      {error && <p className="text-sm text-pax2-red-deep">{error}</p>}
    </div>
  )
}
