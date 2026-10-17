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

/** Upworthy's headline tests read against this video's title: each pattern's lift — its share of winning
 *  headlines minus its share of losing ones, in points — on a bar centred at zero, strongest first, the
 *  patterns this title carries picked out. */
export function UpworthyBlock({ title }: { title: string }) {
  const patterns = titlePatterns(title)
    .map((p) => ({ ...p, lift: Number(p.won) - Number(p.lost) }))
    .sort((a, b) => b.lift - a.lift)
  const reach = Math.max(...patterns.map((p) => Math.abs(p.lift)), 0.1)
  const carried = patterns.filter((p) => p.has)
  const net = carried.reduce((t, p) => t + p.lift, 0)
  return (
    <ListBlock title="Upworthy" tools={<Term id="upworthy" label={false} />} height="auto" footer="The same story under different headlines, shown at random, 2013–2015.">
      <div className="@container flex flex-col gap-6 pb-2">
        <div className="grid grid-cols-2 gap-4 @lg:grid-cols-3">
          <Figure value={`${upworthy.swing}×`} label="Clicks, best headline over worst" />
          <Figure value={upworthy.counts.tests.toLocaleString("en-US")} label="Headline tests" />
          <Figure value={carried.length ? `${net >= 0 ? "+" : ""}${net.toFixed(1)} pts` : "None"} label={`This title: ${carried.length} of ${patterns.length} patterns`} />
        </div>
        <ul className="flex flex-col gap-1">
          {patterns.map((p) => {
            const tone = p.lift > 0.05 ? "bg-green-600" : p.lift < -0.05 ? "bg-red-600" : "bg-slate-300"
            const width = `${(Math.abs(p.lift) / reach) * 50}%`
            return (
              <li key={p.key} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-2.5 py-2 @lg:grid-cols-[minmax(0,1fr)_8rem_4.5rem]", p.has && "bg-pax2-lavender/60")}>
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", p.has ? "bg-pax2-blue" : "border border-slate-300")} />
                  <span className={cn("truncate", p.has ? "font-medium text-slate-900" : "text-slate-800")}>{p.label}</span>
                </span>
                {/* The lift, from a centre line: right for patterns more common among winners, left for losers. */}
                <span aria-hidden className="relative col-span-2 h-1.5 rounded-full bg-slate-100 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-300" />
                  <span className={cn("absolute inset-y-0 rounded-full", tone)} style={p.lift >= 0 ? { left: "50%", width } : { right: "50%", width }} />
                </span>
                <span className="tabular row-start-1 text-right @lg:col-start-3">
                  <span className={cn("block text-sm font-semibold", p.lift > 0.05 ? "text-green-700" : p.lift < -0.05 ? "text-red-700" : "text-slate-800")}>
                    {p.lift > 0 ? "+" : ""}
                    {p.lift.toFixed(1)} pts
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {p.won}% vs {p.lost}%
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </ListBlock>
  )
}
