import { PlaySquare } from "lucide-react"

import { ChartBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { endgameSample, fmtCompact } from "@/lib/lab"

export const metadata = { title: "Endgame" }

function Retention({ points }: { points: number[] }) {
  const W = 640
  const H = 150
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * W},${H - (p / 100) * (H - 10)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Audience retention across the video">
      {[100, 50, 0].map((g) => (
        <g key={g}>
          <line x1={0} y1={H - (g / 100) * (H - 10)} x2={W} y2={H - (g / 100) * (H - 10)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={0} y={H - (g / 100) * (H - 10) - 4} fontSize="10" fill="#94a3b8" className="tabular">{g}%</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" className="grow-svg" />
      <text x={W * 0.08} y={H * 0.33} fontSize="11" fill="#dc2626">the hook drop</text>
      <text x={0} y={H + 14} fontSize="10" fill="#94a3b8" className="tabular">start</text>
      <text x={W} y={H + 14} textAnchor="end" fontSize="10" fill="#94a3b8" className="tabular">end</text>
    </svg>
  )
}

const MAPPING = [
  { component: "Engage", question: "Did the opening stop the scroll?", paid: "3-second plays over impressions, Ads Manager", organic: "Viewed vs. swiped away, YouTube Analytics API" },
  { component: "Interest", question: "Did people watch 50% or more?", paid: "Average watch time over duration", organic: "Average percentage viewed and the retention curve" },
  { component: "Act", question: "Did viewers do something?", paid: "Clicks over impressions", organic: "Likes, comments and shares per thousand views" },
]

export default function EndgamePage() {
  const s = endgameSample()
  return (
    <div className="flex flex-col">
      <section className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-slate-900">Connect a partner channel</p>
          <p className="max-w-xl text-sm text-slate-600">One OAuth grant with the yt-analytics.readonly scope hands over the seed-phase telemetry for every video the partner publishes: retention curves, viewed-vs-swiped, average percentage viewed. Free, no ad spend.</p>
        </div>
        <button type="button" disabled title="Awaiting the first partner channel" className="flex items-center gap-2 rounded-full bg-pax2-ink px-5 py-2.5 text-sm font-semibold text-white opacity-50">
          <PlaySquare className="size-4" /> Connect with YouTube
        </button>
      </section>

      <BlockOrder page="endgame" initial={["readout", "rebased"]}>
        <OrderedBlock id="readout" label="What the readout becomes">
          <ChartBlock title="What the readout becomes" tools={<span className="rounded-full bg-pax2-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax2-red-deep">Sample data</span>}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg text-slate-900">{s.title}</p>
                <p className="tabular text-sm text-slate-500">{s.channel} · {fmtCompact(s.views)} views</p>
              </div>
              <Retention points={s.retention} />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  { label: "Viewed vs. swiped", value: `${s.viewedVsSwiped}%` },
                  { label: "Avg. % viewed", value: `${s.avgPctViewed}%` },
                  { label: "Likes / 1k", value: s.likesPer1k.toFixed(1) },
                  { label: "Comments / 1k", value: s.commentsPer1k.toFixed(1) },
                  { label: "Shares / 1k", value: s.sharesPer1k.toFixed(1) },
                ].map((x) => (
                  <span key={x.label} className="flex flex-col">
                    <span className="tabular text-lg font-semibold text-slate-900">{x.value}</span>
                    <span className="text-xs text-slate-500">{x.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </ChartBlock>
        </OrderedBlock>

        <OrderedBlock id="rebased" label="The same score, re-based">
          <TableBlock title="The same score, re-based" rows={MAPPING} name="re-based">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="bg-muted/60 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:font-medium [&_th]:text-foreground">
                  <th>Component</th>
                  <th>The question it answers</th>
                  <th>Fed today by paid results</th>
                  <th>Fed tomorrow by the channel</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map((m) => (
                  <tr key={m.component} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-pax2-ink">{m.component}</td>
                    <td className="px-4 py-3 text-slate-600">{m.question}</td>
                    <td className="px-4 py-3 text-slate-600">{m.paid}</td>
                    <td className="px-4 py-3 text-slate-900">{m.organic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pt-3 text-xs text-slate-500">The snapshot shape and the scoring math stay as built; only the source of the numbers changes.</p>
          </TableBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
