import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import type { SavedReading } from "@/app/actions"
import { callPaid, requestPaidReading } from "@/app/paid-actions"
import { ChartBlock, ListBlock, MainBlock, TableBlock, TwoThirdBlock } from "@/components/blocks"
import { PaidSeek, PaidTranscript, PaidVideo } from "@/components/paid/paid-video"
import { ReadingPanel } from "@/components/reading-panel"
import { ScorePanel } from "@/components/score-panel"
import { currentUser } from "@/lib/auth"
import { linesFor, pieceById, rankMoves, whatIf } from "@/lib/paid-analysis"
import { allStates, paidReference, pieceKey, pieceState } from "@/lib/paid-pieces"
import { evidenceIndex, type Reading } from "@/lib/pax2"
import { findings, forecasts, steps, workspace } from "@/lib/review"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: pieceById((await params).id)?.title ?? "Paid results" }
}

// One of the partner's paid videos through the review loop: the video and its caption lines, Paid
// Resonance 1 traced from the export's counts, version 2 beside it, what changes when an input changes,
// and PAX's reading with its findings, next steps, the partner's decisions and a forecast for the next
// export, all saved under paid-<YouTube id> as the take pages save a take's.
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")

export default async function PaidPiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await currentUser())) redirect(`/signin?next=/paid/${id}`)
  const p = pieceById(id)
  if (!p) notFound()
  const ws = await workspace()
  const key = pieceKey(p.id)
  const state = pieceState(p)
  const ref = paidReference()
  const [found, ev, calls] = await Promise.all([findings(ws, key), steps(ws, key), forecasts(ws, key)])
  const last = found.at(-1)
  const initial: SavedReading | null = last ? { at: last.at, reading: last.finding as Reading, model: last.model, snapshotId: last.snapshotId, formula: last.formula, reference: last.reference, scoreValue: last.score.value } : null
  const w = whatIf(p.id)
  const move = rankMoves((x) => x.v2)[p.id]
  const t = linesFor(p.id)
  const r = (x: number | null) => (x == null ? "—" : Math.round(x).toString())
  return (
    <PaidSeek>
      <div className="flex flex-col gap-6">
        <Link href="/paid" className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-pax2-blue">
          <ArrowLeft className="size-4" /> Paid results
        </Link>
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-slate-900 md:text-[28px]">{p.title}</h1>
          <p className="tabular text-sm text-slate-500">
            Reported {p.window} · ${Math.round(p.totals.spend).toLocaleString()} · {p.totals.impressions.toLocaleString()} impressions · {p.counted.map((c) => `${c.id}${c.cut === "edit" ? " (edit)" : ""}`).join(", ")}
            {p.excluded.length > 0 && ` · not counted: ${p.excluded.map((c) => `${c.id} (${c.cut})`).join(", ")}`}
          </p>
        </header>

        <TwoThirdBlock>
          <ChartBlock title="Paid Resonance 1" className="xl:col-span-2" rows={p.v1.components.map((c) => ({ component: c.key, rate: c.rate, weighted: c.shrunk, score: c.score, weight: c.weight }))} name={`paid-resonance-1-${p.id}`}>
            <div className="flex flex-col gap-5">
              <p className="text-xs text-slate-500">From the partner's export: starts stand in for 3-second plays, average watch is estimated from the reported depth points, and the export records no reach, shares, saves or comments.</p>
              <ScorePanel part="summary" take={state.take} snapshot={state.latest!.snapshot} score={p.v1} reference={ref} />
              <ScorePanel part="detail" take={state.take} snapshot={state.latest!.snapshot} score={p.v1} reference={ref} />
            </div>
          </ChartBlock>
          <div className="flex flex-col gap-4">
            <PaidVideo id={p.id} title={p.title} />
            <ChartBlock title="Paid Resonance 2" small rows={[{ version_1: p.v1.value, version_2: p.v2.value, window: p.window, cohort: p.cohort, observed_starts: p.observedStarts, expected_starts: p.expectedStarts }]} name={`paid-resonance-2-${p.id}`}>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-baseline gap-3">
                  <span className="tabular font-display text-4xl text-pax2-blue">{r(p.v2.value)}</span>
                  <span className="text-slate-500">
                    version 1 {r(p.v1.value)} · {move ? `${signed(move)} rank` : "same rank"}
                  </span>
                </div>
                <p className="text-slate-700">
                  Against the {p.cohort} videos reported {p.window}
                  {p.cohort < 6 && p.sets.length === 1 ? `, all from ad set ${p.sets[0]}, so window and ad set cannot be told apart` : ""}.
                </p>
                <p className="text-slate-700">
                  Starts restated at the batch's delivery mix: {p.observedStarts.toLocaleString()} observed against {Math.round(p.expectedStarts).toLocaleString()} expected from who it was shown to.
                </p>
              </div>
            </ChartBlock>
          </div>
        </TwoThirdBlock>

        <TableBlock title="What if" rows={w.cases.map((c) => ({ change: c.label, score: c.s.value, low: c.s.low, high: c.s.high }))} name={`paid-what-if-${p.id}`}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Change</TableHead>
                <TableHead className="text-right">Paid Resonance 1</TableHead>
                <TableHead className="text-right">Range</TableHead>
                <TableHead className="text-right">Change in score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-slate-900">As reported</TableCell>
                <TableCell className="tabular text-right">{w.base.value?.toFixed(1)}</TableCell>
                <TableCell className="tabular text-right text-slate-500">{r(w.base.low)}–{r(w.base.high)}</TableCell>
                <TableCell className="text-right text-slate-400">—</TableCell>
              </TableRow>
              {w.cases.map((c) => (
                <TableRow key={c.label}>
                  <TableCell className="text-slate-800">{c.label}</TableCell>
                  <TableCell className="tabular text-right">{c.s.value?.toFixed(1)}</TableCell>
                  <TableCell className="tabular text-right text-slate-500">{r(c.s.low)}–{r(c.s.high)}</TableCell>
                  <TableCell className="tabular text-right font-medium">{((c.s.value ?? 0) - (w.base.value ?? 0) >= 0 ? "+" : "−") + Math.abs((c.s.value ?? 0) - (w.base.value ?? 0)).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>

        <ListBlock title="Transcript" search={t.lines.length ? "Search the transcript…" : undefined}>
          <PaidTranscript lines={t.lines} error={t.error} />
        </ListBlock>

        <MainBlock title="PAX" id="pax" height="h-auto">
          <ReadingPanel
            takeId={key}
            reader={requestPaidReading}
            caller={callPaid}
            refresh
            evidence={evidenceIndex(state.take, state, ref, allStates())}
            initial={initial}
            events={ev.map((e) => ({ at: e.at, stepId: e.stepId, status: e.status, change: e.change, note: e.note, findingAt: e.findingAt }))}
            calls={calls.map((c) => ({ at: c.at, by: c.by, target: c.target, predicted: c.predicted, component: c.component, reason: c.reason, baseline: c.baseline }))}
            canRead
            nextDataset="the next export"
            baseline={p.v1.value}
            baselineSnapshot={state.latest!.snapshot.id}
          />
        </MainBlock>
      </div>
    </PaidSeek>
  )
}
