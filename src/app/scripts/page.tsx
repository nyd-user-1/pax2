import Link from "next/link"

import context from "../../../data/context.json"
import model from "../../../data/generated/model/reference-model.json"
import codes from "../../../data/generated/model/script-codes.json"
import { SourceBadge } from "@/components/bits"
import { ConsensusVote } from "@/components/consensus-vote"
import { PickScript } from "@/components/pick-script"
import { RecordScript } from "@/components/record/record-script"
import { SCRIPTS } from "@/lib/catalog"
import { tally } from "@/lib/consensus"
import { board, picks, votes, workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scripts" }

type Codes = { scripts: Record<string, { codes: Record<string, number>; notes: Record<string, string>; prior: Record<string, { expected: number; low: number; high: number; average: number }> }> }
type Model = { featureLabels: Record<string, string>; outcomes: Record<string, { features: { key: string; diff: number; low: number; high: number }[] }> }

export default async function ScriptsPage() {
  const ws = await workspace()
  const C = codes as unknown as Codes
  const RM = model as unknown as Model
  const vc = new Map(RM.outcomes.votechoice.features.map((f) => [f.key, f]))
  const [{ takes }, chosen, rawVotes] = await Promise.all([board(ws), picks(ws), votes(ws, context.consensus.slug)])
  const statements = context.consensus.statements
  const t = tally(rawVotes.map((v) => ({ voter: v.voter, tid: v.tid, vote: v.vote, at: v.at })), statements.map((s) => s.tid))
  const voted: Record<string, number[]> = {}
  for (const v of rawVotes) (voted[v.voter] ??= []).push(v.tid)
  const ranked = [...t.results].filter((r) => r.votes > 0).sort((a, b) => b.bridge - a.bridge)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-pax-ink md:text-5xl">Before anyone records</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Which script is worth a volunteer&apos;s five minutes? Three checks before recording, and a record of what was chosen and why, so the next review can ask whether the choice held up.</p>
        <Link href="/campaign" className="text-sm text-pax-plum underline">See what four reform campaigns are posting</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border bg-white p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What polling says</h2>
          {context.polls.map((p) => (
            <p key={p.url} className="mt-2 text-sm">
              {p.finding}{" "}
              <a href={p.url} className="text-pax-plum underline" target="_blank" rel="noreferrer">
                {p.pollster} for {p.sponsor}, {p.reported}
              </a>
            </p>
          ))}
          <p className="mt-2 text-sm text-muted-foreground">{context.pollingNote}</p>
        </div>
        <div className="rounded-3xl border bg-white p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What the other side says</h2>
          <p className="mt-2 text-sm">{context.opposition}</p>
          <a href={context.oppositionSource} className="mt-1 inline-block text-xs text-pax-plum underline" target="_blank" rel="noreferrer">
            WBUR, Sept. 28
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl text-pax-ink">The library</h2>
        {SCRIPTS.map((s) => {
          const c = C.scripts[s.id]
          const prior = c?.prior.votechoice
          const claim = statements.find((x) => "script" in x && x.script === s.id)
          const claimResult = claim && t.results.find((r) => r.tid === claim.tid)
          const scored = takes.filter((x) => x.take.scriptId === s.id && x.latest?.score.value != null)
          const top = Object.entries(c?.codes ?? {})
            .filter(([, v]) => v >= 0.5)
            .map(([k, v]) => ({ k, v, f: vc.get(k) }))
            .filter((x) => x.f)
            .sort((a, b) => Math.abs(b.f!.diff) - Math.abs(a.f!.diff))
            .slice(0, 5)
          return (
            <article key={s.id} id={s.id} className="grid gap-5 rounded-3xl border bg-white p-5 lg:grid-cols-[1.1fr_1fr]">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl leading-snug text-pax-ink">{s.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {s.framing} · {s.words} words · about {s.seconds} seconds at the teleprompter&apos;s 130 a minute
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">{s.text}</p>
                <p className="text-[11px] text-muted-foreground">{s.source}</p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <RecordScript id={s.id} title={s.title} text={s.text} />
                  <PickScript scriptId={s.id} />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Research prior</span>
                    <SourceBadge source="ai" />
                  </div>
                  {prior && (
                    <p className="text-sm">
                      Ads coded like this one moved vote choice by about <b className="tabular">{prior.expected.toFixed(1)} pts</b> in the archive&apos;s tests; a new ad could plausibly land anywhere from {prior.low.toFixed(1)} to {prior.high.toFixed(1)}. The average ad: {prior.average.toFixed(1)}.
                    </p>
                  )}
                  <ul className="flex flex-col gap-1 text-xs">
                    {top.map(({ k, v, f }) => (
                      <li key={k} className="flex justify-between gap-2 border-t pt-1">
                        <span>
                          {RM.featureLabels[k]} <span className="text-muted-foreground">({Math.round(v * 100)}% of coders)</span>
                          {c.notes[k] && <span className="block text-muted-foreground">{c.notes[k]}</span>}
                        </span>
                        <span className={cn("tabular shrink-0", f!.low > 0 ? "text-observed" : f!.high < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {f!.diff >= 0 ? "+" : ""}
                          {f!.diff.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/reference" className="text-[11px] text-pax-plum underline">
                    What the archive found, feature by feature
                  </Link>
                </div>
                <div className="flex flex-col gap-1 border-t pt-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Consensus on its central claim</span>
                  {claim && claimResult && claimResult.votes > 0 ? (
                    <p className="text-sm">
                      “{claim.text}” — {Math.round(claimResult.agreeRate * 100)}% agree of {claimResult.votes}
                      {t.groups > 1 && <> · across groups {claimResult.byGroup.map((g) => `${Math.round((g.agree / Math.max(1, g.total)) * 100)}%`).join(" and ")}</>}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No votes yet on “{claim?.text}”.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 border-t pt-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">In paid results</span>
                  {scored.length ? (
                    <p className="text-sm">
                      {scored.length} take{scored.length > 1 ? "s" : ""} scored, Resonance {Math.min(...scored.map((x) => x.latest!.score.value!)).toFixed(0)}–{Math.max(...scored.map((x) => x.latest!.score.value!)).toFixed(0)}.{" "}
                      <Link href="/" className="text-pax-plum underline">
                        See the board
                      </Link>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No paid results loaded.</p>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl text-pax-ink">Ask the people who will see it</h2>
          <p className="text-sm text-muted-foreground">
            Volunteers, partners, anyone in the room: judge each statement. Groups form from the votes, and the statements every group agrees with are the safest ground for a script. {context.consensus.source}.
          </p>
          <ConsensusVote slug={context.consensus.slug} statements={statements} voted={voted} />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl text-pax-ink">Where people agree</h2>
          <p className="text-xs text-muted-foreground">
            {t.voters} {t.voters === 1 ? "person" : "people"} · {t.groups > 1 ? `${t.groups} groups found from the votes` : "groups form from four people up"}
          </p>
          <ol className="flex flex-col gap-1.5">
            {ranked.slice(0, 10).map((r) => {
              const s = statements.find((x) => x.tid === r.tid)!
              return (
                <li key={r.tid} className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
                  <span className={cn("script" in s && s.script && "font-medium text-pax-ink")}>{s.text}</span>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {r.agree} agree · {r.disagree} disagree · {r.votes} votes
                    {t.groups > 1 && <> · agreement by group {r.byGroup.map((g) => `${Math.round(g.rate * 100)}%`).join(" / ")}</>}
                  </span>
                </li>
              )
            })}
            {!ranked.length && <li className="text-sm text-muted-foreground">No votes yet.</li>}
          </ol>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl text-pax-ink">Choices on record</h2>
        {chosen.length ? (
          <ol className="flex flex-col gap-1.5">
            {chosen.map((p) => (
              <li key={p.sk} className="rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium text-pax-ink">{SCRIPTS.find((s) => s.id === p.scriptId)?.title}</span>
                <span className="text-muted-foreground"> · {new Date(p.at).toLocaleString()}</span>
                <p className="text-foreground/85">{p.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No script chosen yet.</p>
        )}
      </section>

    </div>
  )
}
