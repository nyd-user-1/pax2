"use client"

import * as React from "react"
import { Check, Loader2, Pencil, Bookmark, Hammer, Sparkles } from "lucide-react"

import { callIt, decide, requestReading, type SavedReading } from "@/app/actions"
import { KindChip } from "@/components/bits"
import { At } from "@/components/workbench"
import type { Proposal, Reading } from "@/lib/pax"
import { Button } from "@/ui/components/nova/button"
import { Textarea } from "@/ui/components/nova/textarea"
import { cn } from "@/ui/lib/utils"

type Ev = { ref: string; label: string; t?: number }
type StepEv = { at: string; stepId: string; status: string; change: string; note?: string; findingAt: string }
type Call = { at: string; by: string; target: string; predicted: string; component: string; reason: string; baseline: number | null }

function Evidence({ refs, index }: { refs: string[]; index: Map<string, Ev> }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {refs.map((r) => {
        const e = index.get(r)
        if (!e) return null
        return (
          <span key={r} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {e.t != null && <At t={e.t} className="px-1 py-0 text-[10px]" />}
            <span className="truncate">{e.label}</span>
          </span>
        )
      })}
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = { approved: "Approved", revised: "Revised", saved: "Saved for later", made: "Made — a new take exists", proposed: "Proposed" }

function StepCard({ p, i, takeId, saved, events }: { p: Proposal; i: number; takeId: string; saved: SavedReading; events: StepEv[] }) {
  const stepId = `${saved.at}-${i}`
  const mine = events.filter((e) => e.stepId === stepId).sort((a, b) => a.at.localeCompare(b.at))
  const latest = mine.at(-1)
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(latest?.change ?? p.change)
  const [pending, start] = React.useTransition()
  const act = (status: "approved" | "revised" | "saved" | "made", change = text) =>
    start(() => decide({ takeId, stepId, status, change, prompted: p.prompted, uncertain: p.uncertain, measure: p.measure, snapshotId: saved.snapshotId, reference: saved.reference, findingAt: saved.at }))
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        {editing ? <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-16 text-sm" /> : <p className="font-medium leading-snug text-pax-ink">{latest?.change ?? p.change}</p>}
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", latest ? "bg-pax-plum text-white" : "bg-muted text-muted-foreground")}>{STATUS_LABEL[latest?.status ?? "proposed"]}</span>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">What prompted it</dt>
          <dd className="text-foreground/85">{p.prompted}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">What remains uncertain</dt>
          <dd className="text-foreground/85">{p.uncertain}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">How to tell</dt>
          <dd className="text-foreground/85">{p.measure}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <Button size="sm" disabled={pending} onClick={() => { setEditing(false); act("revised") }}>
            <Check className="size-3.5" /> Save revision
          </Button>
        ) : (
          <>
            <Button size="sm" disabled={pending} onClick={() => act("approved")}>
              <Check className="size-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Revise
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => act("saved")}>
              <Bookmark className="size-3.5" /> Save for later
            </Button>
            {latest?.status === "approved" || latest?.status === "revised" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("made")}>
                <Hammer className="size-3.5" /> Mark as made
              </Button>
            ) : null}
          </>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {mine.length > 0 && (
        <ol className="flex flex-col gap-0.5 border-t pt-2 text-[11px] text-muted-foreground">
          {mine.map((e) => (
            <li key={e.at}>
              {new Date(e.at).toLocaleString()} · {STATUS_LABEL[e.status]} · linked to score {saved.scoreValue?.toFixed(0) ?? "—"} ({saved.formula}, {saved.reference}), results as of {saved.snapshotId.split("~").pop()}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function ReadingPanel({ takeId, evidence, initial, events, calls, canRead, nextDataset, baseline, baselineSnapshot }: { takeId: string; evidence: Ev[]; initial: SavedReading | null; events: StepEv[]; calls: Call[]; canRead: boolean; nextDataset: string | null; baseline: number | null; baselineSnapshot: string }) {
  const [saved, setSaved] = React.useState<SavedReading | null>(initial)
  const [pending, start] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const index = React.useMemo(() => new Map(evidence.map((e) => [e.ref, e])), [evidence])
  const r: Reading | undefined = saved?.reading
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canRead || pending} onClick={() => start(async () => {
          setError(null)
          try {
            setSaved(await requestReading(takeId))
          } catch (e) {
            setError((e as Error).message)
          }
        })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {saved ? "Read the latest results again" : "Ask PAX for a reading"}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">Saved {new Date(saved.at).toLocaleString()} · {saved.formula} · {saved.reference} · results as of {saved.snapshotId.split("~").pop()}</span>}
        {!canRead && <span className="text-xs text-muted-foreground">Load results first.</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {r && (
        <>
          <div className="rounded-2xl bg-pax-ink p-5 text-white">
            <p className="font-display text-2xl leading-snug">{r.takeaway}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What happened</h3>
              <p className="mt-1 text-sm leading-relaxed">{r.whatHappened}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What the score means</h3>
              <p className="mt-1 text-sm leading-relaxed">{r.scoreMeaning}</p>
            </div>
          </div>

          {r.priorChecks?.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-pax-plum/30 bg-pax-mist p-4">
              <h3 className="text-sm font-medium text-pax-ink">The last review, checked against the new results</h3>
              {r.priorChecks.map((p, i) => (
                <div key={i} className="text-sm">
                  <span className={cn("mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium", p.status === "supported" ? "bg-observed/15 text-observed" : p.status === "challenged" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                    {p.status === "supported" ? "Supported" : p.status === "challenged" ? "Challenged" : "Unresolved"}
                  </span>
                  <span className="text-foreground/90">{p.finding}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.why}</p>
                  <Evidence refs={p.evidence} index={index} />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Evidence</h3>
            {(["observed", "interpretation", "hypothesis"] as const).map((k) =>
              r.findings
                .filter((f) => f.kind === k)
                .map((f, i) => (
                  <div key={`${k}${i}`} className="flex flex-col gap-1 border-l-2 pl-3" style={{ borderColor: `var(--pax-${k})` }}>
                    <div className="flex items-start gap-2">
                      <KindChip kind={f.kind} />
                      <p className="text-sm leading-snug">{f.text}</p>
                    </div>
                    <Evidence refs={f.evidence} index={index} />
                  </div>
                )),
            )}
            {r.dropped > 0 && <p className="text-[11px] text-muted-foreground">{r.dropped} statement{r.dropped > 1 ? "s" : ""} removed because {r.dropped > 1 ? "they" : "it"} cited no record.</p>}
          </div>

          {r.insufficient?.length > 0 && (
            <div className="rounded-xl bg-muted/60 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Not enough evidence yet — the next useful measurement</h3>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {r.insufficient.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-2xl text-pax-ink">Next test</h3>
            {r.nextSteps.map((p, i) => (
              <StepCard key={i} p={p} i={i} takeId={takeId} saved={saved!} events={events} />
            ))}
          </div>
        </>
      )}

      <CallIt takeId={takeId} calls={calls} nextDataset={nextDataset} baseline={baseline} baselineSnapshot={baselineSnapshot} />
    </div>
  )
}

/** Step 6: before the next results load, the partner and PAX each call it. Locked once logged. */
function CallIt({ takeId, calls, nextDataset, baseline, baselineSnapshot }: { takeId: string; calls: Call[]; nextDataset: string | null; baseline: number | null; baselineSnapshot: string }) {
  const [predicted, setPredicted] = React.useState<"higher" | "lower" | "same">("higher")
  const [reason, setReason] = React.useState("")
  const [msg, setMsg] = React.useState<string | null>(null)
  const [pending, start] = React.useTransition()
  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-white p-4">
      <div>
        <h3 className="font-display text-2xl text-pax-ink">Call it</h3>
        <p className="text-sm text-muted-foreground">Before the next results arrive, write down which way this take&apos;s score will move. The call is locked with a timestamp, and the next review shows who was right, so predictions build a track record instead of a slogan.</p>
      </div>
      {calls.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {calls.map((c) => (
            <li key={c.at} className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-pax-lavender px-1.5 text-[11px] font-medium text-pax-plum">Locked {new Date(c.at).toLocaleString()}</span>
              <span>
                {c.by}: {c.predicted} than {c.baseline?.toFixed(0) ?? "—"} by {c.target.replace("-", " ")}
              </span>
              <span className="text-xs text-muted-foreground">“{c.reason}”</span>
            </li>
          ))}
        </ul>
      )}
      {nextDataset ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1">
            {(["higher", "same", "lower"] as const).map((p) => (
              <Button key={p} size="sm" variant={predicted === p ? "default" : "outline"} onClick={() => setPredicted(p)}>
                {p === "same" ? "About the same" : p[0].toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? One line." className="min-h-8 flex-1 text-sm" />
          <Button size="sm" disabled={pending || !reason.trim()} onClick={() => start(async () => {
            const r = await callIt({ takeId, by: "Partner", target: nextDataset, predicted, component: "resonance", reason, baseline, baselineSnapshot })
            setMsg(r.ok ? "Locked." : r.reason)
            if (r.ok) setReason("")
          })}>
            Lock my call
          </Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Every round on file is already loaded; calls open again when a new round is expected.</p>
      )}
    </div>
  )
}
