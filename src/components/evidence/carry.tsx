import { ListBlock } from "@/components/blocks"
import { featureFlagsFor, featureLift } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

// What the pushed videos carry that the rest don't, moved from /evidence onto the video page
// (2026-10-22), directly after the video's evaluation. The catalog's lift rows stay as they were; a
// row this video carries is marked, so the list reads against the video in view.

export function CarryBlock({ ytId }: { ytId: string }) {
  const { rows, analyzed, breakouts } = featureLift()
  const flags = featureFlagsFor(ytId)
  return (
    <ListBlock
      title="What the pushed videos carry that the rest don’t"
      id="carry"
      height="auto"
      search="Search features…"
      rows={rows.map((r) => ({ feature: r.label, pushed: Math.round(r.breakout * 100), rest: Math.round(r.rest * 100), lift: Number(r.lift.toFixed(2)), ...(flags && { thisVideo: !!flags[r.key] }) }))}
      name={`carry-${ytId}`}
    >
      <div className="@container flex flex-col divide-y divide-slate-100">
        {rows.map((r) => {
          const has = flags?.[r.key]
          return (
            <div key={r.key} data-find className="grid items-center gap-x-4 gap-y-2 py-3 @md:grid-cols-[1fr_180px_64px]">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                {r.label}
                {has && <span className="rounded-full bg-pax2-lavender px-2 py-0.5 text-[10px] font-semibold text-pax2-blue">This video</span>}
              </span>
              <span className="flex flex-col gap-1">
                {[
                  { share: r.breakout, color: "bg-above", label: "pushed" },
                  { share: r.rest, color: "bg-slate-300", label: "rest" },
                ].map((b) => (
                  <span key={b.label} className="flex items-center gap-2">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                      <span className={cn("block h-full rounded-full", b.color)} style={{ width: `${Math.round(b.share * 100)}%` }} />
                    </span>
                    <span className="tabular text-xs text-slate-500">
                      {Math.round(b.share * 100)}% {b.label}
                    </span>
                  </span>
                ))}
              </span>
              <span className={cn("tabular justify-self-start rounded-full px-2.5 py-1 text-sm font-semibold @md:justify-self-end", r.lift >= 1.5 ? "bg-above-soft text-above" : r.lift <= 0.7 ? "bg-below-soft text-below" : "bg-slate-100 text-slate-600")}>{r.lift.toFixed(1)}x</span>
            </div>
          )
        })}
      </div>
      <p className="pt-3 text-xs text-slate-500">
        Lift is the smoothed share among pushed videos over the share among everything else, from the {analyzed} analyzed videos. With {breakouts} pushed, anything under about 2x reads as noise until the catalog grows.
      </p>
    </ListBlock>
  )
}
