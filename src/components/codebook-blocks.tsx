import model from "../../data/generated/model/reference-model.json"
import upworthy from "../../data/generated/upworthy-top.json"
import wesleyan from "../../data/generated/wesleyan-meta-2022.json"
import { RangeBar } from "@/components/bits"
import { CardBlock, ListBlock, TableBlock } from "@/components/blocks"
import { Term } from "@/components/term"
import { titlePatterns } from "@/lib/headline-patterns"
import { cn } from "@/ui/lib/utils"

/** A video's coding on the two ad codebooks: Swayable's feature keys and Wesleyan's goal. */
export type Codes = { swayable?: string[]; wesleyan?: "persuade" | "money" | "both" | "neither" }

type Feature = { key: string; label: string; diff: number; low: number; high: number }

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

const pts = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`

/** Swayable: what persuades. Each of the video's traits beside the vote-choice shift Swayable's
 *  randomized tests measured for ads with it over ads without it. */
export function SwayableBlock({ codes, footer }: { codes: string[]; footer?: string }) {
  const out = model.outcomes.votechoice
  const features = codes.map((k) => (out.features as Feature[]).find((f) => f.key === k)).filter((f): f is Feature => !!f)
  // −1.5 to +1.5 points across the bar, zero in the middle.
  const at = (x: number) => Math.min(100, Math.max(0, ((x + 1.5) / 3) * 100))
  return (
    <ListBlock title="Swayable" tools={<Term id="swayable" label={false} />} height="auto" footer={footer}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Figure value={`+${out.meanEffect.toFixed(1)} pts`} label="Vote choice, average tested ad" />
          <Figure value={`${Math.round(out.shareAboveZero * 100)}%`} label="Ads that moved voters their way" />
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {features.map((f) => (
            <div key={f.key} className="grid items-center gap-x-6 gap-y-1.5 py-3 @lg:grid-cols-[1fr_200px_110px]">
              <span className="text-sm font-medium text-slate-900">{f.label}</span>
              <RangeBar value={at(f.diff)} low={at(f.low)} high={at(f.high)} />
              <span className="tabular text-sm text-slate-600 @lg:text-right">
                {pts(f.diff)} <span className="text-xs text-slate-400">({pts(f.low)} to {pts(f.high)})</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {out.ads} ads in {out.studies} randomized studies, 2018–2020. Points of vote choice, ads with the trait against ads without it. Together the traits predict almost none of the gap between one ad and the next; only a test does.
        </p>
      </div>
    </ListBlock>
  )
}

const GOALS: Record<string, string> = { persuade: "Persuade", money: "Raise money", both: "Both", neither: "Neither" }

/** Wesleyan: what everyone else ran. The video's goal set among every pro-Democratic video ad
 *  Meta carried in 2022, by count, money and reach. */
export function WesleyanBlock({ goal, footer }: { goal: string; footer?: string }) {
  return (
    <TableBlock title="Wesleyan" tools={<Term id="wesleyan" label={false} />} height="auto" footer={footer}>
      <div className="flex flex-col gap-6">
        <Figure value={GOALS[goal]} label="Goal" />
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                <th>Goal</th>
                <th>Ads</th>
                <th>Spend</th>
                <th>Median impressions</th>
              </tr>
            </thead>
            <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6">
              {wesleyan.goals.map((g) => (
                <tr key={g.key} className={cn(g.key === goal && "bg-pax2-light-blue/10 font-medium text-slate-900")}>
                  <td className="pl-2">{GOALS[g.key]}</td>
                  <td>{g.adShare}%</td>
                  <td>{g.spendShare}%</td>
                  <td>{g.medianImpressions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          {wesleyan.ads.toLocaleString("en-US")} pro-Democratic video ads on Meta in 2022, ${Math.round(wesleyan.spend / 1e6)} million in spend.
        </p>
      </div>
    </TableBlock>
  )
}

/** Upworthy: what wins the click. The video's title read against the wording patterns of
 *  Upworthy's randomized headline tests: how often each shows up in winners and in losers. */
export function UpworthyBlock({ title }: { title: string }) {
  const patterns = titlePatterns(title)
  return (
    <ListBlock title="Upworthy" tools={<Term id="upworthy" label={false} />} height="auto">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Figure value={`${upworthy.swing}×`} label="Clicks, best headline over worst" />
          <Figure value={upworthy.counts.tests.toLocaleString("en-US")} label="Headline tests" />
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {patterns.map((p) => (
            <div key={p.key} className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5", !p.has && "text-slate-400")}>
              <span className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 shrink-0 rounded-full", p.has ? "bg-pax2-light-blue" : "border border-slate-300")} />
                <span className={cn(p.has && "font-medium text-slate-900")}>{p.label}</span>
              </span>
              <span className={cn("tabular text-xs", p.has ? "text-slate-600" : "text-slate-400")}>
                {p.won}% of winners · {p.lost}% of losers
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">The same story under different headlines, shown at random, 2013–2015.</p>
      </div>
    </ListBlock>
  )
}
