import Link from "next/link"
import { Plus } from "lucide-react"

import context from "../../../data/context.json"
import model from "../../../data/generated/model/reference-model.json"
import codes from "../../../data/generated/model/script-codes.json"
import { Fold } from "@/components/fold"
import { UncontestedMap } from "@/components/map/maps"
import { AgreeSection, type AgreeRow } from "@/components/scripts/agree-section"
import { ScriptBoard, type ScriptCardData } from "@/components/scripts/script-board"
import { SCRIPTS } from "@/lib/catalog"
import { tally } from "@/lib/consensus"
import { board, picks, votes, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scripts" }

type Codes = { scripts: Record<string, { codes: Record<string, number>; notes: Record<string, string>; prior: Record<string, { expected: number; low: number; high: number; average: number }> }> }
type Model = { featureLabels: Record<string, string>; outcomes: Record<string, { features: { key: string; diff: number; low: number; high: number }[] }> }

const firstSentence = (t: string) => (t.split("\n")[0].match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t.split("\n")[0]).trim()

/** Which script is worth a volunteer's time: the three side by side, who should record, what people agree on. */
export default async function ScriptsPage() {
  const ws = await workspace()
  const C = codes as unknown as Codes
  const RM = model as unknown as Model
  const vc = new Map(RM.outcomes.votechoice.features.map((f) => [f.key, f]))
  const [{ takes }, chosen, rawVotes] = await Promise.all([board(ws), picks(ws), votes(ws, context.consensus.slug)])
  const statements = context.consensus.statements
  const t = tally(
    rawVotes.map((v) => ({ voter: v.voter, tid: v.tid, vote: v.vote, at: v.at })),
    statements.map((s) => s.tid),
  )
  const voted: Record<string, number[]> = {}
  for (const v of rawVotes) (voted[v.voter] ??= []).push(v.tid)

  const cards: ScriptCardData[] = SCRIPTS.map((s) => {
    const c = C.scripts[s.id]
    const mine = takes.filter((x) => x.take.scriptId === s.id && x.take.captions && !x.take.cut)
    const videos = mine.map((x) => ({ id: x.take.id, voice: x.take.voice, poster: x.take.video?.poster, score: x.latest?.score.value ?? null, low: x.latest?.score.low ?? null, high: x.latest?.score.high ?? null }))
    const scored = videos.filter((v) => v.score != null).map((v) => v.score!)
    const claim = statements.find((x) => "script" in x && x.script === s.id)
    const res = claim && t.results.find((r) => r.tid === claim.tid)
    const seconds = mine.length ? Math.round(mine.reduce((a, x) => a + x.take.durationSec, 0) / mine.length) : s.seconds
    const features = Object.entries(c?.codes ?? {})
      .filter(([, v]) => v >= 0.5)
      .map(([k, v]) => ({ k, v, f: vc.get(k) }))
      .filter((x) => x.f)
      .sort((a, b) => Math.abs(b.f!.diff) - Math.abs(a.f!.diff))
      .slice(0, 5)
      .map(({ k, v, f }) => ({ label: RM.featureLabels[k], share: v, diff: f!.diff, sign: (f!.low > 0 ? "up" : f!.high < 0 ? "down" : "flat") as "up" | "down" | "flat", note: c.notes[k] }))
    return {
      id: s.id,
      title: s.title,
      framing: s.framing,
      text: s.text,
      words: s.words,
      seconds,
      opening: firstSentence(s.text),
      videos,
      best: scored.length ? Math.max(...scored) : null,
      average: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
      agree: claim && res && res.votes > 0 ? { rate: res.agreeRate, votes: res.votes, claim: claim.text } : null,
      prior: c?.prior.votechoice ?? null,
      features,
      leader: false,
    }
  })
  const lead = [...cards].filter((c) => c.average != null).sort((a, b) => b.average! - a.average!)[0]
  if (lead) lead.leader = true

  const rows: AgreeRow[] = [...t.results]
    .filter((r) => r.votes > 0)
    .sort((a, b) => b.bridge - a.bridge)
    .slice(0, 6)
    .map((r) => {
      const s = statements.find((x) => x.tid === r.tid)!
      return { tid: r.tid, text: s.text, agree: r.agree, disagree: r.disagree, votes: r.votes, rate: r.agreeRate, script: "script" in s && !!s.script }
    })

  return (
    <div className="flex flex-col gap-12">
      <header className="rise flex flex-wrap items-end justify-between gap-4 md:pt-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Scripts</h1>
          <p className="text-slate-500">{lead ? `“${lead.title}” leads, averaging ${lead.average!.toFixed(0)} across its videos.` : "No results yet: choose on agreement and research."}</p>
        </div>
        <Link href="/record" className="press inline-flex items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e2">
          <Plus className="size-4" /> Record
        </Link>
      </header>

      <ScriptBoard scripts={cards} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl text-slate-900">Who should record it</h2>
          <p className="text-sm text-slate-500">Red districts had one name on the 2022 ballot. A volunteer from one can say it first-hand: my representative had no opponent.</p>
        </div>
        <UncontestedMap />
      </section>

      <AgreeSection rows={rows} slug={context.consensus.slug} statements={statements} voted={voted} voters={t.voters} groups={t.groups} source={context.consensus.source} />

      <Fold
        title="Context"
        preview={<p className="text-sm text-slate-600">{context.polls[0]?.finding}</p>}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Polling</h3>
            {context.polls.map((p) => (
              <p key={p.url} className="text-sm text-slate-700">
                {p.finding}{" "}
                <a href={p.url} target="_blank" rel="noreferrer" className="text-pax-plum hover:underline">
                  {p.pollster} for {p.sponsor}
                </a>
              </p>
            ))}
            <p className="text-sm text-slate-500">{context.pollingNote}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-900">The other side</h3>
            <p className="text-sm text-slate-700">{context.opposition}</p>
            <a href={context.oppositionSource} target="_blank" rel="noreferrer" className="text-sm text-pax-plum hover:underline">
              WBUR, Sept. 28
            </a>
          </div>
        </div>
      </Fold>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-slate-900">Choices made</h2>
        {chosen.length ? (
          <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:inset-y-2 before:left-[5px] before:w-px before:bg-slate-200">
            {chosen.map((p) => (
              <li key={p.sk} className="relative flex flex-col gap-1">
                <span className="absolute top-1.5 -left-6 size-[11px] rounded-full border-2 border-pax-ink bg-white" />
                <span className="text-xs text-slate-500">{new Date(p.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <p className="font-medium text-slate-900">{SCRIPTS.find((s) => s.id === p.scriptId)?.title}</p>
                <p className="text-sm text-slate-600">{p.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">None yet. Open a script and choose it for the next round; the reason is kept here.</p>
        )}
      </section>
    </div>
  )
}
