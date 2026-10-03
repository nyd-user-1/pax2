import Link from "next/link"

import { Chart3, Chart4 } from "@/components/dash/charts"
import { Stat2 } from "@/components/dash/stats"
import { SectionTitle } from "@/components/ui-pax"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, findings, forecasts, loads, picks, steps, submissions, votes, workspace } from "@/lib/review"
import { SAMPLE_ACTIVITY, SAMPLE_COUNTS, SAMPLE_FEED, SAMPLE_SENT } from "@/lib/sample"
import { toneOf } from "@/lib/tone"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard" }

// The campaign's content operation in one place: what was made, what PAX read, what the partner
// decided, and how the calls are going. Every number comes from the ledger or the loaded results.

const day = (iso: string) => iso.slice(0, 10)

export default async function DashboardPage() {
  const ws = await workspace()
  const [{ takes }, history, sent, chosen, voteRows] = await Promise.all([board(ws), loads(ws), submissions(ws), picks(ws), votes(ws, "open-primaries")])
  const per = await Promise.all(takes.map(async (t) => ({ t, fs: await findings(ws, t.take.id), ev: await steps(ws, t.take.id), calls: await forecasts(ws, t.take.id) })))
  const readings = per.flatMap((p) => p.fs)
  const events = per.flatMap((p) => p.ev.map((e) => ({ ...e, take: p.t })))
  const lastByStep = new Map<string, (typeof events)[number]>()
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) lastByStep.set(e.stepId, e)
  const decided = [...lastByStep.values()]
  const approved = decided.filter((e) => ["approved", "revised", "made"].includes(e.status)).length
  const made = decided.filter((e) => e.status === "made").length
  const calls = per.flatMap((p) =>
    p.calls.map((c) => {
      const after = p.t.history.find((h) => h.snapshot.dataset === c.target)?.score.value
      const d = after != null && c.baseline != null ? after - c.baseline : null
      return d == null ? null : (d > 2 ? "higher" : d < -2 ? "lower" : "same") === c.predicted
    }),
  )
  const resolved = calls.filter((c) => c != null)
  const latest = takes.map((t) => t.latest).filter((x): x is NonNullable<typeof x> => !!x)
  const reach = latest.reduce((s, l) => s + (l.snapshot.metrics.reach.value ?? 0), 0)
  const spend = latest.reduce((s, l) => s + (l.snapshot.metrics.spend.value ?? 0), 0)

  // Activity by day across the ledger.
  const byDay = new Map<string, { item1: number; item2: number }>()
  const bump = (iso: string, k: "item1" | "item2") => {
    const d = byDay.get(day(iso)) ?? { item1: 0, item2: 0 }
    d[k]++
    byDay.set(day(iso), d)
  }
  readings.forEach((r) => bump(r.at, "item1"))
  events.forEach((e) => bump(e.at, "item1"))
  sent.forEach((s) => bump(s.at, "item2"))
  chosen.forEach((p) => bump(p.at, "item2"))
  voteRows.forEach((v) => bump(v.at, "item2"))
  const activity = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))

  const tones = takes.map((t) => toneOf(t.latest?.score.low, t.latest?.score.high))
  const slices = [
    { title: "Above average", value: tones.filter((x) => x === "above").length, fill: "#2563eb" },
    { title: "Can't tell yet", value: tones.filter((x) => x === "even").length, fill: "#94a3b8" },
    { title: "Below average", value: tones.filter((x) => x === "below").length, fill: "#dc2626" },
    { title: "Not scored", value: tones.filter((x) => x === "none").length, fill: "#e2e8f0" },
  ].filter((s) => s.value > 0)

  const funnel = [
    { label: "Next tests proposed", n: readings.reduce((s, r) => s + ((r.finding as { nextSteps?: unknown[] }).nextSteps?.length ?? 0), 0) },
    { label: "Approved or revised", n: approved },
    { label: "Made into a new take", n: made },
  ]
  const fmax = Math.max(1, ...funnel.map((f) => f.n))
  const feed = [
    ...readings.map((r) => ({ at: r.at, text: `PAX read ${scriptById(per.find((p) => p.fs.includes(r))!.t.take.scriptId)!.short}` })),
    ...decided.map((e) => ({ at: e.at, text: `${e.status[0].toUpperCase()}${e.status.slice(1)}: ${e.change}` })),
    ...sent.map((s) => ({ at: s.at, text: `${s.name || "A volunteer"} sent a ${s.seconds}s video` })),
    ...history.map((h) => ({ at: h.at, text: `Loaded ${h.dataset === "round-1" ? "Round 1" : h.dataset === "round-2" ? "Round 2" : "an export"} (${h.rows} ads)` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)

  // Until the ledger has activity, show the page's full shape with sample data, labeled as such.
  const demo = !readings.length && !sent.length && !decided.length
  const show = demo
    ? { sent: SAMPLE_SENT.length, sentNote: "Latest today", calls: `${SAMPLE_COUNTS.callsRight} of ${SAMPLE_COUNTS.callsTotal}`, activity: SAMPLE_ACTIVITY, readings: SAMPLE_COUNTS.readings, decisions: SAMPLE_COUNTS.decisions, votes: SAMPLE_COUNTS.votes, feed: SAMPLE_FEED }
    : { sent: sent.length, sentNote: sent.length ? `Latest ${new Date(sent[0].at).toLocaleDateString()}` : "None yet", calls: resolved.length ? `${resolved.filter(Boolean).length} of ${resolved.length}` : "—", activity, readings: readings.length, decisions: decided.length, votes: voteRows.length, feed }
  if (demo) {
    funnel[0].n = SAMPLE_COUNTS.proposed
    funnel[1].n = SAMPLE_COUNTS.approved
    funnel[2].n = SAMPLE_COUNTS.made
  }
  const fmaxShown = Math.max(1, ...funnel.map((f) => f.n))

  return (
    <div className="flex flex-col gap-10">
      <header className="rise flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Dashboard</h1>
        {demo && <span className="rounded-full bg-pax-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax-red-deep">Sample data</span>}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat2 title="Videos in rotation" value={takes.length} footer={`${SCRIPTS.length} scripts · ${new Set(takes.map((t) => t.take.voice)).size} messengers`} />
        <Stat2 title="Sent by volunteers" value={show.sent} footer={show.sentNote} />
        <Stat2 title="People reached" value={reach.toLocaleString()} footer={`$${Math.round(spend).toLocaleString()} spent across ${latest.length} flights`} />
        <Stat2 title="Calls right" value={show.calls} footer="Predictions locked before results" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Chart3
          title="Activity by day"
          data={show.activity.length ? show.activity : [{ date: new Date().toISOString().slice(0, 10), item1: 0, item2: 0 }]}
          labels={{ item1: "Readings and decisions", item2: "Volunteer input" }}
          figures={[
            { label: "PAX readings", value: show.readings },
            { label: "Decisions", value: show.decisions },
            { label: "Consensus votes", value: show.votes },
          ]}
          fileName="pax-activity"
        />
        <Chart4 title="Where the videos stand" totalLabel="Videos" data={slices} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface flex flex-col gap-4 p-6">
          <SectionTitle title="From reading to new take" />
          {funnel.map((f, i) => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{f.label}</span>
                <span className="tabular font-semibold text-slate-900">{f.n}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="grow h-full rounded-full bg-pax-ink" style={{ width: `${(f.n / fmaxShown) * 100}%`, ["--i" as string]: i }} />
              </div>
            </div>
          ))}
          <Link href="/evals" className="text-sm font-medium text-pax-plum hover:underline">
            Open Evals →
          </Link>
        </div>
        <div className="surface flex flex-col gap-3 p-6">
          <SectionTitle title="Latest" />
          {show.feed.length ? (
            <ol className="flex flex-col">
              {show.feed.map((f, i) => (
                <li key={i} className="rise flex items-start gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0" style={{ ["--i" as string]: i }}>
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pax-plum" />
                  <span className="flex-1 text-slate-700">{f.text}</span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(f.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Nothing yet.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Scores by script" />
        <div className="surface grid gap-5 p-6 md:grid-cols-3">
          {SCRIPTS.map((s) => {
            const xs = takes.filter((t) => t.take.scriptId === s.id && t.latest?.score.value != null)
            return (
              <div key={s.id} className="flex flex-col gap-2">
                <p className="font-semibold text-slate-900">{s.short}</p>
                {xs
                  .sort((a, b) => b.latest!.score.value! - a.latest!.score.value!)
                  .map((t, i) => {
                    const v = t.latest!.score.value!
                    const tone = toneOf(t.latest!.score.low, t.latest!.score.high)
                    return (
                      <Link key={t.take.id} href={`/v/${t.take.id}`} scroll={false} className="group flex items-center gap-2 text-xs">
                        <span className="w-24 shrink-0 truncate text-slate-500 group-hover:text-pax-ink">{takeLabel(t.take)}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="grow block h-full rounded-full" style={{ width: `${v}%`, background: tone === "above" ? "#2563eb" : tone === "below" ? "#dc2626" : "#94a3b8", ["--i" as string]: i }} />
                        </span>
                        <span className="tabular w-6 text-right font-semibold text-slate-800">{v.toFixed(0)}</span>
                      </Link>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
