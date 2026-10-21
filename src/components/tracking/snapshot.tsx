import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import { StatBlock } from "@/components/blocks"
import { Stat2 } from "@/components/dash/stats"
import { SnapshotRefresh } from "@/components/snapshot-refresh"
import { apStamp, snapshots } from "@/lib/velocity-store"
import { cn } from "@/ui/lib/utils"

// The poller's running counts as a block: shorts, channels, Hits, Misses and live tracking, each against
// the snapshot nearest a day earlier. On /tracking's Live tab.

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
      <span className={cn("inline-flex items-center gap-0.5 font-medium", d.n === 0 ? "text-slate-800" : good ? "text-green-600" : "text-destructive")}>
        <Icon className="size-3.5" />
        {Math.abs(d.n).toLocaleString()}
      </span>
      <span className="text-slate-800">vs. prior</span>
    </span>
  )
}

export async function SnapshotBlock() {
  const { at, cards } = await statCards()
  return (
    <StatBlock title="Snapshot" id="snapshot" height="auto" tools={<span className="ml-2 flex items-center gap-1 text-xs text-slate-800">{at && <span>{apStamp(at)}</span>}<SnapshotRefresh /></span>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((t) => (
          <Stat2 key={t.title} title={t.title} value={t.value} footer={<Change d={t.diff} lowerIsBetter={t.title === "Misses"} />} />
        ))}
      </div>
    </StatBlock>
  )
}
