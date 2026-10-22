import Link from "next/link"
import { Check, Loader2, Minus, X } from "lucide-react"

import { Row, Section } from "@/components/pipeline-flow"
import { ProductionMap, type MapNode } from "@/components/production-map"
import { pipelineQueue } from "@/app/pipeline-actions"
import { accounting, asOf } from "@/lib/accounting"
import { BOXES } from "@/lib/production"
import { takeById } from "@/lib/catalog"
import { currentBatch, rows, STEPS, type StepState } from "@/lib/pipeline"
import { submissions, workspace } from "@/lib/review"
import { DiagramBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"
import { currentUser } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const metadata = { title: "Pipeline" }

const money = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`)

function State({ s }: { s: StepState }) {
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full"
  if (s === "done") return <span className={cn(base, "bg-pax2-lavender text-pax2-light-blue")}><Check className="size-3" /></span>
  if (s === "failed") return <span className={cn(base, "bg-pax2-red-soft text-pax2-red-deep")}><X className="size-3" /></span>
  if (s === "running") return <span className={cn(base, "text-pax2-light-blue")}><Loader2 className="size-4 animate-spin" /></span>
  return <span className={cn(base, "border border-dashed border-slate-300 text-slate-300")}><Minus className="size-3" /></span>
}

const n = (x: number) => x.toLocaleString("en-US")
const SOURCE_LABEL: Record<string, string> = { "youtube-captions": "YouTube captions", transcriptapi: "TranscriptAPI", "whisper-catalog": "Whisper" }
const EDGE: Record<string, string> = { fleet: "catalog-media/, catalog-captions/", composition: "composition/raw/", captions: "transcripts", encoder: "index", "gpu-q": "census answers" }

/** Links read as links: the house's light-blue underline. */
function Lk({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-slate-800 underline decoration-pax2-light-blue underline-offset-4 hover:text-pax2-blue">
      {children}
    </Link>
  )
}

/** The production map: what writes to S3 and the ledger, and what reads from them. */
export default async function PipelinePage() {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/pipeline")
  if (!gatekeeper.admin) notFound()
  const [batch, sent, queue] = await Promise.all([currentBatch(), workspace().then(submissions), pipelineQueue().catch(() => null)])
  const list = rows(batch)
  const total = list.reduce((s, r) => s + r.cost, 0)
  const last = list.map((r) => r.analyzedAt).filter(Boolean).sort().at(-1)
  const running = batch ? Object.values(batch.videos).filter((v) => Object.values(v).some((x) => x !== "done")).length : 0
  const c = accounting.counts
  const when = asOf()

  const doors: MapNode[] = [
    {
      id: "record",
      title: "Record and Upload",
      count: sent.length,
      edge: "uploads/",
      body: (
        <>
          <Section title="Doors">
            <div className="flex flex-col gap-1">
              <Lk href="/record/camera">Record on camera</Lk>
              <Lk href="/record/camera#upload">Upload a finished file</Lk>
            </div>
          </Section>
          <Section>
            <Row left="Submissions" pill={n(sent.length)} />
          </Section>
        </>
      ),
    },
    {
      id: "button",
      title: "Button",
      count: "Planned",
      planned: true,
      edge: "Lab run",
      body: (
        <Section>
          <p className="text-sm text-slate-500">Planned: the flask on every video card sends that video through the Lab.</p>
        </Section>
      ),
    },
    {
      id: "oauth",
      title: "Connect YouTube",
      count: "Live",
      edge: "pax2-channel-ingest",
      body: (
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Grant" pill="read-only analytics" />
            <Row left="Runs on" pill="Lambda pax2-channel-ingest" />
            <Row left="Stores" pill="public videos; private only when picked" />
          </div>
        </Section>
      ),
    },
    {
      id: "admin",
      title: "Admin console",
      count: queue ? queue.queued.length : "—",
      edge: "SSM command",
      body: (
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Poller" pill="on/off switch" />
            <Row left="pax2-worker queue" pill={queue ? `${queue.queued.length} videos` : "unreadable"} />
            <Row left="pax2-worker box" pill={queue?.box ?? "unknown"} />
            <Lk href="/dashboard">Open the console</Lk>
          </div>
        </Section>
      ),
    },
  ]

  const boxes: MapNode[] = BOXES.map((b) => ({
    id: b.id,
    title: b.name,
    count: b.planned ? "Planned" : b.runs.length,
    planned: b.planned,
    edge: EDGE[b.id] ?? "",
    body: (
      <>
        <Section title="Service">
          <p className="text-sm text-slate-800">{b.service}</p>
        </Section>
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Size" pill={b.size} />
            <Row left="Rate" pill={b.rate} />
          </div>
        </Section>
        <Section title={b.planned ? "Budget" : "Measured runs"}>
          <div className="flex flex-col gap-1.5">
            {b.runs.map((r) => (
              <div key={r.run} className="flex flex-col">
                <Row left={r.did} pill={`${r.cost}${r.estimate ? " (estimate)" : ""}`} />
                <span className="font-mono text-[11px] text-slate-400">
                  {r.run} · {r.date}
                </span>
              </div>
            ))}
          </div>
        </Section>
        <Section>
          <p className="font-mono text-[11px] text-slate-400">{b.script}</p>
        </Section>
      </>
    ),
  }))

  const worker: MapNode = {
    id: "worker",
    title: "pax2-worker",
    count: list.length,
    edge: "features/",
    body: (
      <Section title="Checks on submitted videos">
        <div className="flex flex-col gap-1.5">
          {STEPS.map((s) => (
            <Row key={s.id} left={s.name} pill={`${list.filter((r) => r.cells[s.id].state === "done").length} of ${list.length}`} />
          ))}
          <Row left="Size" pill="t4g.large, stops after 30 idle minutes" />
        </div>
      </Section>
    ),
  }

  const scoredNames = ["Headline picker", "Outlier classifier v3", "Behavior-corrected text embedding", "Candidate re-scorer"]
  const feeds: MapNode[] = [
    {
      id: "scored",
      title: "Scored",
      count: scoredNames.length,
      edge: "uploads/, features/, index",
      body: (
        <Section title="Models at the read">
          <div className="flex flex-col gap-1.5">
            {scoredNames.map((m) => (
              <Row key={m} left={m} pill={accounting.passed.find((x) => x.name === m)?.last ?? "—"} />
            ))}
          </div>
        </Section>
      ),
    },
    {
      id: "lab",
      title: "Lab Tested",
      count: c.lab,
      edge: "composition/raw/",
      body: (
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Shorts measured from the file" pill={n(c.composition)} />
            <Row left="e² (end to end)" pill={n(c.e2)} />
            <Lk href="/videos">Open Videos</Lk>
          </div>
        </Section>
      ),
    },
    {
      id: "index",
      title: "Home feed, neighbors and Chat",
      count: c.index,
      edge: "index",
      body: (
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Shorts in the serving index" pill={n(c.index)} />
            <Lk href="/chat">Open Chat</Lk>
          </div>
        </Section>
      ),
    },
    {
      id: "training",
      title: "Model training",
      count: accounting.passed.length + accounting.failed.length,
      edge: "catalog-media/, transcripts",
      body: (
        <Section>
          <div className="flex flex-col gap-1.5">
            <Row left="Live" pill={accounting.passed.filter((m) => m.last === "Live").length} />
            <Row left="Staged" pill={accounting.passed.filter((m) => m.last === "Staged").length} />
            <Row left="Failed" pill={accounting.failed.length} />
            <Lk href="/evals">Open the model ledger</Lk>
          </div>
        </Section>
      ),
    },
    {
      id: "census",
      title: "Census columns (Q)",
      count: "Planned",
      planned: true,
      edge: "census answers",
      body: (
        <Section>
          <p className="text-sm text-slate-500">Planned: captions burned in, call to action, format, setting, people on screen (count and screen share), product shown, watermark; each column with its audited accuracy.</p>
        </Section>
      ),
    },
    {
      id: "policy",
      title: "Publish-next policy (P)",
      count: "Planned",
      planned: true,
      edge: "settled outcomes",
      body: (
        <Section>
          <p className="text-sm text-slate-500">Planned: advises the next video&apos;s topic, length and hour, learning from every outcome.</p>
        </Section>
      ),
    },
  ]

  const store = (
    <>
      <Section title="S3 · pax-2-638175140432">
        <div className="flex flex-col gap-1.5">
          <Row left="Catalog shorts" pill={n(c.all)} />
          <Row left="catalog-media/" pill={`${n(c.media)} (${n(c.picked)} picked, ${n(c.blind)} label-blind)`} />
          <Row left="Transcripts" pill={n(c.transcript)} />
          {Object.entries(accounting.transcriptSources).map(([k, v]) => (
            <Row key={k} left={<span className="pl-3 text-slate-500">{SOURCE_LABEL[k] ?? k}</span>} pill={n(v)} />
          ))}
          <Row left="composition/raw/" pill={n(c.composition)} />
          <Row left="Serving index" pill={n(c.index)} />
          <Row left="uploads/" pill={n(sent.length)} />
        </div>
      </Section>
      <Section title="DynamoDB · pax2-ledger">
        <div className="flex flex-col gap-1.5">
          <Row left="Submissions" pill={n(sent.length)} />
          <Row left="Channel ingests" pill="per connected channel" />
        </div>
      </Section>
      <Section>
        <p className="text-xs text-slate-400">Counts as of {when}, from scripts/accounting.mjs.</p>
      </Section>
    </>
  )

  return (
    <div className="flex flex-col">
      <BlockOrder page="pipeline" initial={["pipeline", "videos"]}>
        <OrderedBlock id="pipeline" label="Production">
          <DiagramBlock
            title="Production"
            height="auto"
            footer={
              batch ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-pax2-light-blue" />
                  pax2-worker running now: {running} of {Object.keys(batch.videos).length} videos still in progress, started {new Date(batch.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
                </span>
              ) : (
                `Costs are each run's own record, with its date. ${last ? `pax2-worker last ran ${new Date(last).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""}`
              )
            }
          >
            <ProductionMap left={[...doors, worker, ...boxes]} mid={{ title: "S3 and the ledger", body: store }} right={feeds} />
          </DiagramBlock>
        </OrderedBlock>

        <OrderedBlock id="videos" label="Videos">
          <TableBlock
            title="pax2-worker videos"
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
                          <span className="font-medium text-slate-900 group-hover:text-pax2-light-blue">{r.title}</span>
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
