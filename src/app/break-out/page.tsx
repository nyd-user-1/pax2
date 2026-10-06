import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import { channelSummaries, fmtCompact, labVideos, type Tier } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Breakout" }

const TIER: Record<Tier, { label: string; chip: string; dot: string }> = {
  breakout: { label: "Pushed", chip: "bg-above-soft text-above", dot: "#16a34a" },
  baseline: { label: "Baseline", chip: "bg-slate-100 text-slate-500", dot: "#94a3b8" },
  killed: { label: "Killed", chip: "bg-below-soft text-below", dot: "#dc2626" },
}

const X_MIN = Math.log10(0.04)
const X_MAX = Math.log10(120)
const x = (ratio: number) => ((Math.log10(Math.max(0.04, Math.min(120, ratio))) - X_MIN) / (X_MAX - X_MIN)) * 760 + 20

function Scatter() {
  const chans = channelSummaries()
  const vids = labVideos()
  const H = chans.length * 46 + 34
  return (
    <svg viewBox={`0 0 800 ${H}`} className="w-full" role="img" aria-label="Every video's views against its channel's median">
      {[0.5, 1, 3].map((g) => (
        <g key={g}>
          <line x1={x(g)} y1={8} x2={x(g)} y2={H - 26} stroke={g === 1 ? "#94a3b8" : "#cbd5e1"} strokeWidth={g === 1 ? 1.5 : 1} strokeDasharray={g === 1 ? undefined : "3 4"} />
          <text x={x(g)} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748b" className="tabular">{g}x</text>
        </g>
      ))}
      {chans.map((c, i) => {
        const y = i * 46 + 30
        return (
          <g key={c.id}>
            <text x={20} y={y - 14} fontSize="11.5" fill="#475569">{c.name}</text>
            {vids.filter((v) => v.channelId === c.id).map((v) => (
              <circle key={v.id} cx={x(v.ratio)} cy={y} r={4.5} fill={TIER[v.tier].dot} fillOpacity={0.75}>
                <title>{`${v.title} - ${fmtCompact(v.views)} views, ${v.ratio.toFixed(1)}x median`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function BreakoutPage() {
  const chans = channelSummaries()
  const vids = labVideos()
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {chans.map((c) => (
          <div key={c.id} className="surface flex flex-col gap-1 p-5">
            <span className="text-sm font-medium text-pax-ink">{c.name}</span>
            <span className="tabular mt-1 text-sm text-slate-600">
              <b className="font-display text-2xl font-normal text-pax-ink">{c.breakouts}</b> pushed of {c.n}
            </span>
            <span className="tabular text-xs text-slate-500">{c.killed} killed · median {fmtCompact(c.median)} views</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-slate-900">The seed verdict, read off each catalog</h2>
          <span className="flex items-center gap-4 text-xs text-slate-500">
            {(Object.keys(TIER) as Tier[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: TIER[t].dot }} /> {TIER[t].label}
              </span>
            ))}
          </span>
        </div>
        <div className="surface p-5">
          <Scatter />
          <p className="pt-2 text-xs text-slate-500">Each dot is one video, placed by views over its channel&apos;s median (log scale). Past 3x the explore phase pushed it; under 0.5x it was killed.</p>
        </div>
      </section>

      <TableBlock
        title={`All ${vids.length} videos`}
        id="videos"
        search="Search videos…"
        rows={vids.map((v) => ({ video: v.title, channel: v.channel, views: v.views, median: Math.round(v.channelMedian), ratio: `${v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x`, verdict: TIER[v.tier].label }))}
        name="videos"
      >
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="bg-muted/60 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium">
                <th>Video</th>
                <th>Channel</th>
                <th className="!text-right">Views</th>
                <th className="!text-right">Channel median</th>
                <th className="!text-right">Ratio</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {vids.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="max-w-80 px-4 py-2.5">
                    <Link href={`/v/yt-${v.id}`} className="line-clamp-1 font-sans text-slate-900 hover:text-pax-plum">{v.title}</Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{v.channel}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{v.views.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{Math.round(v.channelMedian).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TIER[v.tier].chip)}>{TIER[v.tier].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </TableBlock>
    </div>
  )
}
