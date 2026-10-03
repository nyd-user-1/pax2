import Link from "next/link"

import build from "../../../data/build.json"
import libraryMeta from "../../../data/library-meta.json"
import { BudgetAndLimits, LessonsCard, Volume } from "@/components/build/board"
import { TodoCard, type Todo } from "@/components/build/todo-card"
import { FreshReview } from "@/components/fresh-review"
import { LESSONS, NOT_CONNECTED, PAGES, type SourceRow } from "@/lib/build-board"
import { FEATURES, TAKES } from "@/lib/catalog"
import { rows } from "@/lib/pipeline"
import { workspace } from "@/lib/review"
import { Badge } from "@/ui/components/nova/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/ui/components/nova/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Build" }

// The build's dashboard in the frame of GovBlock's Data Pipeline page (/workspace/dashboard/database):
// six tiles, Volume with its ranked list, Sources (Feeds), Runs (Run Log), Pages (Jurisdictions),
// Budget beside Limits (Feed Health beside Quotas), To Do, Lessons Learned. The tracker is data/build.json.

type Item = { title: string; detail?: string }
type Build = { updated: string; budget: { cap: number; spent: { item: string; usd: number }[] }; columns: { id: string; title: string; items: Item[] }[]; resources: { name: string; id: string }[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const STATUS_TONE: Record<SourceRow["status"], string> = { Loaded: "text-pax-plum", "Stand-in": "text-pax-red-deep", "Not connected": "text-muted-foreground" }
const PAGE_DOT: Record<string, { dot: string; label: string }> = {
  real: { dot: "bg-pax-plum", label: "Real data" },
  "stand-in": { dot: "bg-pax-red", label: "Stand-in data" },
  mixed: { dot: "bg-slate-400", label: "Real and stand-in" },
}

/** Analysis runs on record: the videos' analysis times, split wherever twenty minutes pass with none. */
function runs(cost: Record<string, number>) {
  const done = TAKES.map((t) => ({ id: t.id, at: FEATURES[t.id]?.analyzedAt })).filter((x): x is { id: string; at: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at))
  const out: { start: string; end: string; ids: string[] }[] = []
  for (const d of done) {
    const last = out.at(-1)
    if (last && new Date(d.at).getTime() - new Date(last.end).getTime() < 20 * 60 * 1000) (last.end = d.at), last.ids.push(d.id)
    else out.push({ start: d.at, end: d.at, ids: [d.id] })
  }
  return out.map((r) => ({ ...r, cost: r.ids.reduce((s, id) => s + (cost[id] ?? 0), 0) }))
}

export default async function BuildPage() {
  const b = build as Build
  const ws = await workspace()
  const spent = b.budget.spent.reduce((t, s) => t + s.usd, 0)
  const col = (id: string) => b.columns.find((c) => c.id === id)?.items ?? []
  const [done, you, next] = [col("done"), col("you"), col("next")]
  const videos = rows(null).map((r) => ({ id: r.id, title: r.title, label: r.label, cost: r.cost }))
  const ran = runs(Object.fromEntries(videos.map((v) => [v.id, v.cost])))
  const perVideo = videos.reduce((s, v) => s + v.cost, 0) / Math.max(1, videos.length)

  const sources: SourceRow[] = [
    ...(libraryMeta as unknown as { title: string; publisher: string; kind: string; summary: string }[]).map((d) => ({ name: d.title, publisher: d.publisher, kind: d.kind, covers: d.summary, runsOn: "S3", status: "Loaded" as const })),
    ...NOT_CONNECTED,
  ]

  const todo: Todo[] = [...you.map((t) => ({ ...t, who: "Brendan" as const })), ...next.map((t) => ({ ...t, who: null })), ...[...done].reverse().map((t) => ({ ...t, who: null, done: true }))]

  const tiles = [
    { title: "Spent", value: `$${spent.toFixed(2)}`, note: `of the $${b.budget.cap} cap` },
    { title: "Done", value: done.length, note: "tracker items" },
    { title: "Waiting on Brendan", value: you.length, note: "decisions and access" },
    { title: "Next", value: next.length, note: "queued" },
    { title: "Videos Analyzed", value: `${videos.filter((v) => v.cost > 0).length} of ${TAKES.length}`, note: `$${perVideo.toFixed(2)} each` },
    { title: "Sources", value: `${sources.filter((s) => s.status === "Loaded").length} of ${sources.length}`, note: "loaded" },
  ]

  const short = (s: string) => s.replace(/\s*\(.*\)$/, "").split(/[,:]/)[0]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Build</h1>
        <p className="text-sm text-muted-foreground">Updated {b.updated}</p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.title} className="flex flex-col gap-1.5 bg-card p-4">
                <p className="text-sm text-muted-foreground">{t.title}</p>
                <span className="tabular text-2xl font-semibold">{t.value}</span>
                <p className="text-xs text-muted-foreground">{t.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Volume spend={b.budget.spent.map((s) => ({ item: s.item, short: short(s.item), usd: s.usd }))} videos={videos} />

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Source</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Covers</TableHead>
                <TableHead>Runs On</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.name}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium whitespace-nowrap">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.publisher}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{s.kind}</TableCell>
                  <TableCell className="max-w-96 truncate" title={s.covers}>
                    {s.covers}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{s.runsOn}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("h-5", STATUS_TONE[s.status])}>
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Run</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Estimated Cost</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ran.map((r, i) => (
                <TableRow key={r.start}>
                  <TableCell className="font-medium">Analysis {i + 1}</TableCell>
                  <TableCell className="tabular text-right">{r.ids.length}</TableCell>
                  <TableCell className="tabular text-right">${r.cost.toFixed(2)}</TableCell>
                  <TableCell>{when(r.start)}</TableCell>
                  <TableCell>{when(r.end)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardAction>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.values(PAGE_DOT).map((d) => (
                <span key={d.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", d.dot)} />
                  {d.label}
                </span>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="flex flex-col gap-1 rounded-xl border bg-card p-3 transition-shadow hover:shadow-e1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span title={PAGE_DOT[p.state].label} className={cn("size-2.5 shrink-0 rounded-full", PAGE_DOT[p.state].dot)} />
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{p.href}</span>
                <span className="text-xs leading-snug text-muted-foreground">{p.data}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <BudgetAndLimits
        spent={spent}
        cap={b.budget.cap}
        facts={[
          { label: "Remaining", value: `$${(b.budget.cap - spent).toFixed(2)}`, note: "before the cap" },
          { label: "Per Video", value: `$${perVideo.toFixed(2)}`, note: "about $0.04 without Rekognition" },
          { label: "Biggest Item", value: "Rekognition", note: "three-quarters of analysis cost" },
          { label: "Workspace", value: ws, note: "the review this browser reads" },
        ]}
        limits={[
          { label: "AWS budget", sub: "estimated spend against the cap", used: Math.round(spent * 100) / 100, limit: b.budget.cap, unit: "USD" },
          { label: "Rekognition jobs", sub: "open at once, per account", used: 0, limit: 20, unit: "jobs" },
          { label: "PAX reading", sub: "seconds per reading against Amplify's 30-second cut-off", used: 16, limit: 30, unit: "seconds" },
          { label: "Worker box", sub: "stops itself after this many idle minutes", used: 0, limit: 30, unit: "minutes" },
        ]}
      />
      <div className="-mt-2 flex justify-end">
        <FreshReview />
      </div>

      <TodoCard items={todo} />
      <LessonsCard lessons={LESSONS} />
    </div>
  )
}
