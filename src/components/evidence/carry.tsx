import { Info } from "lucide-react"

import { ListBlock } from "@/components/blocks"
import { GrowBar } from "@/components/grow-bar"
import { Hint } from "@/components/hint"
import { featureFlagsFor, featureLift } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

// The feature index, moved from /evidence onto the video page (2026-10-22), directly after the video's
// evaluation: for each feature, its share among the shorts that outperformed 3x against its share among
// the rest. An index is the audience-research measure of over-representation: 2.1x (index 210) means
// twice as common among outperformers. A row this video carries is marked, so the list reads against
// the video in view.

export function CarryBlock({ ytId }: { ytId: string }) {
  const { rows, analyzed, breakouts } = featureLift()
  const flags = featureFlagsFor(ytId)
  return (
    <ListBlock
      title="Feature index"
      id="carry"
      height="max"
      search="Search features…"
      tools={
        <Hint text="An index compares how often a feature appears among shorts that outperformed 3x with how often it appears among the rest. 2.0x (index 200) means twice as common among outperformers; 1.0x is no difference. The bar is the share of outperformers that carry the feature.">
          <Info className="size-4 text-slate-400" />
        </Hint>
      }
      rows={rows.map((r) => ({ feature: r.label, outperformers: Math.round(r.breakout * 100), rest: Math.round(r.rest * 100), index: Number(r.lift.toFixed(2)), ...(flags && { thisVideo: !!flags[r.key] }) }))}
      name={`carry-${ytId}`}
    >
      <div className="@container flex flex-col divide-y divide-slate-100">
        {rows.map((r, i) => {
          const has = flags?.[r.key]
          const share = Math.round(r.breakout * 100)
          return (
            <div key={r.key} data-find className="grid items-center gap-x-4 gap-y-2 py-3 @md:grid-cols-[1fr_200px_3rem_64px]">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                {r.label}
                {has && <span className="rounded-full bg-pax2-lavender px-2 py-0.5 text-[10px] font-semibold text-pax2-blue">This video</span>}
              </span>
              <GrowBar value={share} i={i} tone="green" title={`${share}% of outperformers, ${Math.round(r.rest * 100)}% of the rest`} />
              <span className="tabular text-right text-xs text-slate-500">{share}%</span>
              <span className={cn("tabular justify-self-start rounded-full px-2.5 py-1 text-sm font-semibold @md:justify-self-end", r.lift >= 1.5 ? "bg-above-soft text-above" : r.lift <= 0.7 ? "bg-below-soft text-below" : "bg-slate-100 text-slate-600")}>{r.lift.toFixed(1)}x</span>
            </div>
          )
        })}
      </div>
      <p className="pt-3 text-xs text-slate-500">
        The index is the smoothed share among shorts that outperformed 3x over the share among the rest, from the {analyzed} analyzed videos. With {breakouts} outperformers, anything under about 2x reads as noise until the catalog grows.
      </p>
    </ListBlock>
  )
}
