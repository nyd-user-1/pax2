import Link from "next/link"

import type { SavedReading } from "@/app/actions"
import { LoadButton } from "@/components/load-button"
import { ReadingPanel } from "@/components/reading-panel"
import { ScorePanel } from "@/components/score-panel"
import { Loudness, Observations, Player, ScriptTimeline, SeekProvider } from "@/components/workbench"
import { faceFor, featuresFor, scriptById, takeById, takeLabel } from "@/lib/catalog"
import { evidenceIndex, type Reading } from "@/lib/pax"
import { board, DATASETS, findings, forecasts, loads, steps, workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

function Fold({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-slate-900">
        {title}
        <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}

/** One take: the video, its number, PAX's read, and the detail a tap away. */
export async function TakeView({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const take = takeById(id)!
  const ws = await workspace()
  const script = scriptById(take.scriptId)!
  const [{ ref, takes }, fs, ev, calls, history] = await Promise.all([board(ws), findings(ws, id), steps(ws, id), forecasts(ws, id), loads(ws)])
  const state = takes.find((t) => t.take.id === id)!
  const f = featuresFor(id)
  const last = fs.at(-1)
  const initial: SavedReading | null = last ? { at: last.at, reading: last.finding as Reading, model: last.model, snapshotId: last.snapshotId, formula: last.formula, reference: last.reference, scoreValue: last.score.value } : null
  const loaded = new Set(history.map((h) => h.dataset))
  const nextDataset = DATASETS.find((d) => !loaded.has(d.id))?.id ?? null
  const m = state.latest?.snapshot.metrics
  const siblings = takes.filter((t) => t.take.scriptId === take.scriptId && t.take.id !== id)
  const stat = (label: string, v: string) => (
    <div className="flex flex-col">
      <span className="tabular text-lg font-semibold text-slate-900">{v}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )

  return (
    <SeekProvider>
      <div className={cn("grid gap-8", inDrawer ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[320px_1fr]")}>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <Player src={take.video!.src} poster={faceFor(take.voice, 640) ?? take.video!.poster} />
          {f?.audio && !f.audio.error && (
            <div className="surface p-4">
              <Loudness f={f.audio} />
            </div>
          )}
          {siblings.length > 0 && (
            <div className="surface flex flex-col gap-1 p-4">
              <p className="pb-1 text-xs font-medium text-slate-500">Comps</p>
              {siblings.map((x) => (
                <Link key={x.take.id} href={`/v/${x.take.id}`} scroll={false} replace={inDrawer} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span>{takeLabel(x.take)}</span>
                  <span className="tabular font-semibold text-slate-700">{x.latest?.score.value?.toFixed(0) ?? "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {!inDrawer && <h1 className="font-display text-2xl text-slate-900 md:text-[28px]">{script.short}</h1>}

          {m && (
            <div className="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {stat("Reach", (m.reach.value ?? 0).toLocaleString())}
              {stat("Watched 3s+", (m.plays3s.value ?? 0).toLocaleString())}
              {stat("Avg.", `${m.avgWatchSec.value?.toFixed(1) ?? "—"}s`)}
              {stat("Spend", `$${m.spend.value?.toFixed(0) ?? "—"}`)}
            </div>
          )}

          {!ref && (
            <div className="surface flex flex-col gap-3 p-5">
              <p className="text-slate-600">No paid results are loaded yet.</p>
              <LoadButton dataset="round-1" label="Load round 1" />
            </div>
          )}

          {ref && state.latest && (
            <Fold title="Rating">
              <ScorePanel take={take} snapshot={state.latest.snapshot} score={state.latest.score} reference={ref} />
            </Fold>
          )}
          <Fold title="Formula">{f ? <Observations f={f} /> : <p className="text-sm text-slate-500">The video review hasn&apos;t run on this take yet.</p>}</Fold>
          <Fold title="Transcript">{take.lines && <ScriptTimeline lines={take.lines} duration={take.durationSec} />}</Fold>

          <section className="surface p-5 md:p-6">
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

          {state.history.length > 1 && (
            <Fold title="Every round, same scale">
              <div className="flex flex-col gap-1 text-sm">
                {state.history.map((h) => (
                  <div key={h.snapshot.id} className="tabular flex justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                    <span>{h.snapshot.dataset === "round-1" ? "Round 1" : h.snapshot.dataset === "round-2" ? "Round 2" : "Upload"} · through {h.snapshot.windowEnd}</span>
                    <span>
                      {h.score.value?.toFixed(0) ?? "Not scored"} {h.score.low != null && <span className="text-slate-400">({h.score.low.toFixed(0)}–{h.score.high!.toFixed(0)})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Fold>
          )}
        </div>
      </div>
    </SeekProvider>
  )
}
