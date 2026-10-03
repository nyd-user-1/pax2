import build from "../../../data/build.json"
import { TodoCard, type Todo } from "@/components/build/todo-card"
import { FreshReview } from "@/components/fresh-review"
import { FEATURES, TAKES } from "@/lib/catalog"
import { rows } from "@/lib/pipeline"
import { workspace } from "@/lib/review"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/nova/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/nova/tabs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Build" }

// The build's dashboard, in the frame of GovBlock's Data Pipeline page (/workspace/dashboard/ingestion):
// tiles across the top, the work in tabs, spend and resources side by side, the runs on record,
// and the To Do list at the bottom. The tracker itself is data/build.json.

type Item = { title: string; detail?: string }
type Build = { updated: string; budget: { cap: number; spent: { item: string; usd: number }[] }; columns: { id: string; title: string; items: Item[] }[]; resources: { name: string; id: string }[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/** Analysis runs on record: the videos' analysis times, split wherever twenty minutes pass with none. */
function runs() {
  const cost = Object.fromEntries(rows(null).map((r) => [r.id, r.cost]))
  const done = TAKES.map((t) => ({ id: t.id, at: FEATURES[t.id]?.analyzedAt })).filter((x): x is { id: string; at: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at))
  const out: { start: string; end: string; ids: string[] }[] = []
  for (const d of done) {
    const last = out.at(-1)
    if (last && new Date(d.at).getTime() - new Date(last.end).getTime() < 20 * 60 * 1000) (last.end = d.at), last.ids.push(d.id)
    else out.push({ start: d.at, end: d.at, ids: [d.id] })
  }
  return out.map((r) => ({ ...r, cost: r.ids.reduce((s, id) => s + (cost[id] ?? 0), 0) }))
}

function WorkTable({ items }: { items: Item[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/60">
          <TableHead className="w-72">Item</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.title}>
            <TableCell className="align-top font-medium whitespace-normal">{i.title}</TableCell>
            <TableCell className="text-sm whitespace-normal text-muted-foreground">{i.detail}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default async function BuildPage() {
  const b = build as Build
  const ws = await workspace()
  const spent = b.budget.spent.reduce((t, s) => t + s.usd, 0)
  const col = (id: string) => b.columns.find((c) => c.id === id)?.items ?? []
  const done = col("done")
  const you = col("you")
  const next = col("next")
  const ran = runs()
  const todo: Todo[] = [...you.map((t) => ({ ...t, who: "Brendan" as const })), ...next.map((t) => ({ ...t, who: null }))]

  const tiles = [
    { title: "Spent", value: `$${spent.toFixed(2)}`, note: `of the $${b.budget.cap} cap` },
    { title: "Done", value: done.length },
    { title: "Waiting on Brendan", value: you.length },
    { title: "Next", value: next.length },
    { title: "Videos", value: TAKES.length, note: `${TAKES.filter((t) => FEATURES[t.id]).length} analyzed` },
    { title: "Runs on Record", value: ran.length, note: ran.length ? `last ${when(ran.at(-1)!.end)}` : undefined },
  ]

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
                {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                {t.title === "Spent" && (
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-pax-plum" style={{ width: `${Math.min(100, (spent / b.budget.cap) * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Work</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="done">
            <TabsList>
              <TabsTrigger value="done">Done ({done.length})</TabsTrigger>
              <TabsTrigger value="you">Waiting on Brendan ({you.length})</TabsTrigger>
              <TabsTrigger value="next">Next ({next.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="done">
              <WorkTable items={[...done].reverse()} />
            </TabsContent>
            <TabsContent value="you">
              <WorkTable items={you} />
            </TabsContent>
            <TabsContent value="next">
              <WorkTable items={next} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Estimated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.budget.spent.map((s) => (
                  <TableRow key={s.item}>
                    <TableCell className="whitespace-normal">{s.item}</TableCell>
                    <TableCell className="tabular text-right">${s.usd.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="tabular text-right">${spent.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Resource</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.resources.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Review workspace</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{ws}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-sm text-muted-foreground">A fresh workspace starts the loop from round 1 without touching any earlier record.</p>
              <FreshReview />
            </div>
          </CardContent>
        </Card>
      </div>

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

      <TodoCard items={todo} />
    </div>
  )
}
