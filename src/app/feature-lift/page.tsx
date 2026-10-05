import upworthyTop from "../../../data/generated/upworthy-top.json"
import { featureLift } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Feature lift" }

type Pattern = { key: string; label: string; won: number; lost: number }

export default function FeatureLiftPage() {
  const { rows, analyzed, breakouts, killed } = featureLift()
  const priors = ((upworthyTop as unknown as { patterns: Pattern[] }).patterns ?? []).filter((p) => ["question", "watch", "caps"].includes(p.key))
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-2">
        {[
          `${analyzed} videos through the pipeline`,
          `${breakouts} pushed by the algorithm`,
          `${killed} killed in explore`,
        ].map((t) => (
          <span key={t} className="tabular rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-e1">{t}</span>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">What the pushed videos carry that the rest don&apos;t</h2>
        <div className="surface flex flex-col divide-y divide-slate-100 p-0">
          {rows.map((r) => (
            <div key={r.key} className="grid items-center gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[1fr_220px_84px]">
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
        <p className="text-xs text-slate-500">Lift is the smoothed share among pushed videos over the share among everything else, from the {analyzed} analyzed videos. With {breakouts} pushed, treat anything under about 2x as noise until the catalog grows.</p>
      </section>

      {priors.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-slate-900">Causal priors from 32,487 randomized headline tests</h2>
          <div className="surface flex flex-col divide-y divide-slate-100 p-0">
            {priors.map((p) => (
              <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span className="text-sm font-medium text-slate-900">{p.label}</span>
                <span className="tabular text-sm text-slate-600">{p.won}% of winners · {p.lost}% of losers</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Upworthy archive, same story tested with different wording. The one place the evidence is randomized rather than observational.</p>
        </section>
      )}
    </div>
  )
}
