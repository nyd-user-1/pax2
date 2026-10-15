import Link from "next/link"

import { tierOf, type PollRow } from "@/lib/lab"
import { CURVE_TIER as TIER } from "@/lib/velocity-meta"

import { TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { baselines, recentPolls } from "@/lib/velocity-store"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Live Tracking" }
export const dynamic = "force-dynamic"

type Watched = { id: string; channel: string; title: string; age: number; views: number; ratio: number | null; series: [number, number][] }

/** Every watched short from the poller's rows, with its latest count and its readings inside the 72-hour window. */
function watched(rows: PollRow[], medians: Record<string, { median: number | null }>): Watched[] {
  const by = new Map<string, PollRow[]>()
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r])
  const now = Date.now()
  return [...by.values()].map((rs) => {
    const sorted = rs.sort((a, b) => a.hour - b.hour)
    const last = sorted.at(-1)!
    const m = medians[last.channelId]?.median
    // One reading per hour, and a cumulative count never falls - dips in the readings are API noise.
    const hourly = new Map<number, PollRow>()
    for (const r of sorted) if (r.hour <= 72) hourly.set(Math.floor(r.hour), r)
    let peak = 0
    return {
      id: last.id,
      channel: last.channel,
      title: last.title.replace(/\s*#\w+/g, "").trim() || last.title,
      age: (now - Date.parse(last.published)) / 3_600_000,
      views: last.views,
      ratio: m ? last.views / m : null,
      series: [...hourly.values()].map((r) => [r.hour, (peak = Math.max(peak, r.views))]),
    }
  })
}

/** Views over the 0–72 hour window on one shared time axis, so rows compare across the table. */
function Spark({ series, color }: { series: [number, number][]; color: string }) {
  const W = 88
  const H = 22
  const max = Math.max(...series.map(([, v]) => v), 1)
  const r1 = (n: number) => Math.round(n * 10) / 10
  const pts = series.map(([h, v]) => `${r1((h / 72) * W)},${r1(H - 2 - (v / max) * (H - 4))}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[22px] w-[88px] shrink-0" aria-hidden>
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#e2e8f0" />
      {series.length > 1 ? <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx={(series[0][0] / 72) * W} cy={H - 2 - (series[0][1] / max) * (H - 4)} r="1.75" fill={color} />}
    </svg>
  )
}

const times = (r: number | null) => (r == null ? "-" : `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}×`)

export default async function LiveTrackingPage() {
  const [rows, medians] = await Promise.all([recentPolls(7), baselines()])
  const all = watched(rows, medians)
  const inProgress = all.filter((w) => w.age < 72).sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))
  const complete = all.filter((w) => w.age >= 72).sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))
  const lastPoll = rows.length ? new Date(rows.reduce((t, r) => (r.at > t ? r.at : t), rows[0].at)).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null
  const csv = (ws: Watched[]) => ws.map((w) => ({ channel: w.channel, video: w.title, ageHours: Math.round(w.age * 10) / 10, views: w.views, ratio: w.ratio == null ? "" : Math.round(w.ratio * 100) / 100 }))
  return (
    <div className="flex flex-col gap-6">
      <BlockOrder page="live-tracking" initial={["in-progress", "complete"]}>
        {(
          [
            ["in-progress", "In Progress", inProgress, `${inProgress.length} under watch · polled every 15 minutes${lastPoll ? ` · last poll ${lastPoll}` : ""}`, "No short is inside its 72-hour window."],
            ["complete", "Complete", complete, "Verdict at 72 hours.", "No short has finished its 72 hours yet."],
          ] as const
        ).map(([key, title, list, footer, empty]) => (
          <OrderedBlock key={key} id={key} label={title}>
            <TableBlock title={title} search="Search videos…" rows={csv(list)} name={`velocity-${key}`} footer={footer}>
              <table className="tabular w-full text-sm">
                <thead className="text-left">
                  <tr className="bg-muted/60 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:font-medium [&_th]:text-foreground">
                    <th>Channel</th>
                    <th>Video</th>
                    <th className="!text-right">Age</th>
                    <th>Views</th>
                    <th className="!text-right">{key === "in-progress" ? "Ratio/Live" : "Ratio/72h"}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">{empty}</td>
                    </tr>
                  )}
                  {list.map((w) => {
                    const tier = w.ratio == null ? null : tierOf(w.ratio)
                    const pushed = tier === "breakout"
                    const chip = key === "complete" && tier ? TIER[tier].chip : pushed ? TIER.breakout.chip : "bg-slate-100 text-slate-600"
                    return (
                      <tr key={w.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{w.channel}</td>
                        <td className="max-w-96 px-4 py-2.5">
                          <Link href={`/v/yt-${w.id}`} className="line-clamp-1 text-slate-900 hover:text-hermes-plum">{w.title}</Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-500">{Math.min(72, Math.floor(w.age))}h</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-3">
                            <Spark series={w.series} color={pushed ? TIER.breakout.line : key === "complete" && tier === "killed" ? TIER.killed.line : "#64748b"} />
                            <span className="text-slate-700">{w.views.toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", chip)}>{times(w.ratio)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableBlock>
          </OrderedBlock>
        ))}
      </BlockOrder>
    </div>
  )
}
