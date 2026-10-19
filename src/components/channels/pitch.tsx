import { endgameSample, fmtCompact } from "@/lib/lab"

// The empty state of /channels, carried over from the retired /endgame page: what one connected
// channel's readout looks like, on sample numbers until a real channel is connected.

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

export function ChannelsPitch() {
  const s = endgameSample()
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-pax2-red-soft px-2.5 py-0.5 text-xs font-semibold text-pax2-red-deep">Sample data</span>
        <p className="text-sm text-slate-600">One read-only grant brings this for every video the channel publishes: retention curves, viewed-vs-swiped, average percentage viewed. Free, no ad spend.</p>
      </div>
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
  )
}
