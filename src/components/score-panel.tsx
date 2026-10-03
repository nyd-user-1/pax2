import { fmt, pct, RangeBar, ScoreFigure, SourceBadge } from "@/components/bits"
import { Term } from "@/components/term"
import type { TakeInfo } from "@/lib/catalog"
import { COMPONENTS, logit, rawCounts, type Reference, type Score } from "@/lib/resonance"
import type { MetricKey, Snapshot } from "@/lib/types"

const ROWS: [string, MetricKey][] = [
  ["Spend", "spend"],
  ["Impressions", "impressions"],
  ["Reach", "reach"],
  ["3s plays", "plays3s"],
  ["ThruPlays", "thruplays"],
  ["25% play", "p25"],
  ["50% play", "p50"],
  ["75% play", "p75"],
  ["100% play", "p100"],
  ["Avg. Time", "avgWatchSec"],
  ["Shares", "shares"],
  ["Saves", "saves"],
  ["Comments", "comments"],
  ["Reactions", "reactions"],
  ["Clicks", "linkClicks"],
  ["CTA", "linkClicks"],
]

/** "October 6-10, 2026", or across months "September 28-October 3, 2026". */
function span(start: string, end: string) {
  const a = new Date(`${start}T12:00:00Z`)
  const b = new Date(`${end}T12:00:00Z`)
  const month = (d: Date) => d.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
  const right = month(a) === month(b) ? `${b.getUTCDate()}` : `${month(b)} ${b.getUTCDate()}`
  return `${month(a)} ${a.getUTCDate()}-${right}, ${b.getUTCFullYear()}`
}

/** The score, its components, and one complete trace from raw records to the number. */
export function ScorePanel({ take, snapshot, score, reference, part }: { take: TakeInfo; snapshot: Snapshot; score: Score; reference: Reference; part: "summary" | "detail" }) {
  const raws = rawCounts(snapshot, take)
  return part === "summary" ? (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
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
                  <Term id={c.key} label={false} />
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

    </div>
  ) : (
    <div className="flex flex-col gap-6">
      {score.components.length > 0 && (
        <details open className="group rounded-xl border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">
            KPIs <span className="text-muted-foreground group-open:hidden">↓</span>
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

      <details open className="group rounded-xl border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">{span(snapshot.windowStart, snapshot.windowEnd)}</summary>
        <div className="grid gap-x-6 px-4 pb-4 text-xs sm:grid-cols-2">
          {ROWS.map(([label, m]) => (
            <div key={label} className="flex items-center justify-between gap-2 border-t py-1.5">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular flex items-center gap-2">
                {fmt(snapshot.metrics[m].value, m === "avgWatchSec" || m === "spend" ? 1 : 0)}
                <SourceBadge source={snapshot.metrics[m].source} />
              </span>
            </div>
          ))}
          <div className="col-span-full mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cond label="Spend" v={score.conditions.spend != null ? `$${fmt(score.conditions.spend, 2)}` : "—"} />
            <Cond label="Impressions (1k)" v={score.conditions.cpm != null ? `$${fmt(score.conditions.cpm, 2)}` : "—"} />
            <Cond label="3s play" v={score.conditions.costPerPlay != null ? `$${fmt(score.conditions.costPerPlay, 3)}` : "—"} />
            <Cond label="Per Person" v={fmt(score.conditions.frequency, 2)} />
          </div>
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
