"use client"

import * as React from "react"
import {
  Background, BackgroundVariant, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle,
  MarkerType, Position, ReactFlow, ReactFlowProvider,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react"
import { Database, FlaskConical, Monitor, Server } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// /pipeline-2: the whole PAX2 factory as one fixed diagram on the xyflow canvas. Six node kinds (door,
// stage, store, instrument, service, surface) and three edge kinds (flow, loop, planned), all defined
// in the legend band at the top. Instrument numbers are the rows of the Models table on
// docs/ACCOUNTING.html (scripts/accounting.mjs). Planned parts draw dashed: nothing unwired draws solid.
// Positions are hand-set so the long return edges run as rails under the main line.

export type FactoryCounts = {
  catalog: number | null
  composition: number | null
  media: number | null
  index: number | null
  transcripts: number | null
  /** The date scripts/accounting.mjs took media, index and transcripts. */
  asOf: string | null
  /** Shorts inside the poller's 72-hour window, and the channels it follows, from its last snapshot. */
  window: number | null
  channels: number | null
}

const BLUE = "#1e3a8a"
const FLOW = "#94a3b8"
const LOOP = "#7c3aed"
const PLANNED = "#cbd5e1"

type Status = "Live" | "Staged"
type Chip = { n: number; name: string; status: Status }

// The Models table's passed rows, in its order.
const MODELS: Chip[] = [
  { n: 1, name: "Outlier classifier v1", status: "Live" },
  { n: 2, name: "Outlier classifier v3", status: "Live" },
  { n: 3, name: "Early-hit predictor", status: "Live" },
  { n: 4, name: "Behavior-corrected text embedding", status: "Live" },
  { n: 5, name: "Candidate re-scorer", status: "Live" },
  { n: 6, name: "Headline picker", status: "Live" },
  { n: 7, name: "Persuasion evidence reference", status: "Live" },
  { n: 8, name: "Composition pair picker", status: "Staged" },
  { n: 9, name: "Pairwise picker, Reform & Voting rights", status: "Staged" },
  { n: 10, name: "Resonance text embedding, behavior arm", status: "Staged" },
  { n: 11, name: "Resonance text embedding, full arm", status: "Staged" },
  { n: 12, name: "Watch-through regressor v0", status: "Live" },
  { n: 13, name: "Feed ranker v0", status: "Staged" },
  { n: 14, name: "Ask-a-video (Q)", status: "Staged" },
  { n: 15, name: "Publish-next policy (P)", status: "Staged" },
]
const model = (n: number) => MODELS[n - 1]

const fmt = (n: number | null) => (n == null ? null : n.toLocaleString("en-US"))

// ---------------------------------------------------------------------------------------------
// Handles: every node carries one hidden handle per side ("t", "r", "b", "l"); a node that takes
// several edges on one side adds named handles at set offsets. The canvas runs in loose mode, so any
// handle can end an edge.

type Side = "t" | "r" | "b" | "l"
type Extra = { id: string; side: Side; at: number }
const POS: Record<Side, Position> = { t: Position.Top, r: Position.Right, b: Position.Bottom, l: Position.Left }
const HIDDEN = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"

function Sides({ extra = [] }: { extra?: Extra[] }) {
  return (
    <>
      {(["t", "r", "b", "l"] as Side[]).map((s) => <Handle key={s} id={s} type="source" position={POS[s]} isConnectable={false} className={HIDDEN} />)}
      {extra.map((h) => (
        <Handle key={h.id} id={h.id} type="source" position={POS[h.side]} isConnectable={false} className={HIDDEN} style={h.side === "l" || h.side === "r" ? { top: h.at } : { left: h.at }} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The six node kinds.

type Box = { w: number; h: number; extra?: Extra[] }
type DoorData = Box & { title: string; sub: string; planned?: boolean; big?: boolean }
type StageData = Box & { title: string; rows: [string, string][]; foot?: string[] }
type StoreData = Box & { service: string; title: string; sub: string; count?: string | null }
type ChipData = Box & { n: number }
type RackData = Box & { ns: number[] }
type ServiceData = Box & { title: string; sub: string; cost?: string }
type SurfaceData = Box & { title: string; path: string; sub: string }
type LegendData = Box

function Door({ data: d }: NodeProps<Node<DoorData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className={cn("flex flex-col justify-center rounded-xl px-4", d.planned ? "border-2 border-dashed border-slate-300 bg-white" : "bg-pax2-blue shadow-e1", d.big && "ring-4 ring-pax2-lavender")}>
      <p className={cn("flex items-center gap-2 font-semibold leading-tight", d.big ? "text-lg" : "text-[15px]", d.planned ? "text-slate-500" : "text-white")}>
        {d.title === "Button" && <FlaskConical className="size-4" />}
        {d.title}
        {d.planned && <span className="ml-auto rounded-full border border-dashed border-slate-300 px-1.5 text-[10px] font-medium text-slate-400">Planned</span>}
      </p>
      <p className={cn("mt-0.5 text-xs leading-snug", d.planned ? "text-slate-400" : "text-blue-100")}>{d.sub}</p>
      <Sides extra={d.extra} />
    </div>
  )
}

function Stage({ data: d }: NodeProps<Node<StageData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className="flex flex-col rounded-2xl border-2 border-pax2-light-blue bg-white px-5 py-4 shadow-e2">
      <p className="text-xl font-semibold text-pax2-blue">{d.title}</p>
      <dl className="mt-2 space-y-2">
        {d.rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[13px] font-semibold text-slate-900">{k}</dt>
            <dd className="text-xs leading-snug text-slate-600">{v}</dd>
          </div>
        ))}
      </dl>
      {d.foot?.length ? (
        <div className="mt-auto space-y-1 border-t border-slate-200 pt-3">
          {d.foot.map((f) => <p key={f} className="tabular text-sm font-semibold text-pax2-blue">{f}</p>)}
        </div>
      ) : null}
      <Sides extra={d.extra} />
    </div>
  )
}

function Store({ data: d }: NodeProps<Node<StoreData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className="flex flex-col rounded-[14px_14px_10px_10px] border border-slate-300 bg-slate-50 px-3.5 pb-2.5 pt-2 shadow-e1">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Database className="size-3" /> {d.service}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold text-slate-900">{d.title}</p>
      <p className="text-xs leading-snug text-slate-500">{d.sub}</p>
      {d.count && <p className="tabular mt-auto text-sm font-semibold text-pax2-blue">{d.count}</p>}
      <Sides extra={d.extra} />
    </div>
  )
}

function ChipBody({ c }: { c: Chip }) {
  return (
    <span className={cn("flex min-h-[34px] items-center gap-2 rounded-[18px] border py-1 pl-1 pr-3 text-xs font-semibold leading-tight", c.status === "Live" ? "border-indigo-200 bg-indigo-50 text-pax2-blue" : "border-indigo-200 bg-white text-pax2-blue")}>
      <span className="tabular flex size-[26px] shrink-0 items-center justify-center rounded-full bg-pax2-blue text-[11px] text-white">{c.n}</span>
      <span>{c.name}</span>
      {c.status === "Staged" && <span className="ml-auto shrink-0 text-[10px] font-medium text-slate-400">Staged</span>}
    </span>
  )
}

function Instrument({ data: d }: NodeProps<Node<ChipData>>) {
  return (
    <div style={{ width: d.w }}>
      <ChipBody c={model(d.n)} />
      <Sides extra={d.extra} />
    </div>
  )
}

function Rack({ data: d }: NodeProps<Node<RackData>>) {
  return (
    <div style={{ width: d.w }} className="grid grid-cols-2 gap-1.5 rounded-2xl border border-indigo-200 bg-white/80 p-3">
      {d.ns.map((n) => <ChipBody key={n} c={model(n)} />)}
      <Sides extra={d.extra} />
    </div>
  )
}

function Service({ data: d }: NodeProps<Node<ServiceData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className="flex flex-col justify-center rounded-xl border border-amber-300 bg-amber-50 px-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-950">
        <Server className="size-3.5 text-amber-700" /> {d.title}
      </p>
      <p className="text-xs leading-snug text-amber-900/80">{d.sub}</p>
      {d.cost && <p className="tabular mt-0.5 text-xs font-semibold text-amber-800">{d.cost}</p>}
      <Sides extra={d.extra} />
    </div>
  )
}

