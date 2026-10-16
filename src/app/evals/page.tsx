import Link from "next/link"

import { StandInNote } from "@/components/bits"
import { CardBlock, ChartBlock, ListBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { LoadData } from "@/components/load-data"
import { SlopeChart } from "@/components/charts/slope"
import { faceFor, scriptById, takeLabel } from "@/lib/catalog"
import { SAMPLE_CALLS, SAMPLE_DECISIONS, SAMPLE_SENT } from "@/lib/sample"
import { toneOf } from "@/lib/tone"
import type { Reading } from "@/lib/pax2"
import { COMPONENTS } from "@/lib/resonance"
import { board, findings, forecasts, loads, steps, submissions, workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Evals" }

type Side = "above" | "below" | "unclear"
const side = (low: number, high: number): Side => (low > 50 ? "above" : high < 50 ? "below" : "unclear")
const SIDE: Record<Side, string> = { above: "above the reference average", below: "below the reference average", unclear: "not distinguishable from average" }

export default async function ReviewsPage() {
  const ws = await workspace()
  const [{ ref, takes }, history, sent] = await Promise.all([board(ws), loads(ws), submissions(ws)])
  const perTake = await Promise.all(takes.map(async (t) => ({ t, fs: await findings(ws, t.take.id), ev: await steps(ws, t.take.id), calls: await forecasts(ws, t.take.id) })))
  const loaded = new Set(history.map((h) => h.dataset))
  const r2 = loaded.has("round-2")

  // What the partner carries forward: the latest decision on every proposed step, and open hypotheses.
  const carried = perTake.flatMap(({ t, ev, fs }) => {
    const byStep = new Map<string, (typeof ev)[number]>()
    for (const e of ev.sort((a, b) => a.at.localeCompare(b.at))) byStep.set(e.stepId, e)
    const hyps = (fs.at(-1)?.finding as Reading | undefined)?.findings.filter((f) => f.kind === "hypothesis") ?? []
    return [...byStep.values()].map((e) => ({ t, e, hyps, finding: fs.find((f) => f.at === e.findingAt) }))
  })

  const changes = takes
    .filter((t) => t.history.length >= 2)
    .map((t) => {
      const a = t.history.at(-2)!
      const b = t.history.at(-1)!
      return { t, a, b }
    })

  const resolved = perTake.flatMap(({ t, calls }) =>
    calls.map((c) => {
      const after = t.history.find((h) => h.snapshot.dataset === c.target)
      if (!after || after.score.value == null || c.baseline == null) return { t, c, actual: null as null | string, right: null as null | boolean }
      const d = after.score.value - c.baseline
      const actual = d > 2 ? "higher" : d < -2 ? "lower" : "same"
      return { t, c, actual, right: actual === c.predicted, delta: d }
    }),
  )

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">Every test the partner approved, every call made before results came in, and what each new round of results changed.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">Results on file</h2>
        <ol className="flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.fileHash} className="flex flex-wrap items-baseline justify-between gap-2 surface px-4 py-2 text-sm">
              <span className="font-medium text-pax2-blue">{h.dataset === "upload" ? "Uploaded export" : h.dataset === "round-1" ? "Round 1" : "Round 2"}</span>
              <span className="text-muted-foreground" title={`File fingerprint ${h.fileHash}`}>
                {h.rows} ads · results as of {h.asOf} · loaded {new Date(h.at).toLocaleString()}
              </span>
            </li>
          ))}
          {!history.length && <li className="text-sm text-muted-foreground">Nothing loaded yet.</li>}
        </ol>
        <LoadData standIn={!loaded.has("round-1") ? "round-1" : !r2 ? "round-2" : undefined} />
      </section>

      <BlockOrder page="evals" initial={r2 ? ["sent", "carried", "changes", "takes", "calls"] : ["sent", "carried", "calls"]}>
        <OrderedBlock id="sent" label="Sent by volunteers">
          <ListBlock title="Sent by volunteers" tools={sent.length === 0 && SAMPLE_CHIP}>
        {sent.length === 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {SAMPLE_SENT.map((s, i) => (
              <li key={i} data-find className="surface flex items-center gap-4 px-4 py-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceFor(["Ruth", "Stephen", "Danielle"][i % 3], 120)} alt="" className="h-14 w-10 shrink-0 rounded-lg object-cover" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium text-slate-900">{s.title}</span>
                  <span className="text-xs text-slate-500">
                    {s.name}, {s.role}, {s.town} · {s.seconds}s · {new Date(s.at).toLocaleDateString()}
                  </span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", s.status === "scored" ? "bg-above-soft text-above" : s.status === "running" ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-600")}>{s.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {sent.map((s) => (
              <li key={s.sk} data-find className="flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm">
                <span className="font-medium text-pax2-blue">{s.title ?? "Uploaded video"}</span>
                <span className="text-xs text-muted-foreground">
                  {[s.name, s.role, s.town].filter(Boolean).join(" · ") || "No description"} · {s.seconds}s · sent {new Date(s.at).toLocaleString()}
                </span>
                <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
          </ListBlock>
        </OrderedBlock>

        <OrderedBlock id="carried" label="What the partner carries into this review">
          <CardBlock title="What the partner carries into this review" tools={carried.length === 0 && SAMPLE_CHIP}>
        {carried.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {SAMPLE_DECISIONS.map((d) => {
              const t = takes.find((x) => x.take.id === d.take)!
              return (
                <Link key={d.take} data-find href={`/v/${d.take}`} scroll={false} className="surface lift flex flex-col gap-1.5 p-4">
                  <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    {scriptById(t.take.scriptId)!.short} · {takeLabel(t.take)}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.status === "made" ? "bg-above text-white" : d.status === "approved" ? "bg-pax2-blue text-white" : d.status === "revised" ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-600")}>{d.status}</span>
                  </span>
                  <span className="font-medium leading-snug text-slate-900">{d.change}</span>
                  <span className="text-xs text-slate-500">How to tell: {d.measure}</span>
                  <span className="text-[11px] text-slate-400">Decided {new Date(d.at).toLocaleDateString()} against a score of {d.score}</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {carried.map(({ t, e, finding }) => (
              <Link key={e.stepId} data-find href={`/v/${t.take.id}`} className="flex flex-col gap-1 surface p-4 hover:bg-pax2-mist">
                <span className="text-xs text-muted-foreground">
                  {scriptById(t.take.scriptId)!.title} — {takeLabel(t.take)}
                </span>
                <span className="font-medium text-pax2-blue">{e.change}</span>
                <span className="text-xs text-muted-foreground">
                  {e.status === "made" ? "Made" : e.status === "approved" ? "Approved, not yet made" : e.status === "revised" ? "Revised, not yet made" : "Saved for later"} · decided {new Date(e.at).toLocaleDateString()} against score {finding?.score.value?.toFixed(0) ?? "—"} ({e.formula}, {e.reference})
                </span>
                {e.measure && <span className="text-xs text-foreground/80">How to tell: {e.measure}</span>}
                {e.status !== "made" && <span className="text-[11px] text-pax2-red-deep">A later score on this take updates what is known about it; it says nothing about the change until the change is made and measured.</span>}
              </Link>
            ))}
          </div>
        )}
          </CardBlock>
        </OrderedBlock>

      {r2 && (
        <OrderedBlock id="changes" label="What changed with the later results">
          <ChartBlock title="What changed with the later results">
          <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Same formula ({"resonance-1"}), same reference ({ref?.id}). “The score changed” means the number moved. “The conclusion changed” means the take moved across the line: above, below, or not distinguishable from the reference average.
          </p>
          <SlopeChart
            rows={takes.map((t) => {
              const a = t.history.find((h) => h.snapshot.dataset === "round-1")?.score
              const b = t.history.find((h) => h.snapshot.dataset === "round-2")?.score
              return { id: t.take.id, label: `${scriptById(t.take.scriptId)!.short} · ${takeLabel(t.take)}`, a: a?.value ?? null, b: b?.value ?? null, tone: toneOf(b?.low, b?.high) }
            })}
          />
          {takes.some((t) => t.history.length === 1 && t.history[0].snapshot.dataset === "round-2") && (
            <div className="rounded-xl border border-pax2-light-blue/30 bg-pax2-mist p-4 text-sm">
              <p className="font-medium text-pax2-blue">New in this round</p>
              {takes
                .filter((t) => t.history.length === 1 && t.history[0].snapshot.dataset === "round-2")
                .map((t) => {
                  const twin = takes.find((x) => x.take.scriptId === t.take.scriptId && x.take.voice === t.take.voice && x.take.id !== t.take.id && !x.take.cut && x.take.captions)
                  const v = t.latest!.score
                  const w = twin?.latest?.score
                  const separate = w && v.low! > w.high! ? "clearly higher" : w && v.high! < w.low! ? "clearly lower" : "not separable yet"
                  return (
                    <p key={t.take.id} className="mt-1">
                      <Link href={`/v/${t.take.id}`} className="underline">
                        {takeLabel(t.take)}
                      </Link>{" "}
                      scored {v.value?.toFixed(0)} ({v.low?.toFixed(0)}–{v.high?.toFixed(0)}) against its full-length twin&apos;s {w?.value?.toFixed(0)} ({w?.low?.toFixed(0)}–{w?.high?.toFixed(0)}): {separate}. It ran a shorter, later window, so treat this as the first measurement of the change, not its verdict.
                    </p>
                  )
                })}
            </div>
          )}
          </div>
          </ChartBlock>
        </OrderedBlock>
      )}

      {r2 && (
        <OrderedBlock id="takes" label="Every take, component by component">
          <TableBlock
            title="Every take, component by component"
            id="takes"
            search="Search takes…"
            rows={changes.map(({ t, a, b }) => ({ take: `${scriptById(t.take.scriptId)!.title} · ${takeLabel(t.take)}`, round1: a.score.value?.toFixed(0) ?? "", round2: b.score.value?.toFixed(0) ?? "" }))}
            name="takes"
          >
            <table className="tabular w-full min-w-[760px] text-sm">
              <thead className="text-left">
                <tr className="bg-muted/60 [&_th]:h-10 [&_th]:px-2 [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-foreground">
                  <th>Take</th>
                  <th>Round 1</th>
                  <th>Round 2</th>
                  <th>Change</th>
                  {COMPONENTS.map((c) => (
                    <th key={c.key}>{c.name}</th>
                  ))}
                  <th>Reading</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:p-2 [&_td]:align-top [&_td:nth-child(n+2):nth-child(-n+7)]:whitespace-nowrap">
                {changes.map(({ t, a, b }) => {
                  const va = a.score.value
                  const vb = b.score.value
                  const sa = va != null ? side(a.score.low!, a.score.high!) : null
                  const sb = vb != null ? side(b.score.low!, b.score.high!) : null
                  const conclusion = sa && sb && sa !== sb
                  return (
                    <tr key={t.take.id}>
                      <td>
                        <Link href={`/v/${t.take.id}`} className="hover:underline">
                          {scriptById(t.take.scriptId)!.title.slice(0, 34)}… · {takeLabel(t.take)}
                        </Link>
                      </td>
                      <td>{va != null ? `${va.toFixed(0)} (${a.score.low!.toFixed(0)}–${a.score.high!.toFixed(0)})` : "Not scored"}</td>
                      <td>{vb != null ? `${vb.toFixed(0)} (${b.score.low!.toFixed(0)}–${b.score.high!.toFixed(0)})` : "Not scored"}</td>
                      <td className={cn(va != null && vb != null && (vb - va > 0 ? "text-observed" : "text-destructive"))}>{va != null && vb != null ? `${vb - va >= 0 ? "+" : ""}${(vb - va).toFixed(1)}` : va == null && vb != null ? "Now scorable" : "—"}</td>
                      {COMPONENTS.map((c) => {
                        const ca = a.score.components.find((x) => x.key === c.key)?.score
                        const cb = b.score.components.find((x) => x.key === c.key)?.score
                        return <td key={c.key}>{ca != null && cb != null ? `${cb - ca >= 0 ? "+" : ""}${(cb - ca).toFixed(0)}` : "—"}</td>
                      })}
                      <td className="text-xs">
                        {sa == null && sb ? `First score: ${SIDE[sb]}` : conclusion ? <span className="font-medium text-pax2-light-blue">Conclusion changed: {SIDE[sa!]} to {SIDE[sb!]}</span> : sb ? `Score changed, conclusion holds: ${SIDE[sb]}` : "Still not scorable"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableBlock>
        </OrderedBlock>
      )}

        <OrderedBlock id="calls" label="Calls">
          <ListBlock title="Calls" tools={resolved.length === 0 && SAMPLE_CHIP}>
        {resolved.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Partner: <b>{SAMPLE_CALLS.filter((c) => c.right).length} of {SAMPLE_CALLS.length}</b> right. <span className="text-slate-400">The “no change” baseline: {SAMPLE_CALLS.filter((c) => c.actual === "same").length} of {SAMPLE_CALLS.length}.</span>
            </p>
            <ul className="flex flex-col gap-2">
              {SAMPLE_CALLS.map((c) => {
                const t = takes.find((x) => x.take.id === c.take)!
                return (
                  <li key={c.take} data-find className="surface flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="rounded-full bg-pax2-lavender px-2 py-0.5 text-[11px] font-medium text-pax2-blue">Locked {new Date(c.at).toLocaleDateString()}</span>
                    <span className="text-slate-700">
                      {scriptById(t.take.scriptId)!.short} · {t.take.voice}: called <b>{c.predicted}</b> than {c.baseline}
                    </span>
                    <span className={cn("ml-auto font-semibold", c.right ? "text-above" : "text-below")}>{c.right ? "Right" : "Wrong"} · came in {c.actual}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <>
            {resolved.some((r) => r.right != null) && (
              <p className="text-sm">
                Partner: {resolved.filter((r) => r.right).length} of {resolved.filter((r) => r.right != null).length} right.{" "}
                <span className="text-muted-foreground">The “no change” baseline: {resolved.filter((r) => r.actual === "same").length} of {resolved.filter((r) => r.right != null).length}.</span>
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {resolved.map(({ t, c, actual, right }) => (
                <li key={c.at} data-find className="flex flex-wrap items-baseline gap-2 surface px-4 py-2 text-sm">
                  <span className="rounded bg-pax2-lavender px-1.5 text-[11px] font-medium text-pax2-light-blue">Locked {new Date(c.at).toLocaleString()}</span>
                  <span>
                    {takeLabel(t.take)}: {c.by} called <b>{c.predicted}</b> than {c.baseline?.toFixed(0)}
                  </span>
                  {actual ? <span className={cn("font-medium", right ? "text-observed" : "text-destructive")}>{right ? "Right" : "Wrong"} — it came in {actual}</span> : <span className="text-muted-foreground">Awaiting {c.target === "round-1" ? "Round 1" : "Round 2"}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
          </ListBlock>
        </OrderedBlock>

      </BlockOrder>

      <StandInNote />
    </div>
  )
}

const SAMPLE_CHIP = <span className="rounded-full bg-pax2-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax2-red-deep">Sample data</span>
