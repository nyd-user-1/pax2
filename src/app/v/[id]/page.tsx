import Link from "next/link"
import { notFound } from "next/navigation"

import type { SavedReading } from "@/app/actions"
import { SourceBadge, StandInNote, ts } from "@/components/bits"
import { LoadButton } from "@/components/load-button"
import { ReadingPanel } from "@/components/reading-panel"
import { ScorePanel } from "@/components/score-panel"
import { Loudness, Observations, Player, ScriptTimeline, SeekProvider } from "@/components/workbench"
import { featuresFor, scriptById, takeById, takeLabel } from "@/lib/catalog"
import { evidenceIndex, type Reading } from "@/lib/pax"
import { board, DATASETS, findings, forecasts, loads, steps, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"

export default async function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const take = takeById(id)
  if (!take) notFound()
  const ws = await workspace()
  const script = scriptById(take.scriptId)!
  const [{ ref, takes }, fs, ev, calls, history] = await Promise.all([board(ws), findings(ws, id), steps(ws, id), forecasts(ws, id), loads(ws)])
  const state = takes.find((t) => t.take.id === id)!
  const f = featuresFor(id)
  const last = fs.at(-1)
  const initial: SavedReading | null = last ? { at: last.at, reading: last.finding as Reading, model: last.model, snapshotId: last.snapshotId, formula: last.formula, reference: last.reference, scoreValue: last.score.value } : null
  const loaded = new Set(history.map((h) => h.dataset))
  const nextDataset = DATASETS.find((d) => !loaded.has(d.id))?.id ?? null
  const siblings = takes.filter((t) => t.take.scriptId === take.scriptId && t.take.id !== id)

  return (
    <SeekProvider>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Link href="/" className="text-xs text-muted-foreground hover:text-pax-ink">← Arguments</Link>
          <h1 className="font-display text-3xl leading-tight text-pax-ink md:text-4xl">{script.title}</h1>
          <p className="text-sm text-muted-foreground">
            {takeLabel(take)} · {script.framing} · {take.durationSec.toFixed(0)} seconds
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <Player src={take.video!.src} poster={take.video!.poster} />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <SourceBadge source="stand-in" /> Synthetic reading of the library script
            </div>
            {f?.audio && !f.audio.error && <Loudness f={f.audio} />}
            {f?.transcript?.wpm && (
              <p className="text-xs text-muted-foreground">
                Pace {f.transcript.wpm} words a minute (teleprompter default 130) · first word at {ts(f.transcript.firstWordSec ?? 0)}
              </p>
            )}
            {siblings.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-3">
                <p className="text-xs text-muted-foreground">Same script, other takes</p>
                {siblings.map((s) => (
                  <Link key={s.take.id} href={`/v/${s.take.id}`} className="flex justify-between text-sm hover:text-pax-plum">
                    <span>{takeLabel(s.take)}</span>
                    <span className="tabular text-muted-foreground">{s.latest?.score.value?.toFixed(0) ?? "—"}</span>
                  </Link>
                ))}
              </div>
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-10">
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl text-pax-ink">The score</h2>
              {ref && state.latest ? (
                <ScorePanel take={take} snapshot={state.latest.snapshot} score={state.latest.score} reference={ref} />
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border bg-pax-mist p-4">
                  <p className="text-sm text-muted-foreground">No paid results are loaded for this take yet.</p>
                  {!ref && <LoadButton dataset="round-1" label="Load round 1 results" />}
                </div>
              )}
              {state.history.length > 1 && (
                <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Every saved score for this take, same formula, same frozen reference</p>
                  {state.history.map((h) => (
                    <div key={h.snapshot.id} className="tabular flex justify-between gap-2">
                      <span>
                        {h.snapshot.dataset} · {h.snapshot.windowStart} to {h.snapshot.windowEnd}
                      </span>
                      <span>
                        {h.score.value?.toFixed(0) ?? "Not scored"} {h.score.low != null && <span className="text-muted-foreground">({h.score.low.toFixed(0)}–{h.score.high!.toFixed(0)})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl text-pax-ink">PAX</h2>
              <ReadingPanel
                takeId={id}
                evidence={evidenceIndex(take, state, ref, takes)}
                initial={initial}
                events={ev.map((e) => ({ at: e.at, stepId: e.stepId, status: e.status, change: e.change, note: e.note, findingAt: e.findingAt }))}
                calls={calls.map((c) => ({ at: c.at, by: c.by, target: c.target, predicted: c.predicted, component: c.component, reason: c.reason, baseline: c.baseline }))}
                canRead={!!(ref && state.latest)}
                nextDataset={nextDataset}
                baseline={state.latest?.score.value ?? null}
                baselineSnapshot={state.latest?.snapshot.id ?? ""}
              />
            </section>

            <section className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-2xl text-pax-ink">What is said, and when</h2>
                {take.lines && <ScriptTimeline lines={take.lines} duration={take.durationSec} />}
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-2xl text-pax-ink">What is on screen</h2>
                {f ? <Observations f={f} /> : <p className="text-sm text-muted-foreground">The video review has not run on this take yet.</p>}
              </div>
            </section>

            <StandInNote />
          </div>
        </div>
      </div>
    </SeekProvider>
  )
}
