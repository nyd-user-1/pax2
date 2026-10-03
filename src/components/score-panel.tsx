import { fmt, pct, RangeBar, ScoreFigure, SourceBadge } from "@/components/bits"
import { Term } from "@/components/term"
import { METRIC_LABEL, type TakeInfo } from "@/lib/catalog"
import { COMPONENTS, FORMULA_V1, logit, rawCounts, type Reference, type Score } from "@/lib/resonance"
import { METRICS, type Snapshot } from "@/lib/types"

/** The score, its components, and one complete trace from raw records to the number. */
export function ScorePanel({ take, snapshot, score, reference }: { take: TakeInfo; snapshot: Snapshot; score: Score; reference: Reference }) {
  const raws = rawCounts(snapshot, take)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Resonance · {FORMULA_V1.label} · reference {reference.id}
          </p>
          <ScoreFigure value={score.value} low={score.low} high={score.high} status={score.status} />
        </div>
        <div className="min-w-56 flex-1">
          {score.value != null && <RangeBar value={score.value} low={score.low} high={score.high} />}
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>50 = reference average</span>
            <span>100</span>
          </div>
        </div>
      </div>
      {score.reasons.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {score.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {score.components.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {score.components.map((c) => {
            const meta = COMPONENTS.find((x) => x.key === c.key)!
            return (
              <div key={c.key} className="flex flex-col gap-2 surface p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-pax-ink">{meta.name}</span>
                  <span className="tabular text-xs text-muted-foreground">weight {(c.weight * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-muted-foreground">{meta.question}</p>
                {c.score != null ? (
                  <>
                    <div className="tabular flex items-baseline gap-1.5">
                      <span className="font-display text-3xl text-pax-ink">{c.score.toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.low!.toFixed(0)}–{c.high!.toFixed(0)}
                      </span>
                    </div>
                    <RangeBar value={c.score} low={c.low} high={c.high} />
                    <p className="text-xs text-muted-foreground">
                      {meta.num} ÷ {meta.den} = {pct(c.rate, 2)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Missing from the record.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {score.components.length > 0 && (
        <details className="group rounded-xl border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">
            From the records to the score <span className="text-muted-foreground group-open:hidden">↓</span>
          </summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                  <th />
                  {score.components.map((c) => (
                    <th key={c.key}>
                      <Term id={c.key}>{COMPONENTS.find((x) => x.key === c.key)!.name}</Term> <span className="font-normal text-slate-400">· {(c.weight * 100).toFixed(0)}%</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6">
                <tr>
                  <td className="text-slate-500"><Term id="counts" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{raws[c.key] ? <>{fmt(raws[c.key]!.x)} <span className="text-slate-400">/ {fmt(raws[c.key]!.n)}</span></> : "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="rate" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{pct(c.rate, 2)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="reference-average" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{pct(reference.pooled[c.key], 2)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="weighted-rate" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{pct(c.shrunk, 2)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="distance" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{c.shrunk != null ? ((logit(c.shrunk) - reference.mean[c.key]) / reference.sd[c.key]).toFixed(2) : "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="component-score" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{c.score?.toFixed(1)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-slate-500"><Term id="weight" /></td>
                  {score.components.map((c) => (
                    <td key={c.key}>{c.contribution?.toFixed(1)}</td>
                  ))}
                </tr>
                <tr className="font-semibold text-pax-ink">
                  <td><Term id="resonance" /></td>
                  <td colSpan={3}>{score.value?.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      )}

      <details className="group rounded-xl border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">
          Source records · {snapshot.dataset}, {snapshot.windowStart} to {snapshot.windowEnd} <span className="text-muted-foreground group-open:hidden">↓</span>
        </summary>
        <div className="grid gap-x-6 px-4 pb-4 text-xs sm:grid-cols-2">
          {METRICS.map((m) => (
            <div key={m} className="flex items-center justify-between gap-2 border-t py-1.5">
              <span className="text-muted-foreground">{METRIC_LABEL[m]}</span>
              <span className="tabular flex items-center gap-2">
                {fmt(snapshot.metrics[m].value, m === "avgWatchSec" || m === "spend" ? 1 : 0)}
                <SourceBadge source={snapshot.metrics[m].source} />
              </span>
            </div>
          ))}
          <div className="col-span-full mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cond label="Spend" v={score.conditions.spend != null ? `$${fmt(score.conditions.spend, 2)}` : "—"} />
            <Cond label="Cost per 1,000 impressions" v={score.conditions.cpm != null ? `$${fmt(score.conditions.cpm, 2)}` : "—"} />
            <Cond label="Cost per 3-second play" v={score.conditions.costPerPlay != null ? `$${fmt(score.conditions.costPerPlay, 3)}` : "—"} />
            <Cond label="Times each person saw it" v={fmt(score.conditions.frequency, 2)} />
          </div>
          <p className="col-span-full mt-2 text-muted-foreground">Delivery conditions sit beside the score, never inside it.</p>
        </div>
      </details>
    </div>
  )
}

function Cond({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="tabular text-sm text-pax-ink">{v}</div>
    </div>
  )
}
