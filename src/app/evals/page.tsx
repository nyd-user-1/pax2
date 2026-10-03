import Link from "next/link"

import { StandInNote } from "@/components/bits"
import { LoadButton } from "@/components/load-button"
import { UploadExport } from "@/components/upload-export"
import { SlopeChart } from "@/components/charts/slope"
import { scriptById, takeLabel } from "@/lib/catalog"
import { toneOf } from "@/lib/tone"
import type { Reading } from "@/lib/pax"
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
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Evals</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Every test the partner approved, every call made before results came in, and what each new round of results changed.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">Results on file</h2>
        <ol className="flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.fileHash} className="flex flex-wrap items-baseline justify-between gap-2 surface px-4 py-2 text-sm">
              <span className="font-medium text-pax-ink">{h.dataset === "upload" ? "Uploaded export" : h.dataset === "round-1" ? "Round 1" : "Round 2"}</span>
              <span className="text-muted-foreground" title={`File fingerprint ${h.fileHash}`}>
                {h.rows} ads · results as of {h.asOf} · loaded {new Date(h.at).toLocaleString()}
              </span>
            </li>
          ))}
          {!history.length && <li className="text-sm text-muted-foreground">Nothing loaded yet.</li>}
        </ol>
        <div className="flex flex-wrap gap-6">
          {!loaded.has("round-1") ? <LoadButton dataset="round-1" label="Load round 1 results" /> : <LoadButton dataset="round-1" label="Load round 1 again" variant="outline" />}
          {loaded.has("round-1") && !r2 && <LoadButton dataset="round-2" label="Load round 2 results" />}
          {r2 && <LoadButton dataset="round-2" label="Load round 2 again" variant="outline" />}
          <UploadExport />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">Sent by volunteers</h2>
          <Link href="/record" className="text-sm text-primary underline">
            Open the recording flow
          </Link>
        </div>
        {sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos sent yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {sent.map((s) => (
              <li key={s.sk} className="flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm">
                <span className="font-medium text-pax-ink">{s.title ?? "Uploaded video"}</span>
                <span className="text-xs text-muted-foreground">
                  {[s.name, s.role, s.town].filter(Boolean).join(" · ") || "No description"} · {s.seconds}s · sent {new Date(s.at).toLocaleString()}
                </span>
                <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">What the partner carries into this review</h2>
        {carried.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions yet. Open a take, ask PAX for a reading, and approve, revise or save a next test.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {carried.map(({ t, e, finding }) => (
              <Link key={e.stepId} href={`/v/${t.take.id}`} className="flex flex-col gap-1 surface p-4 hover:bg-pax-mist">
                <span className="text-xs text-muted-foreground">
                  {scriptById(t.take.scriptId)!.title} — {takeLabel(t.take)}
                </span>
                <span className="font-medium text-pax-ink">{e.change}</span>
                <span className="text-xs text-muted-foreground">
                  {e.status === "made" ? "Made" : e.status === "approved" ? "Approved, not yet made" : e.status === "revised" ? "Revised, not yet made" : "Saved for later"} · decided {new Date(e.at).toLocaleDateString()} against score {finding?.score.value?.toFixed(0) ?? "—"} ({e.formula}, {e.reference})
                </span>
                {e.measure && <span className="text-xs text-foreground/80">How to tell: {e.measure}</span>}
                {e.status !== "made" && <span className="text-[11px] text-pax-red-deep">A later score on this take updates what is known about it; it says nothing about the change until the change is made and measured.</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {r2 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-slate-900">What changed with the later results</h2>
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
          <details className="surface group">
            <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-slate-900">Every take, component by component</summary>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="tabular w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="[&_th]:pb-2 [&_th]:pr-3 [&_th]:font-normal">
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
              <tbody className="[&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td:nth-child(n+2):nth-child(-n+7)]:whitespace-nowrap">
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
                        {sa == null && sb ? `First score: ${SIDE[sb]}` : conclusion ? <span className="font-medium text-pax-plum">Conclusion changed: {SIDE[sa!]} → {SIDE[sb!]}</span> : sb ? `Score changed, conclusion holds: ${SIDE[sb]}` : "Still not scorable"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </details>
          {takes.some((t) => t.history.length === 1 && t.history[0].snapshot.dataset === "round-2") && (
            <div className="rounded-xl border border-pax-plum/30 bg-pax-mist p-4 text-sm">
              <p className="font-medium text-pax-ink">New in this round</p>
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
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">Calls</h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls logged. On any take, “Call it” records a prediction before the next results load.</p>
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
                <li key={c.at} className="flex flex-wrap items-baseline gap-2 surface px-4 py-2 text-sm">
                  <span className="rounded bg-pax-lavender px-1.5 text-[11px] font-medium text-pax-plum">Locked {new Date(c.at).toLocaleString()}</span>
                  <span>
                    {takeLabel(t.take)}: {c.by} called <b>{c.predicted}</b> than {c.baseline?.toFixed(0)}
                  </span>
                  {actual ? <span className={cn("font-medium", right ? "text-observed" : "text-destructive")}>{right ? "Right" : "Wrong"} — it came in {actual}</span> : <span className="text-muted-foreground">Awaiting {c.target === "round-1" ? "Round 1" : "Round 2"}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <StandInNote />
    </div>
  )
}
