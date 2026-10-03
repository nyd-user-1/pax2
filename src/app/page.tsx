import Link from "next/link"
import { Hourglass, Sparkles, Upload, Video } from "lucide-react"

import { FramingStrip } from "@/components/framing-strip"
import { LoadButton } from "@/components/load-button"
import { RecordScript } from "@/components/record/record-script"
import { ScrollRow } from "@/components/scroll-row"
import { ScoreInfo, SectionTitle } from "@/components/ui-pax"
import { CLAIM, SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, findings, loads, steps, workspace } from "@/lib/review"
import { byScore, cardOf } from "@/lib/view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Home" }

const CAMPAIGN = "MA-Yes on Three"

type Next = { key: string; icon: typeof Video; title: string; body: string; action: React.ReactNode }

export default async function HomePage() {
  const ws = await workspace()
  const [{ ref, takes }, history] = await Promise.all([board(ws), loads(ws)])
  const loaded = new Set(history.map((h) => h.dataset))
  const cards = takes.map(cardOf).sort(byScore)
  const scored = cards.filter((c) => c.score != null)
  const latest = history.at(-1)

  // What to do next, most useful first, at most three.
  const next: Next[] = []
  if (!ref) {
    next.push({ key: "load1", icon: Upload, title: "Load the first round of results", body: "Scores appear the moment paid results are in. The first round also sets the average every later round is measured against.", action: <LoadButton dataset="round-1" label="Load round 1" /> })
  } else {
    const perTake = await Promise.all(takes.map(async (t) => ({ t, ev: await steps(ws, t.take.id), fs: await findings(ws, t.take.id) })))
    const pending = perTake.flatMap(({ t, ev }) => {
      const last = new Map<string, (typeof ev)[number]>()
      for (const e of ev.sort((a, b) => a.at.localeCompare(b.at))) last.set(e.stepId, e)
      return [...last.values()].filter((e) => e.status === "approved" || e.status === "revised").map((e) => ({ t, e }))
    })
    for (const { t, e } of pending.slice(0, 1))
      next.push({ key: `step-${e.stepId}`, icon: Sparkles, title: "An approved test is waiting to be made", body: `${e.change} — on ${scriptById(t.take.scriptId)!.short}, ${takeLabel(t.take)}.`, action: <Link href={`/v/${t.take.id}`} scroll={false} className="press inline-flex items-center gap-1.5 rounded-full bg-pax-ink px-4 py-2 text-sm font-semibold text-white">Report</Link> })
    const leader = perTake.find((p) => p.t.take.id === scored[0]?.id)
    if (leader && !leader.fs.length)
      next.push({ key: "read", icon: Sparkles, title: `Find out why “${scored[0].scriptShort}” is leading`, body: `${takeLabel(leader.t.take)} scores ${scored[0].score!.toFixed(0)}. PAX reads the results and the video, and proposes the next test.`, action: <Link href={`/v/${scored[0].id}`} scroll={false} className="press inline-flex items-center gap-1.5 rounded-full bg-pax-ink px-4 py-2 text-sm font-semibold text-white">Report</Link> })
    if (!loaded.has("round-2"))
      next.push({ key: "load2", icon: Upload, title: "Round 2 results are ready", body: "Load them to see what held up, what changed, and how any calls came out.", action: <LoadButton dataset="round-2" label="Load round 2" /> })
    const thin = cards.find((c) => c.status === "limited" || c.status === "unscorable")
    if (thin)
      next.push({ key: "thin", icon: Hourglass, title: "One video needs more reach before it can be judged", body: `${thin.scriptShort}, ${thin.voice}: ${(thin.impressions ?? 0).toLocaleString()} impressions so far.`, action: <Link href={`/v/${thin.id}`} scroll={false} className="press inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-pax-ink">Report</Link> })
    const means = SCRIPTS.map((s) => {
      const xs = scored.filter((c) => c.script === s.id).map((c) => c.score!)
      return { s, m: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : -1 }
    }).sort((a, b) => b.m - a.m)
    if (means[0].m > 0)
      next.push({ key: "record", icon: Video, title: `Record “${means[0].s.short}” with a new voice`, body: `It has the highest average so far (${means[0].m.toFixed(0)}). A new messenger tests whether the words or the voice are doing the work.`, action: <RecordScript id={means[0].s.id} title={means[0].s.title} text={means[0].s.text} label="Record" /> })
  }

  return (
    <div className="flex flex-col gap-12">
      <header className="rise flex flex-wrap items-start justify-between gap-6 md:pt-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">{latest ? `Rd. ${latest.dataset === "round-2" ? 2 : 1}: ${CAMPAIGN}` : CAMPAIGN}</h1>
          {latest && <p className="tabular text-slate-500">{new Date(latest.asOf + "T12:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</p>}
        </div>
        <Link href="/record" className="press inline-flex items-center gap-2 rounded-full bg-pax-ink px-6 py-3.5 text-sm font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3">
          <Video className="size-4" /> Record
        </Link>
      </header>

      {next.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Next up" />
          <div className="grid gap-4 md:grid-cols-3">
            {next.slice(0, 3).map((n, i) => (
              <div key={n.key} className="surface rise flex flex-col gap-3 p-5" style={{ ["--i" as string]: i }}>
                <p className="font-semibold leading-snug text-slate-900">{n.title}</p>
                <p className="flex-1 text-sm leading-relaxed text-slate-500">{n.body}</p>
                <div>{n.action}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {scored.length > 0 && (
        <ScrollRow
          title="Scored"
          href="/videos"
          videos={cards}
          legend={
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="size-2.5 rounded-full bg-above" /> above average
              <span className="ml-3 size-2.5 rounded-full bg-below" /> below average
              <span className="ml-3 size-2.5 rounded-full border border-slate-300 bg-white" /> can&apos;t tell yet
              <ScoreInfo className="ml-1" />
            </p>
          }
        />
      )}

      {scored.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Framing" />
          <FramingStrip scripts={SCRIPTS} videos={cards} />
        </section>
      )}

      <p className="text-xs text-slate-400">Stand-in videos and results until Parallax&apos;s own arrive.</p>
    </div>
  )
}
