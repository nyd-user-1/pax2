import Link from "next/link"

import { RangeBar, ScoreFigure, StandInNote, fmt } from "@/components/bits"
import { LoadButton } from "@/components/load-button"
import { CLAIM, MESSENGERS, SCRIPTS, takeLabel } from "@/lib/catalog"
import { board, loads, workspace, type TakeState } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"

function Cell({ s }: { s?: TakeState }) {
  if (!s) return <div className="flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">Not recorded</div>
  const sc = s.latest?.score
  return (
    <Link href={`/v/${s.take.id}`} className="group flex h-full min-h-28 flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-pax-plum/40 hover:bg-pax-mist">
      <div className="flex items-start justify-between gap-2">
        {sc ? <ScoreFigure value={sc.value} low={sc.low} high={sc.high} status={sc.status} size="sm" /> : <span className="text-sm text-muted-foreground">No results yet</span>}
        {sc?.status === "limited" && <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-900">Limited evidence</span>}
      </div>
      {sc && sc.status !== "unscorable" && <RangeBar value={sc.value} low={sc.low} high={sc.high} />}
      {sc?.status === "unscorable" && <p className="text-xs leading-snug text-muted-foreground">{sc.reasons[0]}</p>}
      <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{fmt(s.latest?.snapshot.metrics.impressions.value)} impressions</span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
      </div>
    </Link>
  )
}

export default async function ArgumentsPage() {
  const ws = await workspace()
  const [{ ref, takes }, history] = await Promise.all([board(ws), loads(ws)])
  const main = (scriptId: string, voice: string) => takes.find((t) => t.take.scriptId === scriptId && t.take.voice === voice && t.take.captions && !t.take.cut)
  const variants = takes.filter((t) => !t.take.captions || t.take.cut)
  const scored = takes.filter((t) => t.latest && t.latest.score.value != null)
  const best = [...scored].sort((a, b) => b.latest!.score.value! - a.latest!.score.value!)[0]
  const widest = [...scored].sort((a, b) => b.latest!.score.high! - b.latest!.score.low! - (a.latest!.score.high! - a.latest!.score.low!))[0]
  const unscored = takes.filter((t) => t.latest?.score.status === "unscorable")
  const loaded = new Set(history.map((h) => h.dataset))

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-pax-plum">{CLAIM.ballot}</p>
        <h1 className="font-display text-4xl leading-tight text-pax-ink md:text-5xl">{CLAIM.text}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every take is an experiment on the argument: the same claim, framed three ways, read by different messengers. Each cell is a take&apos;s Resonance under the frozen reference, with the range its evidence supports.
        </p>
      </header>

      {!ref ? (
        <section className="flex flex-col gap-3 rounded-2xl border bg-pax-mist p-6">
          <h2 className="font-display text-2xl text-pax-ink">Start with the first round of paid results</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Loading them builds the reference scale from this round and freezes it. Every later round is scored on the same scale, so a change in a score is a change in performance, not in the yardstick.</p>
          <LoadButton dataset="round-1" label="Load round 1 results" />
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          {best && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Highest so far</p>
              <Link href={`/v/${best.take.id}`} className="mt-1 block font-medium text-pax-ink hover:underline">
                {SCRIPTS.find((s) => s.id === best.take.scriptId)!.title} — {takeLabel(best.take)}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                Resonance {best.latest!.score.value!.toFixed(0)}, range {best.latest!.score.low!.toFixed(0)}–{best.latest!.score.high!.toFixed(0)}
              </p>
            </div>
          )}
          {widest && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Least settled</p>
              <Link href={`/v/${widest.take.id}`} className="mt-1 block font-medium text-pax-ink hover:underline">
                {SCRIPTS.find((s) => s.id === widest.take.scriptId)!.title} — {takeLabel(widest.take)}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">Its range spans {(widest.latest!.score.high! - widest.latest!.score.low!).toFixed(0)} points; more delivery would narrow it before anything is concluded.</p>
            </div>
          )}
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Results on file</p>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {history.map((h) => (
                <li key={h.fileHash} className="flex justify-between gap-2">
                  <span className="text-pax-ink">{h.dataset === "upload" ? "Uploaded export" : h.dataset.replace("-", " ")}</span>
                  <span className="text-muted-foreground">{h.rows} rows · as of {h.asOf}</span>
                </li>
              ))}
            </ul>
            {!loaded.has("round-2") && <p className="mt-2 text-xs text-muted-foreground">Round 2 loads on Reviews, after the partner has recorded a decision.</p>}
            {unscored.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{unscored.length} take not scored: too little delivery.</p>}
          </div>
        </section>
      )}

      <section className="overflow-x-auto">
        <div className="grid min-w-[720px] gap-3" style={{ gridTemplateColumns: `minmax(220px, 1.3fr) repeat(${MESSENGERS.length}, minmax(150px, 1fr))` }}>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Framing (script)</div>
          {MESSENGERS.map((m) => (
            <div key={m} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {m} <span className="normal-case tracking-normal opacity-70">· stand-in voice</span>
            </div>
          ))}
          {SCRIPTS.map((s) => (
            <div key={s.id} className="contents">
              <Link href={`/scripts#${s.id}`} className="flex flex-col gap-1 rounded-xl p-2 hover:bg-pax-mist">
                <span className="font-medium leading-snug text-pax-ink">{s.title}</span>
                <span className="text-xs text-muted-foreground">{s.framing}</span>
              </Link>
              {MESSENGERS.map((m) => (
                <Cell key={m} s={main(s.id, m)} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {variants.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl text-pax-ink">Production variants</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">The same words and voice with one execution change, so the comparison isolates that change.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {variants.map((v) => {
              const twin = takes.find((t) => t.take.scriptId === v.take.scriptId && t.take.voice === v.take.voice && t.take.captions && !t.take.cut)
              return (
                <div key={v.take.id} className={cn("grid grid-cols-2 gap-3 rounded-2xl border p-3")}>
                  <div className="col-span-2 text-sm">
                    <span className="font-medium text-pax-ink">{SCRIPTS.find((s) => s.id === v.take.scriptId)!.title}</span>
                    <span className="text-muted-foreground"> · {v.take.voice}: {v.take.cut ? "short cut vs. full length" : "no captions vs. captions"}</span>
                  </div>
                  <Cell s={v} />
                  <Cell s={twin} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      <StandInNote />
    </div>
  )
}
