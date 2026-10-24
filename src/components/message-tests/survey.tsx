"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { beginSurvey, resumeVideo, submitStep, type Next } from "@/app/message-test-actions"
import { WatchGate } from "@/components/message-tests/watch-gate"
import { ABOUT, type PublicSurvey, type Step } from "@/lib/message-tests"
import { cn } from "@/ui/lib/utils"

// The respondent's side of a message test (lib/message-tests.ts): consent, the attention check, the
// background questions, the assigned video (Continue opens once 90% of it has played), the video check,
// the vote, the written explainer and the comprehension question, then the completion code or the
// panel's return link. Neutral dress: no sponsor, no product name, so nothing hints at the answer wanted.

const WATCH = 0.9
const ORDER: Step[] = ["consent", "attention", "about", "video", "check", "vote", "comprehension", "done"]

function Options({ options, value, onPick }: { options: string[]; value: number | null; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(i)}
          className={cn("rounded-xl border px-4 py-3 text-left text-[15px] leading-snug transition-colors", value === i ? "border-pax2-blue bg-pax2-lavender/60 text-slate-900" : "border-slate-300 bg-white text-slate-800 hover:border-slate-400")}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Survey({ testId, panel, preview }: { testId: string; panel: Record<string, string>; preview: boolean }) {
  const key = `mt:${testId}`
  const [state, setState] = React.useState<{ respId: string; survey: PublicSurvey; preview: boolean } | null | false>(null)
  const [step, setStep] = React.useState<Step>("consent")
  const [video, setVideo] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<number | null>(null)
  const [about, setAbout] = React.useState<Record<string, string>>({})
  const [watched, setWatched] = React.useState({ share: 0, seconds: 0 })
  const [end, setEnd] = React.useState<Next | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // One response per browser per test: a reload picks up where the respondent left off.
  React.useEffect(() => {
    const kept = sessionStorage.getItem(key)
    if (kept) {
      const k = JSON.parse(kept) as { respId: string; survey: PublicSurvey; preview: boolean; step: Step }
      setState(k)
      setStep(k.step)
      if (k.step === "video") resumeVideo(testId, k.respId).then(setVideo)
      return
    }
    beginSurvey(testId, panel, preview)
      .then((b) => {
        if (!b.open) return setState(false)
        setState(b)
        sessionStorage.setItem(key, JSON.stringify({ ...b, step: "consent" }))
      })
      .catch(() => setState(false))
  }, [key, testId, panel, preview])

  if (state === null) return <Loader2 className="mx-auto mt-24 size-6 animate-spin text-slate-400" />
  if (state === false) return <p className="mx-auto mt-24 max-w-sm text-center text-slate-600">This survey isn&apos;t open.</p>
  const s = state.survey

  const send = async (value: unknown) => {
    setBusy(true)
    setError(null)
    try {
      const n = await submitStep(testId, state.respId, step, value)
      sessionStorage.setItem(key, JSON.stringify({ ...state, step: n.step }))
      if (n.video) setVideo(n.video)
      if (n.step === "done" || n.step === "screened") setEnd(n)
      setPick(null)
      setStep(n.step)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const steps = ORDER.filter((x) => (x !== "check" || s.videoCheck) && (x !== "comprehension" || s.comprehension))
  const at = Math.max(0, steps.indexOf(step))
  const next = (ok: boolean, value: unknown, label = "Continue") => (
    <button type="button" disabled={!ok || busy} onClick={() => send(value)} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pax2-blue text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
      {busy && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  )

  let body: React.ReactNode
  if (step === "consent")
    body = (
      <>
        <h1 className="text-xl font-semibold text-slate-900">A short survey</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">It takes about five minutes. You&apos;ll answer a few questions about yourself, watch one short video, and answer questions about it.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">Your answers are anonymous and used only for research. You can stop at any time.</p>
        {next(true, true, "I agree, start")}
      </>
    )
  else if (step === "attention")
    body = (
      <>
        <p className="mb-4 text-[17px] leading-snug text-slate-900">{s.attention.question}</p>
        <Options options={s.attention.options} value={pick} onPick={setPick} />
        {next(pick != null, pick)}
      </>
    )
  else if (step === "about")
    body = (
      <>
        <h1 className="mb-5 text-xl font-semibold text-slate-900">About you</h1>
        <div className="flex flex-col gap-6">
          {ABOUT.map((q) => (
            <div key={q.key}>
              <p className="mb-2 text-[15px] font-medium text-slate-900">{q.question}</p>
              <Options options={q.options} value={about[q.key] ? q.options.indexOf(about[q.key]) : null} onPick={(i) => setAbout((a) => ({ ...a, [q.key]: q.options[i] }))} />
            </div>
          ))}
        </div>
        {next(ABOUT.every((q) => about[q.key]), about)}
      </>
    )
  else if (step === "video")
    body = (
      <>
        <p className="mb-4 text-[15px] text-slate-700">Watch the whole video. Continue opens when it&apos;s done.</p>
        {video ? <WatchGate videoId={video} onProgress={(share, seconds) => setWatched({ share, seconds })} /> : <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-pax2-light-blue transition-[width]" style={{ width: `${Math.round(Math.min(1, watched.share / WATCH) * 100)}%` }} />
        </div>
        {next(watched.share >= WATCH || state.preview, watched.seconds)}
      </>
    )
  else if (step === "check" && s.videoCheck)
    body = (
      <>
        <p className="mb-4 text-[17px] leading-snug text-slate-900">{s.videoCheck.question}</p>
        <Options options={s.videoCheck.options} value={pick} onPick={setPick} />
        {next(pick != null, pick)}
      </>
    )
  else if (step === "vote")
    body = (
      <>
        <p className="mb-4 text-[17px] leading-snug text-slate-900">{s.vote.question}</p>
        <Options options={s.vote.options} value={pick} onPick={setPick} />
        {next(pick != null, pick)}
      </>
    )
  else if (step === "comprehension" && s.comprehension)
    body = (
      <>
        <p className="mb-5 rounded-xl bg-slate-100 px-4 py-3 text-[15px] leading-relaxed text-slate-700">{s.comprehension.explainer}</p>
        <p className="mb-4 text-[17px] leading-snug text-slate-900">{s.comprehension.question}</p>
        <Options options={s.comprehension.options} value={pick} onPick={setPick} />
        {next(pick != null, pick, "Finish")}
      </>
    )
  else if (step === "screened")
    body = (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Thank you</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">This survey has ended for you.</p>
        {end?.url && (
          <a href={end.url} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-pax2-blue text-[15px] font-medium text-white">
            Return to the panel
          </a>
        )}
      </>
    )
  else
    body = (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Thank you</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">Your completion code:</p>
        <p className="tabular mt-2 rounded-xl bg-slate-100 px-4 py-3 text-center font-mono text-xl tracking-[0.2em] text-slate-900">{end?.code ?? "—"}</p>
        {end?.url && (
          <a href={end.url} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-pax2-blue text-[15px] font-medium text-white">
            Return to the panel
          </a>
        )}
      </>
    )

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {state.preview && <p className="mb-3 rounded-lg bg-amber-100 px-3 py-1.5 text-center text-xs font-medium text-amber-900">Preview: not counted</p>}
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-pax2-blue transition-[width]" style={{ width: `${Math.round(((step === "done" || step === "screened" ? steps.length : at) / steps.length) * 100)}%` }} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{body}</div>
        {error && <p className="mt-3 text-center text-sm text-pax2-red">{error}</p>}
      </div>
    </div>
  )
}
