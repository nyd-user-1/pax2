import { PlaySquare } from "lucide-react"

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
    <div className="flex flex-col gap-8">
      <section className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-slate-900">Connect a partner channel</p>
          <p className="max-w-xl text-sm text-slate-600">One OAuth grant with the yt-analytics.readonly scope hands over the seed-phase telemetry for every video the partner publishes: retention curves, viewed-vs-swiped, average percentage viewed. Free, no ad spend.</p>
        </div>
        <button type="button" disabled title="Awaiting the first partner channel" className="flex items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white opacity-50">
          <PlaySquare className="size-4" /> Connect with YouTube
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-slate-900">What the readout becomes</h2>
          <span className="rounded-full bg-pax-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax-red-deep">Sample data</span>
        </div>
        <div className="surface flex flex-col gap-5 p-6">
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">The same score, re-based</h2>
        <div className="surface overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr className="[&_th]:whitespace-nowrap [&_th]:px-5 [&_th]:py-2.5 [&_th]:font-medium">
                <th>Component</th>
                <th>The question it answers</th>
                <th>Fed today by paid results</th>
                <th>Fed tomorrow by the channel</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((m) => (
                <tr key={m.component} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-5 py-3 font-semibold text-pax-ink">{m.component}</td>
                  <td className="px-5 py-3 text-slate-600">{m.question}</td>
                  <td className="px-5 py-3 text-slate-600">{m.paid}</td>
                  <td className="px-5 py-3 text-slate-900">{m.organic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">The snapshot shape and the scoring math stay as built; only the source of the numbers changes.</p>
      </section>
    </div>
  )
}