function Surface({ data: d }: NodeProps<Node<SurfaceData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className="flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-e1">
      <div className="flex h-4 shrink-0 items-center gap-1 bg-slate-100 px-2">
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-slate-300" />)}
        <span className="ml-1.5 font-mono text-[9px] text-slate-500">{d.path}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-3.5">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
          <Monitor className="size-3.5 text-slate-500" /> {d.title}
        </p>
        <p className="text-xs leading-snug text-slate-500">{d.sub}</p>
      </div>
      <Sides extra={d.extra} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The legend band: every node kind as a small sample, every edge kind as a drawn line, the four loops.

function Line({ kind }: { kind: "flow" | "loop" | "planned" }) {
  const color = kind === "loop" ? LOOP : kind === "planned" ? PLANNED : FLOW
  return (
    <svg width="72" height="12" className="shrink-0" aria-hidden>
      <defs>
        <marker id={`lg-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line x1="2" y1="6" x2="66" y2="6" stroke={color} strokeWidth={kind === "loop" ? 2.25 : 1.75} strokeDasharray={kind === "flow" ? undefined : kind === "loop" ? "5" : "6 5"} markerEnd={`url(#lg-${kind})`}>
        {kind === "loop" && <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.5s" repeatCount="indefinite" />}
      </line>
    </svg>
  )
}

const LOOPS: [number, string, string][] = [
  [1, "Re-entry", "Publish puts the video on the poller; its readings bring it back through the admin console as measured outcome."],
  [2, "Machine learning", "Every run's measurements join the catalog; the instruments refit from it."],
  [3, "Reinforcement learning", "Outcomes train the publish-next policy (15), which advises the next recording."],
  [4, "Questions", "A question asked in Chat runs through Q (14); the answer becomes a census column."],
]

function Kind({ sample, name, def }: { sample: React.ReactNode; name: string; def: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-9 w-[92px] shrink-0 items-center justify-center">{sample}</div>
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{name}</p>
        <p className="text-xs leading-snug text-slate-500">{def}</p>
      </div>
    </div>
  )
}

function Legend({ data: d }: NodeProps<Node<LegendData>>) {
  return (
    <div style={{ width: d.w, height: d.h }} className="flex gap-10 rounded-3xl border border-slate-200 bg-white px-9 py-7 shadow-e2">
      <p className="w-[300px] shrink-0 text-[34px] font-semibold leading-tight text-pax2-blue">The PAX2 factory</p>
      <div className="grid flex-1 grid-cols-3 content-start gap-x-8 gap-y-3.5">
        <Kind sample={<span className="h-8 w-20 rounded-lg bg-pax2-blue" />} name="Door" def="How a video enters. A dashed door is planned, not yet wired." />
        <Kind sample={<span className="h-8 w-20 rounded-xl border-2 border-pax2-light-blue bg-white" />} name="Stage" def="What the Lab does to the video, with the tools that do it." />
        <Kind sample={<span className="flex h-8 w-20 items-center justify-center rounded-[10px_10px_6px_6px] border border-slate-300 bg-slate-50"><Database className="size-3.5 text-slate-500" /></span>} name="Store" def="Where it is kept: S3 prefixes, the DynamoDB ledger, the catalog. The count is what it holds; a dated count is from the last accounting run." />
        <Kind sample={<span className="flex h-7 w-20 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-0.5"><span className="flex size-6 items-center justify-center rounded-full bg-pax2-blue text-[10px] font-semibold text-white">n</span></span>} name="Instrument" def="A fitted model, numbered to the Models table. Live serves today; Staged is fitted or in build, not yet serving." />
        <Kind sample={<span className="flex h-8 w-20 items-center justify-center rounded-lg border border-amber-300 bg-amber-50"><Server className="size-3.5 text-amber-700" /></span>} name="Service" def="A paid external the factory calls, with its unit cost where one is recorded." />
        <Kind sample={<span className="h-8 w-20 overflow-hidden rounded-lg border border-slate-300 bg-white"><span className="block h-2 bg-slate-100" /></span>} name="Surface" def="A page the factory feeds." />
        <Kind sample={<Line kind="flow" />} name="Flow" def="The video, or what was measured from it, moves on." />
        <Kind sample={<Line kind="loop" />} name="Loop" def="A result returns to re-enter the factory or train what runs in it." />
        <Kind sample={<Line kind="planned" />} name="Planned" def="Drawn where it will run; not yet wired." />
      </div>
      <div className="w-[560px] shrink-0 space-y-2 border-l border-slate-200 pl-8">
        {LOOPS.map(([n, name, def]) => (
          <div key={n} className="flex items-start gap-2.5">
            <LoopBadge n={n} />
            <p className="text-xs leading-snug text-slate-600">
              <span className="text-[13px] font-semibold text-violet-700">{name}.</span> {def}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoopBadge({ n }: { n: number }) {
  return <span className="tabular flex size-[18px] shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">{n}</span>
}

const nodeTypes = { door: Door, stage: Stage, store: Store, instrument: Instrument, rack: Rack, service: Service, surface: Surface, legend: Legend }

// ---------------------------------------------------------------------------------------------
// The one edge: a rounded orthogonal path, styled by kind, its label always drawn. `at` pins a label
// (the long rails); `offset` sets how far a rail runs past its lower or upper node.

type Kindof = "flow" | "loop" | "planned"
type FxData = { kind: Kindof; label: string; loop?: number; offset?: number; at?: [number, number] }

function FxEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<Edge<FxData>>) {
  const d = data!
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14, offset: d.offset ?? 22 })
  const [x, y] = d.at ?? [lx, ly]
  const color = d.kind === "loop" ? LOOP : d.kind === "planned" ? PLANNED : FLOW
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: d.kind === "loop" ? 2.25 : 1.75, ...(d.kind === "planned" && { strokeDasharray: "6 5" }) }} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
          className={cn(
            "pointer-events-none absolute flex max-w-[170px] items-center gap-1.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] leading-tight ring-1",
            d.kind === "loop" ? "font-medium text-violet-800 ring-violet-200" : d.kind === "planned" ? "italic text-slate-400 ring-slate-200" : "text-slate-600 ring-slate-200",
          )}
        >
          {d.loop && <LoopBadge n={d.loop} />}
          <span>{d.label}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { fx: FxEdge }

// ---------------------------------------------------------------------------------------------
// The drawing. Columns: doors 0, intake stores 380, Measure 780, Score 1260, Review 1640,
// Publish 1980, surfaces 2560, the services and instruments that feed surfaces 2940.

const MEASURE_Y = 380
// Measure's left handles sit level with the door or store that feeds each one.
const ML = (id: string, y: number): Extra => ({ id, side: "l", at: y - MEASURE_Y })

function build(c: FactoryCounts): { nodes: Node[]; edges: Edge[] } {
  const asOf = (n: number | null, what: string) => (n == null ? null : `${fmt(n)} ${what}${c.asOf ? ` · ${c.asOf}` : ""}`)
  const n = (id: string, type: string, x: number, y: number, data: Record<string, unknown>): Node => ({ id, type, position: { x, y }, data, draggable: false, selectable: false })

  const nodes: Node[] = [
    n("legend", "legend", -480, -470, { w: 3660, h: 290 }),

    // Doors
    n("record", "door", 0, 330, { w: 240, h: 72, title: "Record", sub: "a take in the studio, in the browser" }),
    n("upload", "door", 0, 440, { w: 240, h: 72, title: "Upload", sub: "the owner's own file" }),
    n("button", "door", 0, 550, { w: 240, h: 72, title: "Button", sub: "the flask on any video card, opening /lab" }),
    n("scrape", "door", 0, 660, { w: 240, h: 72, title: "Batch scrape", sub: "admin console: fetch a list of shorts", planned: true }),
    n("process", "door", 0, 760, { w: 240, h: 72, title: "Batch process", sub: "admin console: measure what is held", planned: true }),
    n("oauth", "door", 0, 860, { w: 240, h: 110, title: "OAuth", sub: "a client connects their YouTube channel", big: true }),
    n("admin", "door", 0, 1010, { w: 240, h: 92, title: "Admin console", sub: "the poller's live and finished tables on /tracking" }),
    n("p15", "instrument", -480, 346, { w: 260, n: 15 }),

    // Intake stores
    n("uploads", "store", 380, 369, { w: 260, h: 104, service: "Amazon S3", title: "uploads/", sub: "every recorded or uploaded take, as mp4" }),
    n("media", "store", 380, 644, { w: 260, h: 104, service: "Amazon S3", title: "catalog-media/", sub: "catalog shorts: 360p mp4 and m4a", count: asOf(c.media, "shorts held") }),
    n("ledger", "store", 380, 863, { w: 260, h: 104, service: "Amazon DynamoDB", title: "pax2-ledger", sub: "append-only: takes, reads, channel runs, the fetch queue" }),

    // Above Measure
    n("polly", "service", 0, 170, { w: 240, h: 88, title: "Amazon Polly", sub: "neural narration for a script" }),
    n("ec2", "service", 380, 200, { w: 240, h: 88, title: "Amazon EC2", sub: "self-terminating boxes", cost: "about 1.5¢ an upload (c7i.large)" }),
    n("composition", "store", 700, 60, { w: 220, h: 104, service: "Amazon S3", title: "composition/", sub: "per short: cuts, loudness, text", count: c.composition == null ? null : `${fmt(c.composition)} shorts measured` }),
    n("index", "store", 1000, 60, { w: 240, h: 104, service: "Amazon S3", title: "model/encoder-index/", sub: "the serving index", count: asOf(c.index, "embedded") }),
    n("i4", "instrument", 980, 230, { w: 280, n: 4 }),
    n("catalog", "store", 1300, 120, { w: 260, h: 104, service: "Catalog JSON", title: "feed-index.json", sub: "every catalog short and its measured columns", count: c.catalog == null ? null : `${fmt(c.catalog)} shorts`, extra: [{ id: "t-q", side: "t", at: 60 }, { id: "t-home", side: "t", at: 200 }] }),
    n("rack", "rack", 1680, 20, { w: 600, ns: [1, 2, 5, 6, 7, 8, 9, 10, 11, 12] }),
    n("q14", "instrument", 2200, 440, { w: 240, n: 14 }),

    // Stages
    n("measure", "stage", 780, MEASURE_Y, {
      w: 340, h: 790, title: "Measure",
      rows: [
        ["ffmpeg", "the scene score of every frame, for cuts and pace; EBU R128 loudness each second"],
        ["ffprobe", "each file's duration"],
        ["Tesseract OCR", "on-screen text, one frame a second"],
        ["Whisper", "a word-timed transcript from the audio"],
        ["Captions", "YouTube's own, through the proxy fleet and TranscriptAPI"],
        ["Text embedding", "title, description and transcript into the serving index"],
        ["Where it runs", "one self-terminating EC2 box per upload; a fleet of them for the catalog"],
      ],
      foot: [asOf(c.transcripts, "transcripts")].filter(Boolean),
      extra: [
        ML("l-uploads", 421), ML("l-button", 586), ML("l-media", 696), ML("l-process", 796), ML("l-ledger", 915), ML("l-admin", 1056),
        { id: "r-score", side: "r", at: 200 },
        { id: "r-cat", side: "r", at: 40 },
        { id: "t-ec2", side: "t", at: 20 }, { id: "t-comp", side: "t", at: 60 }, { id: "t-i4", side: "t", at: 280 },
      ],
    }),
    n("score", "stage", 1260, 490, {
      w: 280, h: 180, title: "Score",
      rows: [["The read", "outlier chance, headline pick, neighbors re-scored, persuasion evidence, the pair picker's call"]],
      extra: [{ id: "t-rack", side: "t", at: 200 }, { id: "t-q", side: "t", at: 250 }],
    }),
    n("review", "stage", 1640, 520, { w: 240, h: 120, title: "Review", rows: [["PAX review", "the flask granted, the link sent"]] }),
    n("publish", "stage", 1980, 520, { w: 240, h: 120, title: "Publish", rows: [["On YouTube", "the poller watches it for 72 hours"]] }),

    // Below the main line
    n("readings", "store", 1980, 790, {
      w: 240, h: 104, service: "Amazon S3", title: "velocity/", sub: "the poller's readings, every 15 minutes",
      count: c.window == null ? null : `${fmt(c.window)} shorts in the 72-hour window${c.channels ? ` · ${fmt(c.channels)} channels` : ""}`,
    }),

    // Surfaces and what feeds them
    n("home", "surface", 2560, 130, { w: 240, h: 72, title: "Home feed", path: "/home", sub: "every short, ranked" }),
    n("chat", "surface", 2560, 300, { w: 240, h: 72, title: "Chat", path: "/chat", sub: "answers from the record" }),
    n("tracking", "surface", 2560, 806, { w: 240, h: 72, title: "Tracking", path: "/tracking", sub: "curves against the channel median" }),
    n("vpages", "surface", 2560, 1000, { w: 240, h: 72, title: "Video pages", path: "/v", sub: "each video's measured record" }),
    n("i13", "instrument", 2940, 146, { w: 240, n: 13 }),
    n("bedrock", "service", 2940, 292, { w: 240, h: 88, title: "Amazon Bedrock", sub: "Chat's written answers" }),
    n("i3", "instrument", 2940, 822, { w: 240, n: 3 }),
  ]

  const e = (id: string, source: string, sh: string, target: string, th: string, data: FxData): Edge => {
    const color = data.kind === "loop" ? LOOP : data.kind === "planned" ? PLANNED : FLOW
    return {
      id, source, sourceHandle: sh, target, targetHandle: th, type: "fx", data,
      animated: data.kind === "loop",
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      zIndex: data.kind === "loop" ? 1 : 0,
    }
  }
  const flow = (label: string, more: Partial<FxData> = {}): FxData => ({ kind: "flow", label, ...more })
  const loop = (loopN: number, label: string, more: Partial<FxData> = {}): FxData => ({ kind: "loop", loop: loopN, label, ...more })
  const planned = (label: string, more: Partial<FxData> = {}): FxData => ({ kind: "planned", label, ...more })

  const edges: Edge[] = [
    // Into the factory
    e("polly-record", "polly", "b", "record", "t", flow("narration")),
    e("record-uploads", "record", "r", "uploads", "l", flow("webm, transcoded to mp4")),
    e("upload-uploads", "upload", "r", "uploads", "l", flow("mp4")),
    e("uploads-measure", "uploads", "r", "measure", "l-uploads", flow("the S3 event starts a box")),
    e("button-measure", "button", "r", "measure", "l-button", planned("an unmeasured video through the boxes", { at: [510, 586] })),
    e("scrape-media", "scrape", "r", "media", "l", planned("fetches the files")),
    e("media-measure", "media", "r", "measure", "l-media", flow("mp4 and m4a")),
    e("process-measure", "process", "r", "measure", "l-process", planned("a held batch through Measure", { at: [510, 796] })),
    e("oauth-ledger", "oauth", "r", "ledger", "l", flow("catalog, analytics totals, retention curves")),
    e("ledger-measure", "ledger", "r", "measure", "l-ledger", planned("queued public videos, once the fetch worker is built")),
    e("ec2-measure", "ec2", "b", "measure", "t-ec2", flow("runs every measurement")),

    // Measure's outputs
    e("measure-composition", "measure", "t-comp", "composition", "b", flow("cuts, loudness, on-screen text")),
    e("measure-i4", "measure", "t-i4", "i4", "b", flow("transcript")),
    e("i4-index", "i4", "t", "index", "b", flow("embedding")),
    e("measure-score", "measure", "r-score", "score", "l", flow("the measured record")),

    // Score, Review, Publish
    e("rack-score", "rack", "b", "score", "t-rack", flow("2, 5, 6, 7 and 8 read each take")),
    e("q14-score", "q14", "l", "score", "t-q", flow("asks it anything", { at: [2050, 457] })),
    e("score-review", "score", "r", "review", "l", flow("the read")),
    e("review-publish", "review", "r", "publish", "l", flow("link sent")),
    e("score-ledger", "score", "b", "ledger", "b", flow("the read, saved with the video", { offset: 293, at: [1000, 1260] })),
    e("ledger-vpages", "ledger", "b", "vpages", "b", flow("each video's record", { offset: 228, at: [1800, 1300] })),

    // Watching
    e("readings-tracking", "readings", "r", "tracking", "l", flow("live and finished tables")),
    e("readings-i3", "readings", "t", "i3", "t", flow("first hours of views", { offset: 30, at: [2860, 760] })),
    e("i3-tracking", "i3", "l", "tracking", "r", flow("early-hit read at 72 hours")),

    // What feeds the surfaces
    e("catalog-home", "catalog", "t-home", "home", "t", flow("the feed index", { offset: 220, at: [2100, -100] })),
    e("i13-home", "i13", "l", "home", "r", flow("reader-channel affinity it measured")),
    e("bedrock-chat", "bedrock", "l", "chat", "r", flow("written answers")),

    // Loop 1: published, polled, back in as measured outcome
    e("publish-readings", "publish", "b", "readings", "t", loop(1, "on the poller, read every 15 minutes")),
    e("readings-admin", "readings", "b", "admin", "b", loop(1, "outcomes, views against the channel median", { offset: 248, at: [1400, 1350] })),
    e("admin-measure", "admin", "r", "measure", "l-admin", loop(1, "re-enters as measured outcome", { at: [690, 1056] })),
    // Loop 2: measurements join the catalog; the instruments refit from it
    e("measure-catalog", "measure", "r-cat", "catalog", "b", loop(2, "measurements join the catalog", { at: [1430, 320] })),
    e("catalog-rack", "catalog", "r", "rack", "l", loop(2, "refit")),
    // Loop 3: outcomes train P, P advises the next recording
    e("readings-p15", "readings", "b", "p15", "b", loop(3, "outcomes train the policy", { offset: 506, at: [600, 1400] })),
    e("p15-record", "p15", "r", "record", "l", loop(3, "advises the next recording")),
    // Loop 4: questions through Q become census columns
    e("chat-q14", "chat", "l", "q14", "r", loop(4, "a question asked in Chat")),
    e("q14-catalog", "q14", "t", "catalog", "t-q", loop(4, "the answer, a census column", { offset: 150, at: [1900, -30] })),
  ]
  return { nodes, edges }
}

function Canvas({ counts }: { counts: FactoryCounts }) {
  const { nodes, edges } = React.useMemo(() => build(counts), [counts])
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.04 }}
      minZoom={0.08}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#cbd5e1" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

export function FactoryCanvas({ counts }: { counts: FactoryCounts }) {
  return (
    <div className="relative flex min-h-[70dvh] min-w-0 flex-1 bg-pax2-mist">
      <ReactFlowProvider>
        <Canvas counts={counts} />
      </ReactFlowProvider>
    </div>
  )
}
