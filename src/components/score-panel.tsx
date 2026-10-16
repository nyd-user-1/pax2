import { fmt, pct, RangeBar } from "@/components/bits"
import { Term } from "@/components/term"
import type { TakeInfo } from "@/lib/catalog"
import { COMPONENTS, logit, rawCounts, type Reference, type Score } from "@/lib/resonance"
import type { MetricKey, Snapshot } from "@/lib/types"
import { cn } from "@/ui/lib/utils"

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

const MONTH = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]

/** "Oct. 6 - 10 2026", or across months "Sept. 20 - Oct. 16 2026". */
function span(start: string, end: string) {
  const a = new Date(`${start}T12:00:00Z`)
  const b = new Date(`${end}T12:00:00Z`)
  const right = a.getUTCMonth() === b.getUTCMonth() ? `${b.getUTCDate()}` : `${MONTH[b.getUTCMonth()]} ${b.getUTCDate()}`
  return `${MONTH[a.getUTCMonth()]} ${a.getUTCDate()} - ${right} ${b.getUTCFullYear()}`
}

/** The score, its components, and one complete trace from raw records to the number. */
export function ScorePanel({ take, snapshot, score, reference, part }: { take: TakeInfo; snapshot: Snapshot; score: Score; reference: Reference; part: "summary" | "detail" }) {
  const raws = rawCounts(snapshot, take)
  return part === "summary" ? (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        {score.status === "unscorable" || score.value == null ? (
          <span className="text-2xl text-muted-foreground">Not scored</span>
        ) : (
          <span className="tabular font-display text-6xl leading-none text-pax2-blue">{score.value.toFixed(0)}</span>
        )}
        <div className="min-w-0 flex-1">
          {score.value != null && <RangeBar value={score.value} low={score.low} high={score.high} />}
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>50 = reference average</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {score.components.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {score.components.map((c) => (
            <div key={c.key} className="flex flex-col gap-2 surface p-3">
              <span className="font-medium text-pax2-blue">{COMPONENTS.find((x) => x.key === c.key)!.name}</span>
              {c.score != null ? (
                <>
                  <span className="tabular font-display text-3xl text-pax2-blue">{c.score.toFixed(0)}</span>
                  <RangeBar value={c.score} low={c.low} high={c.high} />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Missing</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      {score.components.length > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {score.components.map((c) => {
            const rows: [string, string, boolean?][] = [
              ["Counts", fmt(raws[c.key]?.x)],
              ["Rate", pct(c.rate, 2)],
              ["Ref. avg", pct(reference.pooled[c.key], 2)],
              ["Weighted", pct(c.shrunk, 2)],
              ["Distance", c.shrunk != null ? ((logit(c.shrunk) - reference.mean[c.key]) / reference.sd[c.key]).toFixed(2) : "—"],
              ["Score", c.score?.toFixed(1) ?? "—"],
              ["Weight", c.contribution?.toFixed(1) ?? "—"],
              ["Resonance", score.value?.toFixed(1) ?? "—", true],
            ]
            return (
              <div key={c.key} className="rounded-xl border px-4 py-3">
                <p className="flex items-center gap-1.5 pb-2 font-medium text-pax2-blue">
                  {COMPONENTS.find((x) => x.key === c.key)!.name}
                  <Term id={c.key} label={false} />
                </p>
                {rows.map(([label, v, total]) => (
                  <div key={label} className={cn("tabular grid grid-cols-2 border-t py-2 text-sm", total ? "font-semibold text-pax2-blue" : "")}>
                    <span className={total ? "" : "text-muted-foreground"}>{label}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border px-4 py-3">
        <p className="pb-2 font-medium text-pax2-blue">{span(snapshot.windowStart, snapshot.windowEnd)}</p>
        <div className="grid grid-cols-2 gap-x-6 text-sm">
          {ROWS.map(([label, m]) => (
            <div key={label} className="flex items-center justify-between gap-2 border-t py-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular">{fmt(snapshot.metrics[m].value, m === "avgWatchSec" || m === "spend" ? 1 : 0)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Cond label="Spend" v={score.conditions.spend != null ? `$${fmt(score.conditions.spend, 2)}` : "—"} />
          <Cond label="Impressions (1k)" v={score.conditions.cpm != null ? `$${fmt(score.conditions.cpm, 2)}` : "—"} />
          <Cond label="3s play" v={score.conditions.costPerPlay != null ? `$${fmt(score.conditions.costPerPlay, 3)}` : "—"} />
          <Cond label="Per Person" v={fmt(score.conditions.frequency, 2)} />
        </div>
      </div>
    </div>
  )
}

function Cond({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-base text-pax2-blue">{v}</div>
    </div>
  )
}
