import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import shorts from "../../../data/raw/yt-shorts.json"
import { ChartBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { Stat2 } from "@/components/dash/stats"
import { SnapshotRefresh } from "@/components/snapshot-refresh"
import { HitsScatter, TIER } from "@/components/hits-scatter"
import { labVideos, type Tier } from "@/lib/lab"
import { apStamp, snapshots } from "@/lib/velocity-store"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "iWAR" }
export const dynamic = "force-dynamic"

/** The five stat cards: the latest snapshot the poller saved, against the one nearest a day earlier. */
async function statCards() {
  const history = await snapshots()
  const latest = history.at(-1)
  if (!latest) return { at: null, cards: [] }
  const t = Date.parse(latest.at)
  const prior = history.filter((h) => Date.parse(h.at) <= t - 24 * 3_600_000).at(-1) ?? (history.length > 1 ? history[0] : undefined)
  const diff = (k: "shorts" | "channels" | "hits" | "misses" | "tracking") => (prior ? { n: latest[k] - prior[k] } : null)
  return {
    at: latest.at,
    cards: [
      { title: "Shorts", value: latest.shorts.toLocaleString(), diff: diff("shorts") },
      { title: "Channels", value: String(latest.channels), diff: diff("channels") },
      { title: "Hits", value: latest.hits.toLocaleString(), diff: diff("hits") },
      { title: "Misses", value: latest.misses.toLocaleString(), diff: diff("misses") },
      { title: "Live Tracking", value: String(latest.tracking), diff: diff("tracking") },
    ],
  }
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

export default async function BreakoutPage() {
  const vids = labVideos()
  const { at, cards } = await statCards()
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-end gap-1 text-xs text-muted-foreground">
        {at && <span>Snapshot: {apStamp(at)}</span>}
        <SnapshotRefresh />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((t) => (
          <Stat2 key={t.title} title={t.title} value={t.value} footer={<Change d={t.diff} lowerIsBetter={t.title === "Misses"} />} />
        ))}
      </div>

      <BlockOrder page="break-out" initial={["verdict", "videos"]}>
        <OrderedBlock id="verdict" label="Hits and Misses">
          <ChartBlock
            title="Hits and Misses"
            id="verdict"
            rows={vids.map((v) => ({ video: v.title, channel: v.channel, iWAR: Number(v.ratio.toFixed(2)), verdict: TIER[v.tier].label }))}
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
            <HitsScatter />
          </ChartBlock>
        </OrderedBlock>

        <OrderedBlock id="videos" label="Shorts">
          <TableBlock
            title={`Shorts (${vids.length})`}
            id="videos"
            search="Search videos…"
            rows={vids.map((v) => ({ video: v.title, channel: v.channel, views: v.views, median: Math.round(v.channelMedian), iWAR: `${v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x`, verdict: TIER[v.tier].label }))}
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
                    <th className="!text-right">iWAR</th>
                    <th>Verdict</th>
                    <th>Curve</th>
                  </tr>
                </thead>
                <tbody>
                  {vids.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100">
                      <td className="max-w-80 px-4 py-2.5">
                        <Link href={`/v/yt-${v.id}`} className="line-clamp-1 font-sans text-slate-900 hover:text-pax2-light-blue">{v.title}</Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{v.channel}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{v.views.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{Math.round(v.channelMedian).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}x</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TIER[v.tier].chip)}>{TIER[v.tier].label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/velocity-tracker?v=${v.id}`} className="text-pax2-blue hover:text-pax2-light-blue hover:underline">Curve</Link>
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
