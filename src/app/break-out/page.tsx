import fs from "node:fs"
import path from "node:path"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import shorts from "../../../data/raw/yt-shorts.json"
import { ChartBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { Stat2 } from "@/components/dash/stats"
import { labVideos, type Tier } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Breakout" }
export const dynamic = "force-dynamic"

const read = <T,>(f: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/velocity", f), "utf8")) as T
  } catch {
    return fallback
  }
}

/** The page's five tiles: the lookback catalog's verdicts and the live watch. */
function tiles() {
  const { videos } = read<{ videos: { channelId: string; tier: string }[] }>("catalog.json", { videos: [] })
  const settled = videos.filter((v) => v.tier !== "unsettled")
  const hits = settled.filter((v) => v.tier === "breakout").length
  const misses = settled.filter((v) => v.tier === "killed").length
  const medians = read<Record<string, { median: number | null }>>("baselines.json", {})
  let polls: { id: string; channelId: string; published: string; views: number; hour: number }[] = []
  try {
    polls = fs.readFileSync(path.join(process.cwd(), "data/velocity/polls.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  } catch {}
  const latest = new Map<string, (typeof polls)[number]>()
  for (const r of polls) if (!latest.has(r.id) || r.hour > latest.get(r.id)!.hour) latest.set(r.id, r)
  const now = Date.now()
  const tracking = [...latest.values()].filter((r) => now - Date.parse(r.published) < 72 * 3_600_000)
  const live = tracking.filter((r) => { const m = medians[r.channelId]?.median; return m ? r.views / m >= 3 : false }).length
  const now2 = { shorts: settled.length, channels: new Set(videos.map((v) => v.channelId)).size, hits, misses, tracking: tracking.length, live }
  // Each tile's movement against the snapshot nearest 24 hours ago (or the oldest, while history is shorter).
  let history: (typeof now2 & { at: string })[] = []
  try {
    history = fs.readFileSync(path.join(process.cwd(), "data/velocity/tiles.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  } catch {}
  const before = history.filter((h) => Date.parse(h.at) <= now - 24 * 3_600_000).at(-1) ?? history[0]
  const span = before ? Math.max(1, Math.round((now - Date.parse(before.at)) / 3_600_000)) : 0
  const diff = (k: keyof typeof now2) => (before ? { n: now2[k] - before[k], span: `past ${span} hour${span === 1 ? "" : "s"}` } : null)
  return [
    { title: "Shorts", value: now2.shorts.toLocaleString(), diff: diff("shorts") },
    { title: "Channels", value: String(now2.channels), diff: diff("channels") },
    { title: "Hits", value: hits.toLocaleString(), diff: diff("hits") },
    { title: "Misses", value: misses.toLocaleString(), diff: diff("misses") },
    { title: "Live Tracking", value: String(now2.tracking), diff: diff("tracking") },
  ]
}

/** The tile's movement since the previous snapshot; green is good news, so a rise in Misses is red. */
function Change({ d, lowerIsBetter = false }: { d: { n: number } | null; lowerIsBetter?: boolean }) {
  if (!d) return null
  const Icon = d.n > 0 ? ArrowUpRight : d.n < 0 ? ArrowDownRight : Minus
  const good = lowerIsBetter ? d.n < 0 : d.n > 0
  return (
    <span className="tabular inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", d.n === 0 ? "text-muted-foreground" : good ? "text-green-600" : "text-destructive")}>
        <Icon className="size-3.5" />
        {Math.abs(d.n).toLocaleString()}
      </span>
      <span className="text-muted-foreground">vs. prior</span>
    </span>
  )
}

const VIEWS_AS_OF = `Views as of ${new Date((shorts as { fetchedAt: string }).fetchedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`

const TIER: Record<Tier, { label: string; chip: string; dot: string }> = {
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

function Scatter() {
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

export default function BreakoutPage() {
  const vids = labVideos()
  return (
    <div className="flex flex-col">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles().map((t) => (
          <Stat2 key={t.title} title={t.title} value={t.value} footer={<Change d={t.diff} lowerIsBetter={t.title === "Misses"} />} />
        ))}
      </div>

      <BlockOrder page="break-out" initial={["verdict", "videos"]}>
        <OrderedBlock id="verdict" label="Hits and Misses">
          <ChartBlock
            title="Hits and Misses"
            id="verdict"
            rows={vids.map((v) => ({ video: v.title, channel: v.channel, ratio: Number(v.ratio.toFixed(2)), verdict: TIER[v.tier].label }))}
            name="seed-verdict"
            height="h-[calc(100dvh-19.5rem)] min-h-[419px]"
            footer={
              <span className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span>{VIEWS_AS_OF}</span>
                <span className="flex items-center gap-4">
                  {(Object.keys(TIER) as Tier[]).map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: TIER[t].dot }} /> {TIER[t].label}
                    </span>
                  ))}
                </span>
              </span>
            }
          >
            <Scatter />
          </ChartBlock>
        </OrderedBlock>

        <OrderedBlock id="videos" label="Shorts">
          <TableBlock
            title={`Shorts (${vids.length})`}
            id="videos"
            search="Search videos…"
            rows={vids.map((v) => ({ video: v.title, channel: v.channel, views: v.views, median: Math.round(v.channelMedian), ratio: `${v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x`, verdict: TIER[v.tier].label }))}
            name="videos"
            footer={VIEWS_AS_OF}
          >
              <table className="tabular w-full text-sm">
                <thead className="text-left">
                  <tr className="bg-muted/60 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:font-medium [&_th]:text-foreground">
                    <th>Video</th>
                    <th>Channel</th>
                    <th className="!text-right">Views</th>
                    <th className="!text-right">Channel median</th>
                    <th className="!text-right">Ratio</th>
                    <th>Verdict</th>
                    <th>Curve</th>
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
                      <td className="px-4 py-2.5">
                        <Link href={`/velocity-tracker?v=${v.id}`} className="text-pax-ink hover:text-pax-plum hover:underline">Curve</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </TableBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
