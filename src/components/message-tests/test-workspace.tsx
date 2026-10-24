"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"

import { saveTest } from "@/app/message-test-actions"
import { MainBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { ResultsTable } from "@/components/message-tests/results-table"
import { analyze, simulate } from "@/lib/message-test-stats"
import { type Arm, type MessageTest, type Response } from "@/lib/message-tests"
import { cn } from "@/ui/lib/utils"

// One message test for its researcher (an admin): Setup (the videos, the questions, the panel links),
// Monitor (who has started, been screened out, finished, per video), Results (the lifts once responses
// arrive) and Simulation (planted lifts run through the same analysis, to check it before paying anyone).

const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-pax2-blue"
const LABEL = "flex flex-col gap-1.5 text-xs font-medium text-slate-600"
const toLines = (a: string[]) => a.join("\n")
const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function CopyLink({ label, url }: { label: string; url: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <div className={LABEL}>
      {label}
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">{url}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url)
            setDone(true)
            setTimeout(() => setDone(false), 1500)
          }}
          className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={`Copy ${label}`}
        >
          {done ? <Check className="size-4 text-above" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}

function Setup({ test, onSaved }: { test: MessageTest; onSaved: (t: MessageTest) => void }) {
  const [t, setT] = React.useState(test)
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | string>("idle")
  const [origin, setOrigin] = React.useState("")
  React.useEffect(() => setOrigin(window.location.origin), [])
  const set = (patch: Partial<MessageTest>) => {
    setT((x) => ({ ...x, ...patch }))
    setState("idle")
  }
  const setArm = (i: number, patch: Partial<Arm>) => set({ arms: t.arms.map((a, j) => (j === i ? { ...a, ...patch } : patch.placebo ? { ...a, placebo: false } : a)) })
  const save = async () => {
    setState("saving")
    try {
      const next = await saveTest(t)
      setT(next)
      onSaved(next)
      setState("saved")
    } catch (e) {
      setState((e as Error).message)
    }
  }
  const checkOptions = t.videoCheck?.options ?? []
  return (
    <div className="flex flex-col gap-5">
      <Section title="Test">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            Name
            <input className={INPUT} value={t.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className={LABEL}>
            Measure
            <input className={INPUT} value={t.measure} onChange={(e) => set({ measure: e.target.value })} />
          </label>
          <label className={LABEL}>
            Respondents per video
            <input className={INPUT} type="number" min={10} value={t.perArm} onChange={(e) => set({ perArm: Number(e.target.value) })} />
          </label>
          <label className={LABEL}>
            Confidence
            <select className={INPUT} value={t.confidence} onChange={(e) => set({ confidence: Number(e.target.value) === 95 ? 95 : 90 })}>
              <option value={90}>90%</option>
              <option value={95}>95%</option>
            </select>
          </label>
        </div>
        <div className="flex gap-1.5">
          {(["draft", "live", "closed"] as const).map((s) => (
            <button key={s} type="button" onClick={() => set({ status: s })} className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize", t.status === s ? "bg-pax2-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Videos">
        <div className="flex flex-col gap-2">
          {t.arms.map((a, i) => (
            <div key={a.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1.3fr_1fr_auto_auto]">
              <label className={LABEL}>
                {a.placebo ? "Placebo" : `Video ${t.arms.slice(0, i + 1).filter((x) => !x.placebo).length}`}
                <input className={INPUT} value={a.label} onChange={(e) => setArm(i, { label: e.target.value })} />
              </label>
              <label className={LABEL}>
                YouTube link or id
                <input className={INPUT} value={a.youtube} onChange={(e) => setArm(i, { youtube: e.target.value })} placeholder="https://youtube.com/shorts/…" />
              </label>
              <label className={LABEL}>
                Correct video check
                <select className={INPUT} value={a.check ?? ""} onChange={(e) => setArm(i, { check: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">Not scored</option>
                  {checkOptions.map((o, j) => (
                    <option key={j} value={j}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex h-9 items-center gap-1.5 text-xs text-slate-600">
                <input type="radio" name="placebo" checked={a.placebo} onChange={() => setArm(i, { placebo: true })} />
                Placebo
              </label>
              <button type="button" onClick={() => set({ arms: t.arms.filter((_, j) => j !== i) })} disabled={t.arms.length <= 1} aria-label="Remove" className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-pax2-red disabled:opacity-30">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set({ arms: [...t.arms, { id: `arm-${Math.random().toString(36).slice(2, 7)}`, label: "", youtube: "", placebo: false, check: t.videoCheck ? 0 : null }] })} className="flex w-fit items-center gap-1.5 text-sm font-medium text-pax2-blue hover:underline">
          <Plus className="size-4" /> Add a video
        </button>
      </Section>

      <Section title="Attention check">
        <label className={LABEL}>
          Question
          <textarea className={INPUT} rows={2} value={t.attention.question} onChange={(e) => set({ attention: { ...t.attention, question: e.target.value } })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className={LABEL}>
            Options, one per line
            <textarea className={INPUT} rows={5} value={toLines(t.attention.options)} onChange={(e) => set({ attention: { ...t.attention, options: fromLines(e.target.value) } })} />
          </label>
          <label className={LABEL}>
            Correct answer
            <select className={INPUT} value={t.attention.answer} onChange={(e) => set({ attention: { ...t.attention, answer: Number(e.target.value) } })}>
              {t.attention.options.map((o, j) => (
                <option key={j} value={j}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Video check">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={!!t.videoCheck} onChange={(e) => set({ videoCheck: e.target.checked ? { question: "Which of these was the video you just watched mainly about?", options: ["", "", "", ""] } : null })} />
          Ask after the video
        </label>
        {t.videoCheck && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Question
              <textarea className={INPUT} rows={3} value={t.videoCheck.question} onChange={(e) => set({ videoCheck: { ...t.videoCheck!, question: e.target.value } })} />
            </label>
            <label className={LABEL}>
              Options, one per line
              <textarea className={INPUT} rows={4} value={toLines(t.videoCheck.options)} onChange={(e) => set({ videoCheck: { ...t.videoCheck!, options: fromLines(e.target.value) } })} />
            </label>
          </div>
        )}
      </Section>

      <Section title="Vote">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className={LABEL}>
            Question
            <textarea className={INPUT} rows={2} value={t.vote.question} onChange={(e) => set({ vote: { ...t.vote, question: e.target.value } })} />
          </label>
          <label className={LABEL}>
            Options, one per line
            <textarea className={INPUT} rows={3} value={toLines(t.vote.options)} onChange={(e) => set({ vote: { ...t.vote, options: fromLines(e.target.value), yes: t.vote.yes.filter((y) => y < fromLines(e.target.value).length) } })} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          Counts as support:
          {t.vote.options.map((o, j) => (
            <label key={j} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={t.vote.yes.includes(j)} onChange={(e) => set({ vote: { ...t.vote, yes: e.target.checked ? [...t.vote.yes, j] : t.vote.yes.filter((y) => y !== j) } })} />
              {o}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Comprehension">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={!!t.comprehension} onChange={(e) => set({ comprehension: e.target.checked ? { explainer: "", question: "", options: ["", ""], answer: 0 } : null })} />
          Ask after the vote, every respondent reading the same explainer first
        </label>
        {t.comprehension && (
          <>
            <label className={LABEL}>
              Explainer
              <textarea className={INPUT} rows={3} value={t.comprehension.explainer} onChange={(e) => set({ comprehension: { ...t.comprehension!, explainer: e.target.value } })} />
            </label>
            <label className={LABEL}>
              Question
              <textarea className={INPUT} rows={2} value={t.comprehension.question} onChange={(e) => set({ comprehension: { ...t.comprehension!, question: e.target.value } })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <label className={LABEL}>
                Options, one per line
                <textarea className={INPUT} rows={4} value={toLines(t.comprehension.options)} onChange={(e) => set({ comprehension: { ...t.comprehension!, options: fromLines(e.target.value) } })} />
              </label>
              <label className={LABEL}>
                Correct answer
                <select className={INPUT} value={t.comprehension.answer} onChange={(e) => set({ comprehension: { ...t.comprehension!, answer: Number(e.target.value) } })}>
                  {t.comprehension.options.map((o, j) => (
                    <option key={j} value={j}>
                      {o.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </Section>

      <Section title="Panel">
        <CopyLink label="Respondent link" url={`${origin}/t/${t.id}`} />
        <CopyLink label="Preview, not counted" url={`${origin}/t/${t.id}?preview=1`} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={LABEL}>
            Completion code
            <input className={cn(INPUT, "bg-slate-50 font-mono")} value={t.completion.code} readOnly />
          </label>
          <label className={LABEL}>
            Return link on completion
            <input className={INPUT} value={t.completion.url} onChange={(e) => set({ completion: { ...t.completion, url: e.target.value } })} placeholder="https://app.prolific.com/submissions/complete?cc={code}" />
          </label>
          <label className={LABEL}>
            Return link when screened out
            <input className={INPUT} value={t.completion.screenUrl} onChange={(e) => set({ completion: { ...t.completion, screenUrl: e.target.value } })} />
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === "saving"} className="flex h-10 items-center gap-2 rounded-xl bg-pax2-blue px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {state === "saving" && <Loader2 className="size-4 animate-spin" />}
          Save
        </button>
        {state === "saved" && <span className="flex items-center gap-1 text-sm text-slate-600"><Check className="size-4 text-above" /> Saved</span>}
        {!["idle", "saving", "saved"].includes(state) && <span className="text-sm text-pax2-red">{state}</span>}
      </div>
    </div>
  )
}

const STEP_LABEL: Record<string, string> = { consent: "Consent", attention: "Attention check", about: "About you", video: "Video", check: "Video check", vote: "Vote", comprehension: "Comprehension" }

function Monitor({ test, responses }: { test: MessageTest; responses: Response[] }) {
  const router = useRouter()
  const real = responses.filter((r) => !r.preview)
  const done = real.filter((r) => r.step === "done")
  const screened = real.filter((r) => r.step === "screened").length
  const open = real.filter((r) => r.step !== "done" && r.step !== "screened")
  const byStep = Object.entries(STEP_LABEL)
    .map(([k, label]) => ({ label, n: open.filter((r) => r.step === k).length }))
    .filter((x) => x.n)
  const balance = ["party", "vote2024"] as const
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <span>
          <span className="tabular text-2xl font-semibold text-slate-900">{real.length}</span> <span className="text-slate-500">started</span>
        </span>
        <span>
          <span className="tabular text-2xl font-semibold text-slate-900">{done.length}</span> <span className="text-slate-500">finished</span>
        </span>
        <span>
          <span className="tabular text-2xl font-semibold text-slate-900">{screened}</span> <span className="text-slate-500">screened out</span>
        </span>
        <span>
          <span className="tabular text-2xl font-semibold text-slate-900">{open.length}</span> <span className="text-slate-500">in progress or left</span>
        </span>
        <button type="button" onClick={() => router.refresh()} className="ml-auto flex items-center gap-1.5 text-sm text-slate-600 hover:text-pax2-blue">
          <RefreshCw className="size-4" /> Refresh
        </button>
      </div>
      {byStep.length > 0 && <p className="text-sm text-slate-600">Last step reached by those not finished: {byStep.map((x) => `${x.label} ${x.n}`).join(" · ")}</p>}
      <table className="w-full border-collapse">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Video</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Assigned</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Finished of {test.perArm}</th>
            {balance.map((k) => (
              <th key={k} className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                {k === "party" ? "Democrat · Independent · Republican" : "Harris · Trump · other · didn't vote"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {test.arms.map((a) => {
            const fin = done.filter((r) => r.arm === a.id)
            const mix = (key: string, opts: string[]) => (fin.length ? opts.map((o) => `${Math.round((fin.filter((r) => r.about[key] === o).length / fin.length) * 100)}%`).join(" · ") : "—")
            return (
              <tr key={a.id}>
                <td className="px-3 py-2 text-sm text-slate-800">{a.label}</td>
                <td className="tabular px-3 py-2 text-sm text-slate-800">{real.filter((r) => r.arm === a.id).length}</td>
                <td className="tabular px-3 py-2 text-sm text-slate-800">{fin.length}</td>
                <td className="tabular px-3 py-2 text-sm text-slate-600">{mix("party", ["Democrat", "Independent or other", "Republican"])}</td>
                <td className="tabular px-3 py-2 text-sm text-slate-600">{mix("vote2024", ["Kamala Harris", "Donald Trump", "Someone else", "I did not vote"])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Simulation({ test }: { test: MessageTest }) {
  const videos = test.arms.filter((a) => !a.placebo)
  const [planted, setPlanted] = React.useState<Record<string, number>>(() => Object.fromEntries(videos.map((a, i) => [a.id, [4, 2, 0, 6, 1, 3][i % 6]])))
  const [seed, setSeed] = React.useState(7)
  const [run, setRun] = React.useState<{ planted: Record<string, number>; seed: number } | null>(null)
  const results = React.useMemo(() => (run ? analyze(test, simulate(test, run.planted, run.seed)) : null), [run, test])
  if (!videos.length || !test.arms.some((a) => a.placebo)) return <p className="text-sm text-slate-600">Add a placebo and at least one video to simulate.</p>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {videos.map((a) => (
          <label key={a.id} className={LABEL}>
            {a.label || "Video"}, planted lift (points)
            <input className={cn(INPUT, "w-40")} type="number" step={0.5} value={planted[a.id] ?? 0} onChange={(e) => setPlanted((p) => ({ ...p, [a.id]: Number(e.target.value) }))} />
          </label>
        ))}
        <label className={LABEL}>
          Seed
          <input className={cn(INPUT, "w-24")} type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
        <button type="button" onClick={() => setRun({ planted: { ...planted }, seed })} className="flex h-9 items-center rounded-xl bg-pax2-blue px-4 text-sm font-medium text-white hover:opacity-90">
          Simulate {test.perArm * test.arms.length} respondents
        </button>
      </div>
      {results && <ResultsTable results={results} planted={run!.planted} />}
    </div>
  )
}

export function TestWorkspace({ test: initial, responses }: { test: MessageTest; responses: Response[] }) {
  const [test, setTest] = React.useState(initial)
  const results = React.useMemo(() => analyze(test, responses), [test, responses])
  return (
    <BlockOrder page={`message-test-${test.id}`} initial={["setup", "monitor", "results", "simulation"]}>
      <OrderedBlock id="setup" label="Setup">
        <MainBlock title={test.name} id="setup">
          <Setup test={test} onSaved={setTest} />
        </MainBlock>
      </OrderedBlock>
      <OrderedBlock id="monitor" label="Monitor">
        <MainBlock title="Monitor" id="monitor">
          <Monitor test={test} responses={responses} />
        </MainBlock>
      </OrderedBlock>
      <OrderedBlock id="results" label="Results">
        <MainBlock title="Results" id="results">
          {results.counts.complete ? <ResultsTable results={results} /> : <p className="text-sm text-slate-600">No finished responses yet.</p>}
        </MainBlock>
      </OrderedBlock>
      <OrderedBlock id="simulation" label="Simulation">
        <MainBlock title="Simulation" id="simulation">
          <Simulation test={test} />
        </MainBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
