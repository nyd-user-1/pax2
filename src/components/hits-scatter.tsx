// Every catalog short as a dot: publish date across, views over its channel's median up (log scale),
// green for a Hit, red for a Miss. Each dot links to its curve. Shown on /break-out and on every video.

import { labVideos, type Tier } from "@/lib/lab"

export const TIER: Record<Tier, { label: string; chip: string; dot: string }> = {
  breakout: { label: "Pushed", chip: "bg-above-soft text-above", dot: "#16a34a" },
  baseline: { label: "Baseline", chip: "bg-slate-100 text-slate-500", dot: "#94a3b8" },
  killed: { label: "Killed", chip: "bg-below-soft text-below", dot: "#dc2626" },
}

const R_MIN = Math.log10(0.04)
const R_MAX = Math.log10(120)
const W = 1100
const H = 460
const L = 44
const B = 28
const y = (ratio: number) => 10 + (1 - (Math.log10(Math.max(0.04, Math.min(120, ratio))) - R_MIN) / (R_MAX - R_MIN)) * (H - B - 10)

export function HitsScatter() {
  const vids = labVideos()
  const times = vids.map((v) => Date.parse(v.published))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const x = (iso: string) => L + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - L - 12)
  const start = new Date(t0)
  const ticks: string[] = []
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 6) * 6 + 6, 1)); d.getTime() <= t1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, 1))) ticks.push(d.toISOString())
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Every video's views over its channel's median, by publish date">
      {[0.1, 0.5, 1, 3, 10, 100].map((g) => (
        <g key={g}>
          <line x1={L} y1={y(g)} x2={W - 12} y2={y(g)} stroke={g === 1 ? "#94a3b8" : "#cbd5e1"} strokeWidth={g === 1 ? 1.5 : 1} strokeDasharray={g === 0.5 || g === 3 ? "3 4" : g === 1 ? undefined : "1 5"} />
          <text x={L - 8} y={y(g) + 3.5} textAnchor="end" fontSize="11" fill="#64748b" className="tabular">{g}x</text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
          {new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
        </text>
      ))}
      {vids.map((v) => (
        <a key={v.id} href={`/velocity-tracker?v=${v.id}`}>
          <circle cx={x(v.published)} cy={y(v.ratio)} r={4.5} fill={TIER[v.tier].dot} fillOpacity={0.75} className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-100">
            <title>{`${v.title}\n${v.channel} · ${new Date(v.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}\n${v.views.toLocaleString()} views, ${v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x the channel median · ${TIER[v.tier].label}`}</title>
          </circle>
        </a>
      ))}
    </svg>
  )
}
