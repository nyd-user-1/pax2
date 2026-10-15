import Link from "next/link"
import { Check, Loader2, Minus, X } from "lucide-react"

import { PipelineFlow } from "@/components/pipeline-flow"
import { takeById } from "@/lib/catalog"
import { currentBatch, rows, STEPS, type StepState } from "@/lib/pipeline"
import { submissions, workspace } from "@/lib/review"
import { DiagramBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Pipeline" }

const money = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`)

function State({ s }: { s: StepState }) {
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full"
  if (s === "done") return <span className={cn(base, "bg-pax2-lavender text-pax2-plum")}><Check className="size-3" /></span>
  if (s === "failed") return <span className={cn(base, "bg-pax2-red-soft text-pax2-red-deep")}><X className="size-3" /></span>
  if (s === "running") return <span className={cn(base, "text-pax2-plum")}><Loader2 className="size-4 animate-spin" /></span>
  return <span className={cn(base, "border border-dashed border-slate-300 text-slate-300")}><Minus className="size-3" /></span>
}

/** Every video goes through three checks on the worker box before its version page fills in. */
export default async function PipelinePage() {
  const [batch, sent] = await Promise.all([currentBatch(), workspace().then(submissions)])
  const list = rows(batch)
  const total = list.reduce((s, r) => s + r.cost, 0)
  const last = list.map((r) => r.analyzedAt).filter(Boolean).sort().at(-1)
  const running = batch ? Object.values(batch.videos).filter((v) => Object.values(v).some((x) => x !== "done")).length : 0

  return (
    <div className="flex flex-col">
      <BlockOrder page="pipeline" initial={["pipeline", "videos"]}>
        <OrderedBlock id="pipeline" label="Pipeline">
          <DiagramBlock
            title="Pipeline"
            height="auto"
            footer={
              batch ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-pax2-plum" />
                  Running now: {running} of {Object.keys(batch.videos).length} videos still in progress, started {new Date(batch.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
                </span>
              ) : (
                last && `Last run ${new Date(last).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
              )
            }
          >
            <PipelineFlow
              d={{
                videos: list.map((r) => ({ id: r.id, title: r.title, label: r.label })),
                uploads: sent.length,
                lastRun: last ? new Date(last).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null,
                running: !!batch,
                total: list.length,
                spentTotal: money(total),
                example: list[0]?.id ?? "",
                steps: STEPS.map((s) => ({ ...s, done: list.filter((r) => r.cells[s.id].state === "done").length, spent: money(list.reduce((a, r) => a + r.cells[s.id].cost, 0)) })),
              }}
            />
          </DiagramBlock>
        </OrderedBlock>

        <OrderedBlock id="videos" label="Videos">
          <TableBlock
            title="Videos"
            search="Search videos…"
            rows={list.map((r) => ({ video: r.title, label: r.label, seconds: Math.round(r.seconds), ...Object.fromEntries(STEPS.map((s) => [s.name.toLowerCase(), r.cells[s.id].state])), cost: Number(r.cost.toFixed(2)) }))}
            name="videos"
          >
            <table className="tabular w-full min-w-[960px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="bg-muted/60 [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium">
                  <th>Video</th>
                  {STEPS.map((s) => (
                    <th key={s.id}>
                      {s.n}. {s.name}
                    </th>
                  ))}
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 [&_td]:px-4 [&_td]:py-3">
                    <td>
                      <Link href={`/v/${r.id}`} scroll={false} className="group flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={takeById(r.id)?.video?.poster} alt="" className="h-14 w-8 shrink-0 rounded-md bg-slate-200 object-cover" />
                        <span className="flex flex-col">
                          <span className="font-medium text-slate-900 group-hover:text-pax2-plum">{r.title}</span>
                          <span className="text-xs text-slate-500">
                            {r.label} · {Math.round(r.seconds)}s
                          </span>
                        </span>
                      </Link>
                    </td>
                    {STEPS.map((s) => {
                      const c = r.cells[s.id]
                      return (
                        <td key={s.id}>
                          <span className="flex items-center gap-2">
                            <State s={c.state} />
                            <span className={cn("text-xs", c.state === "failed" ? "text-pax2-red-deep" : "text-slate-600")} title={c.state === "failed" ? c.out ?? undefined : undefined}>
                              {c.state === "failed" ? "Failed" : c.state === "running" ? "Running" : c.state === "queued" ? "Waiting" : c.out ?? "Not run"}
                            </span>
                          </span>
                        </td>
                      )
                    })}
                    <td className="text-right text-slate-700">{money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-slate-900 [&_td]:px-4 [&_td]:py-3">
                  <td colSpan={STEPS.length + 1}>{list.length} videos</td>
                  <td className="text-right">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs text-slate-400">Costs are estimates at AWS list prices, from each video&apos;s length.</p>
          </TableBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
