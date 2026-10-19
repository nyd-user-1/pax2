import shorts from "../../../data/raw/yt-shorts.json"
import upworthyTop from "../../../data/generated/upworthy-top.json"
import { ListBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { Stat2 } from "@/components/dash/stats"
import { featureLift } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

// The Feature lift tab of /evidence: what the pushed videos carry that the rest don't.

const VIEWS_AS_OF = `Views as of ${new Date((shorts as { fetchedAt: string }).fetchedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`

type Pattern = { key: string; label: string; won: number; lost: number }

export function LiftTab() {
  const { rows, analyzed, breakouts, killed } = featureLift()
  const priors = ((upworthyTop as unknown as { patterns: Pattern[] }).patterns ?? []).filter((p) => ["question", "watch", "caps"].includes(p.key))
  return (
    <div className="flex flex-col">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Analyzed", value: analyzed, note: "videos through the pipeline" },
          { title: "> 3x", value: breakouts, note: "of their channel's views" },
          { title: "< .5x", value: killed, note: "of their channel's views" },
        ].map((t) => (
          <Stat2 key={t.title} title={t.title} value={t.value} footer={t.note} />
        ))}
      </div>

      <BlockOrder page="feature-lift" initial={priors.length > 0 ? ["carry", "priors"] : ["carry"]}>
        <OrderedBlock id="carry" label="What the pushed videos carry that the rest don’t">
          <ListBlock title="What the pushed videos carry that the rest don’t" id="carry" search="Search features…" rows={rows.map((r) => ({ feature: r.label, pushed: Math.round(r.breakout * 100), rest: Math.round(r.rest * 100), lift: Number(r.lift.toFixed(2)) }))} name="feature-lift" footer={VIEWS_AS_OF}>
            <div className="flex flex-col divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.key} data-find className="grid items-center gap-x-6 gap-y-2 py-4 sm:grid-cols-[1fr_220px_84px]">
                  <span className="text-sm font-medium text-slate-900">{r.label}</span>
                  <span className="flex flex-col gap-1.5">
                    {[
                      { share: r.breakout, color: "bg-above", label: "pushed" },
                      { share: r.rest, color: "bg-slate-300", label: "rest" },
                    ].map((b) => (
                      <span key={b.label} className="flex items-center gap-2">
                        <span className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                          <span className={cn("block h-full rounded-full", b.color)} style={{ width: `${Math.round(b.share * 100)}%` }} />
                        </span>
                        <span className="tabular text-xs text-slate-500">{Math.round(b.share * 100)}% {b.label}</span>
                      </span>
                    ))}
                  </span>
                  <span
                    className={cn(
                      "tabular justify-self-start rounded-full px-2.5 py-1 text-sm font-semibold sm:justify-self-end",
                      r.lift >= 1.5 ? "bg-above-soft text-above" : r.lift <= 0.7 ? "bg-below-soft text-below" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {r.lift.toFixed(1)}x
                  </span>
                </div>
              ))}
            </div>
            <p className="pt-3 text-xs text-slate-500">Lift is the smoothed share among pushed videos over the share among everything else, from the {analyzed} analyzed videos. With {breakouts} pushed, treat anything under about 2x as noise until the catalog grows.</p>
          </ListBlock>
        </OrderedBlock>

        {priors.length > 0 && (
          <OrderedBlock id="priors" label="Causal priors from 32,487 randomized headline tests">
            <ListBlock title="Causal priors from 32,487 randomized headline tests" id="priors" rows={priors.map((p) => ({ pattern: p.label, winners: p.won, losers: p.lost }))} name="headline-priors">
              <div className="flex flex-col divide-y divide-slate-100">
                {priors.map((p) => (
                  <div key={p.key} data-find className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <span className="text-sm font-medium text-slate-900">{p.label}</span>
                    <span className="tabular text-sm text-slate-600">{p.won}% of winners · {p.lost}% of losers</span>
                  </div>
                ))}
              </div>
              <p className="pt-3 text-xs text-slate-500">Upworthy archive, same story tested with different wording. The one place the evidence is randomized rather than observational.</p>
            </ListBlock>
          </OrderedBlock>
        )}
      </BlockOrder>
    </div>
  )
}
