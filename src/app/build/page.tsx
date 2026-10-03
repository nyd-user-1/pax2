import Link from "next/link"

import build from "../../../data/build.json"
import libraryMeta from "../../../data/library-meta.json"
import { BudgetAndLimits, InsightsCard, Volume } from "@/components/build/board"
import { PagesBoard } from "@/components/build/pages-board"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { CardAnchor, CardTools, RefreshButton } from "@/components/dash/card-tools"
import { FoldCard } from "@/components/dash/fold-card"
import { TodoCard, type Todo } from "@/components/build/todo-card"
import { LESSONS, NOT_CONNECTED, PAGES, type SourceRow } from "@/lib/build-board"
import { FEATURES, TAKES } from "@/lib/catalog"
import { rows } from "@/lib/pipeline"
import { workspace } from "@/lib/review"
import { Badge } from "@/ui/components/nova/badge"
import { Card, CardAction, CardContent, CardHeader } from "@/ui/components/nova/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Build" }

// The build's dashboard in the frame of GovBlock's Data Pipeline page (/workspace/dashboard/database):
// six tiles, Volume with its ranked list, Sources (Feeds), Runs (Run Log), Pages (Jurisdictions),
// Budget beside Limits (Feed Health beside Quotas), To Do, Insights. The tracker is data/build.json.

type Item = { title: string; detail?: string }
type Build = { updated: string; budget: { cap: number; spent: { item: string; usd: number }[] }; columns: { id: string; title: string; items: Item[] }[]; resources: { name: string; id: string }[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const STATUS_TONE: Record<SourceRow["status"], string> = { Loaded: "text-pax-plum", "Stand-in": "text-pax-red-deep", "Not connected": "text-muted-foreground" }

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
  const videos = rows(null).map((r) => ({ id: r.id, title: r.title, label: r.label, cost: r.cost, poster: TAKES.find((t) => t.id === r.id)?.video?.poster }))
  const ran = runs(Object.fromEntries(videos.map((v) => [v.id, v.cost])))
  const perVideo = videos.reduce((s, v) => s + v.cost, 0) / Math.max(1, videos.length)

  const sources: SourceRow[] = [
    ...(libraryMeta as unknown as { slug: string; title: string; publisher: string; kind: string; summary: string }[]).map((d) => ({ name: d.title, href: `/library/${d.slug}`, publisher: d.publisher, kind: d.kind, covers: d.summary, runsOn: "S3", status: "Loaded" as const })),
    ...NOT_CONNECTED,
  ]

  const todo: Todo[] = [...you.map((t) => ({ ...t, who: "Brendan" as const })), ...next.map((t) => ({ ...t, who: null })), ...[...done].reverse().map((t) => ({ ...t, who: null, done: true }))]

  const tiles = [
    { title: "Spent", value: `$${spent.toFixed(2)}`, note: `of the $${b.budget.cap} cap` },
    { title: "Done", value: done.length, note: "built and working" },
    { title: "Waiting on Brendan", value: you.length, note: "data, access and decisions" },
    { title: "Next", value: next.length, note: "ready to build" },
    { title: "Videos Analyzed", value: `${videos.filter((v) => v.cost > 0).length} of ${TAKES.length}`, note: `$${perVideo.toFixed(2)} each` },
    { title: "Sources", value: `${sources.filter((s) => s.status === "Loaded").length} of ${sources.length}`, note: "loaded" },
  ]

  const short = (s: string) => s.replace(/\s*\(.*\)$/, "").split(/[,:]/)[0]

  return (
    <div className="flex flex-col">
      <header className="mb-5 flex flex-col gap-1">
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

      <BlockOrder page="build" initial={["volume", "library", "runs", "pages", "budget", "todo", "insights"]}>
        <OrderedBlock id="volume" label="Volume">
          <Volume spend={b.budget.spent.map((s) => ({ item: s.item, short: short(s.item), usd: s.usd }))} videos={videos} />
        </OrderedBlock>

        <OrderedBlock id="library" label="Library">
          <FoldCard title="Library" rows={sources.map(({ name, href, publisher, kind, covers, status }) => ({ name, href, publisher, type: kind, description: covers, status }))} name="library" tools={<RefreshButton />}>
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[27%]">Name</TableHead>
                  <TableHead className="w-[25%]">Publisher</TableHead>
                  <TableHead className="w-[12%]">Type</TableHead>
                  <TableHead className="w-[24%]">Description</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="truncate font-medium" title={s.name}>
                      {s.href.startsWith("http") ? (
                        <a href={s.href} target="_blank" rel="noreferrer" className="text-pax-ink hover:text-pax-plum hover:underline">
                          {s.name}
                        </a>
                      ) : (
                        <Link href={s.href} className="text-pax-ink hover:text-pax-plum hover:underline">
                          {s.name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground" title={s.publisher}>
                      {s.publisher}
                    </TableCell>
                    <TableCell className="truncate" title={s.kind}>
                      {s.kind}
                    </TableCell>
                    <TableCell className="truncate" title={s.covers}>
                      {s.covers}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("h-5", STATUS_TONE[s.status])}>
                        {s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FoldCard>
        </OrderedBlock>

        <OrderedBlock id="runs" label="Runs">
          <Card className="gap-4">
            <CardHeader>
              <CardAnchor>Runs</CardAnchor>
              <CardAction>
                <CardTools rows={ran.map((r, i) => ({ run: `Analysis ${i + 1}`, videos: r.ids.length, usd: Number(r.cost.toFixed(2)), started: r.start, finished: r.end }))} name="runs">
                  <RefreshButton />
                </CardTools>
              </CardAction>
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
        </OrderedBlock>

        <OrderedBlock id="pages" label="Pages">
          <PagesBoard pages={PAGES} />
        </OrderedBlock>

        <OrderedBlock id="budget" label="Budget and Limits">
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
        </OrderedBlock>

        <OrderedBlock id="todo" label="To Do">
          <TodoCard items={todo} />
        </OrderedBlock>

        <OrderedBlock id="insights" label="Insights">
          <InsightsCard lessons={LESSONS} />
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
