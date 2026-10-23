"use client"

import * as React from "react"
import {
  Background, BackgroundVariant, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle,
  MarkerType, Position, ReactFlow, ReactFlowProvider,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react"
import { Database, FlaskConical, Monitor, Server, Settings2, X } from "lucide-react"

import { whiteButton } from "@/components/white-button"
import { cn } from "@/ui/lib/utils"

// /erd (once /pipeline-2): the whole PAX2 factory as one fixed diagram on the xyflow canvas. Six node kinds
// (door, stage, store, instrument, service, surface) and three edge kinds (flow, loop, planned), all defined
// in the legend, which slides in from the left inside the page (the config button). Instrument numbers are
// the rows of the Models table on docs/ACCOUNTING.html (scripts/accounting.mjs). Planned parts draw dashed:
// nothing unwired draws solid. Every position derives from the column and row constants above build(), so
// the columns stay aligned and the long return edges run as rails under the main line.

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
      {d.count && <p className="tabular mt-auto text-[13px] font-semibold leading-snug text-pax2-blue">{d.count}</p>}
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

const nodeTypes = { door: Door, stage: Stage, store: Store, instrument: Instrument, rack: Rack, service: Service, surface: Surface }

// ---------------------------------------------------------------------------------------------
// The legend: every node kind as a small sample, every edge kind as a drawn line, the four loops. It lives
// in the page's left sidebar, so the canvas keeps the whole card for the drawing.

function Line({ kind }: { kind: "flow" | "loop" | "planned" }) {
  const color = kind === "loop" ? LOOP : kind === "planned" ? PLANNED : FLOW
  return (
    <svg width="64" height="12" className="shrink-0" aria-hidden>
      <defs>
        <marker id={`lg-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line x1="2" y1="6" x2="58" y2="6" stroke={color} strokeWidth={kind === "loop" ? 2.25 : 1.75} strokeDasharray={kind === "flow" ? undefined : kind === "loop" ? "5" : "6 5"} markerEnd={`url(#lg-${kind})`}>
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
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-16 shrink-0 items-center justify-center">{sample}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900">{name}</p>
        <p className="text-xs leading-snug text-slate-500">{def}</p>
      </div>
    </div>
  )
}

function LoopBadge({ n }: { n: number }) {
  return <span className="tabular flex size-[18px] shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">{n}</span>
}

function Legend({ onClose }: { onClose: () => void }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-500 bg-pax2-mist shadow-e2">
      <div className="flex min-h-[73px] shrink-0 items-center justify-between gap-3 px-6 py-4">
        <p className="truncate font-display text-xl text-slate-900">The PAX2 factory</p>
        <button type="button" onClick={onClose} className={whiteButton("circle")} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-slate-200/70 px-6 py-5">
        <div className="space-y-3">
          <Kind sample={<span className="h-7 w-14 rounded-lg bg-pax2-blue" />} name="Door" def="How a video enters. A dashed door is planned, not yet wired." />
          <Kind sample={<span className="h-7 w-14 rounded-xl border-2 border-pax2-light-blue bg-white" />} name="Stage" def="What the Lab does to the video, with the tools that do it." />
          <Kind sample={<span className="flex h-7 w-14 items-center justify-center rounded-[10px_10px_6px_6px] border border-slate-300 bg-slate-50"><Database className="size-3.5 text-slate-500" /></span>} name="Store" def="Where it is kept: S3 prefixes, the DynamoDB ledger, the catalog. The count is what it holds; a dated count is from the last accounting run." />
          <Kind sample={<span className="flex h-7 w-14 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-0.5"><span className="flex size-6 items-center justify-center rounded-full bg-pax2-blue text-[10px] font-semibold text-white">n</span></span>} name="Instrument" def="A fitted model, numbered to the Models table. Live serves today; Staged is fitted or in build, not yet serving." />
          <Kind sample={<span className="flex h-7 w-14 items-center justify-center rounded-lg border border-amber-300 bg-amber-50"><Server className="size-3.5 text-amber-700" /></span>} name="Service" def="A paid external the factory calls, with its unit cost where one is recorded." />
          <Kind sample={<span className="h-7 w-14 overflow-hidden rounded-lg border border-slate-300 bg-white"><span className="block h-2 bg-slate-100" /></span>} name="Surface" def="A page the factory feeds." />
        </div>
        <div className="space-y-3 border-t border-slate-200/70 pt-5">
          <Kind sample={<Line kind="flow" />} name="Flow" def="The video, or what was measured from it, moves on." />
          <Kind sample={<Line kind="loop" />} name="Loop" def="A result returns to re-enter the factory or train what runs in it." />
          <Kind sample={<Line kind="planned" />} name="Planned" def="Drawn where it will run; not yet wired." />
        </div>
        <div className="space-y-2.5 border-t border-slate-200/70 pt-5">
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
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// The one edge: a rounded orthogonal path, styled by kind, its label always drawn. `at` pins a label
// (the long rails); `offset` sets how far a rail runs past its lower or upper node. A label in a column
// gap wraps to the gap; `wide` lets a rail's label run on one line.

type Kindof = "flow" | "loop" | "planned"
type FxData = { kind: Kindof; label: string; loop?: number; offset?: number; at?: [number, number]; wide?: boolean }

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
          style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, maxWidth: d.wide ? 280 : LABEL_W }}
          className={cn(
            "pointer-events-none absolute flex w-max items-center gap-1.5 rounded-md bg-white px-1.5 py-0.5 text-xs leading-tight ring-1",
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
// The drawing's grid. Columns run left to right a gap apart; the doors stack a step apart, and each intake
// store, Measure's left handles and the stores' edges sit level with the door that feeds them.

const GAP = 110 // between columns
const STEP_GAP = 90 // Score, Review and Publish, whose labels are a word or two
const LABEL_W = GAP - 10 // a gap label wraps to the gap

const W = { door: 190, store: 220, service: 190, surface: 190, measure: 270, score: 290, step: 190, comp: 190, index: 210, catalog: 210, rack: 500, chip: 190, p15: 230, i4: 230, q14: 200 }
const CHIP_H = 38 // an instrument chip whose name runs to two lines

const X_DOOR = 0
const X_P15 = X_DOOR - GAP - W.p15
const X_STORE = X_DOOR + W.door + GAP
const X_MEASURE = X_STORE + W.store + GAP
const X_SCORE = X_MEASURE + W.measure + GAP
const X_REVIEW = X_SCORE + W.score + STEP_GAP
const X_PUBLISH = X_REVIEW + W.step + STEP_GAP
const X_COMP = X_MEASURE // the top row starts level with Measure
const X_INDEX = X_COMP + W.comp + 24
const X_CATALOG = X_SCORE + W.score - W.catalog // right-aligned with Score
const X_RACK = X_CATALOG + W.catalog + GAP
const X_Q14 = X_RACK + W.rack + 20 // clear of the rack, so its rail rises beside it
const X_SURFACE = X_Q14 + W.q14 + GAP
const X_RIGHT = X_SURFACE + W.surface + GAP

// Rows. The doors, 64 tall and 24 apart.
const DOOR_H = 64
const Y_DOOR = 330
const doorY = (i: number) => Y_DOOR + i * (DOOR_H + 24)
const Y_OAUTH = doorY(5)
const OAUTH_H = 92
const Y_ADMIN = Y_OAUTH + OAUTH_H + 24
const ADMIN_H = 80
const mid = (y: number, h: number) => y + h / 2
const C = {
  record: mid(doorY(0), DOOR_H),
  upload: mid(doorY(1), DOOR_H),
  button: mid(doorY(2), DOOR_H),
  scrape: mid(doorY(3), DOOR_H),
  process: mid(doorY(4), DOOR_H),
  oauth: mid(Y_OAUTH, OAUTH_H),
  admin: mid(Y_ADMIN, ADMIN_H),
}
const Y_TOP = 80 // the stores above Measure, and the rack
const TOP_H = 112
const Y_SERVICE = 206 // Polly and EC2, top-aligned
const SERVICE_H = 80
const MEASURE_Y = 340
const MEASURE_H = Y_ADMIN + ADMIN_H + 34 - MEASURE_Y
const Y_MAIN = 500 // the main line's center: Measure's right handle, Score, Review, Publish
const Y_Q14 = 405 // Q's center, between the rack and Score
const READINGS_H = 132
const Y_READINGS = Y_MAIN + 60 + 80 // under Publish
const Y_WATCH = mid(Y_READINGS, READINGS_H) // readings, Tracking and the early-hit chip share a center line
const SURFACE_H = 64
// The rails: two over the top, four under the bottom, 40 apart.
const RAIL_TOP = [0, 40]
const RAIL_BOTTOM = [1040, 1080, 1120, 1160]

// Measure's left handles sit level with the door or store that feeds each one.
const ML = (id: string, y: number): Extra => ({ id, side: "l", at: y - MEASURE_Y })

export function build(c: FactoryCounts): { nodes: Node[]; edges: Edge[] } {
  const asOf = (n: number | null, what: string) => (n == null ? null : `${fmt(n)} ${what}${c.asOf ? ` · ${c.asOf}` : ""}`)
  const n = (id: string, type: string, x: number, y: number, data: Record<string, unknown>): Node => ({ id, type, position: { x, y }, data, draggable: false, selectable: false })
  const centered = (cy: number, h: number) => cy - h / 2
  const cx = (x: number, w: number) => x + w / 2

  const nodes: Node[] = [
    // Doors
    n("record", "door", X_DOOR, doorY(0), { w: W.door, h: DOOR_H, title: "Record", sub: "a take in the studio, in the browser" }),
    n("upload", "door", X_DOOR, doorY(1), { w: W.door, h: DOOR_H, title: "Upload", sub: "the owner's own file" }),
    n("button", "door", X_DOOR, doorY(2), { w: W.door, h: DOOR_H, title: "Button", sub: "the flask on any video card, opening /lab" }),
    n("scrape", "door", X_DOOR, doorY(3), { w: W.door, h: DOOR_H, title: "Batch scrape", sub: "admin console: fetch a list of shorts", planned: true }),
    n("process", "door", X_DOOR, doorY(4), { w: W.door, h: DOOR_H, title: "Batch process", sub: "admin console: measure what is held", planned: true }),
    n("oauth", "door", X_DOOR, Y_OAUTH, { w: W.door, h: OAUTH_H, title: "OAuth", sub: "a client connects their YouTube channel", big: true }),
    n("admin", "door", X_DOOR, Y_ADMIN, { w: W.door, h: ADMIN_H, title: "Admin console", sub: "the poller's live and finished tables on /tracking" }),
    n("p15", "instrument", X_P15, centered(C.record, CHIP_H), { w: W.p15, n: 15 }),

    // Intake stores, each level with what feeds it
    n("uploads", "store", X_STORE, centered((C.record + C.upload) / 2, 96), { w: W.store, h: 96, service: "Amazon S3", title: "uploads/", sub: "every recorded or uploaded take, as mp4" }),
    n("media", "store", X_STORE, centered(C.scrape, 104), { w: W.store, h: 104, service: "Amazon S3", title: "catalog-media/", sub: "catalog shorts: 360p mp4 and m4a", count: asOf(c.media, "shorts held") }),
    n("ledger", "store", X_STORE, centered(C.oauth, 96), { w: W.store, h: 96, service: "Amazon DynamoDB", title: "pax2-ledger", sub: "append-only: takes, reads, channel runs, the fetch queue" }),

    // Above Measure
    n("polly", "service", X_DOOR, Y_SERVICE, { w: W.door, h: SERVICE_H, title: "Amazon Polly", sub: "neural narration for a script" }),
    n("ec2", "service", X_STORE, Y_SERVICE, { w: W.service, h: SERVICE_H, title: "Amazon EC2", sub: "self-terminating boxes", cost: "about 1.5¢ an upload (c7i.large)" }),
    n("composition", "store", X_COMP, Y_TOP, { w: W.comp, h: TOP_H, service: "Amazon S3", title: "composition/", sub: "per short: cuts, loudness, text", count: c.composition == null ? null : `${fmt(c.composition)} shorts measured` }),
    n("index", "store", X_INDEX, Y_TOP, { w: W.index, h: TOP_H, service: "Amazon S3", title: "model/encoder-index/", sub: "the serving index", count: asOf(c.index, "embedded") }),
    n("i4", "instrument", cx(X_INDEX, W.index) - W.i4 / 2, Y_TOP + TOP_H + 44, { w: W.i4, n: 4 }),
    n("catalog", "store", X_CATALOG, Y_TOP, { w: W.catalog, h: TOP_H, service: "Catalog JSON", title: "feed-index.json", sub: "every catalog short and its measured columns", count: c.catalog == null ? null : `${fmt(c.catalog)} shorts`, extra: [{ id: "t-q", side: "t", at: 50 }, { id: "t-home", side: "t", at: 180 }] }),
    n("rack", "rack", X_RACK, Y_TOP, { w: W.rack, ns: [1, 2, 5, 6, 7, 8, 9, 10, 11, 12] }),
    n("q14", "instrument", X_Q14, centered(Y_Q14, CHIP_H), { w: W.q14, n: 14 }),

    // Stages
    n("measure", "stage", X_MEASURE, MEASURE_Y, {
      w: W.measure, h: MEASURE_H, title: "Measure",
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
        ML("l-uploads", (C.record + C.upload) / 2), ML("l-button", C.button), ML("l-media", C.scrape), ML("l-process", C.process), ML("l-ledger", C.oauth), ML("l-admin", C.admin),
        { id: "r-score", side: "r", at: Y_MAIN - MEASURE_Y },
        { id: "r-cat", side: "r", at: 40 },
        { id: "t-ec2", side: "t", at: 20 }, { id: "t-comp", side: "t", at: W.comp / 2 }, { id: "t-i4", side: "t", at: 250 },
      ],
    }),
    n("score", "stage", X_SCORE, centered(Y_MAIN, 140), {
      w: W.score, h: 140, title: "Score",
      rows: [["The read", "outlier chance, headline pick, neighbors re-scored, persuasion evidence, the pair picker's call"]],
      extra: [{ id: "t-rack", side: "t", at: 235 }, { id: "t-q", side: "t", at: 275 }],
    }),
    n("review", "stage", X_REVIEW, centered(Y_MAIN, 120), { w: W.step, h: 120, title: "Review", rows: [["PAX review", "the flask granted, the link sent"]] }),
    n("publish", "stage", X_PUBLISH, centered(Y_MAIN, 120), { w: W.step, h: 120, title: "Publish", rows: [["On YouTube", "the poller watches it for 72 hours"]] }),

    // Below the main line
    n("readings", "store", cx(X_PUBLISH, W.step) - W.store / 2, Y_READINGS, {
      w: W.store, h: READINGS_H, service: "Amazon S3", title: "velocity/", sub: "the poller's readings, every 15 minutes",
      count: c.window == null ? null : `${fmt(c.window)} shorts in the 72-hour window${c.channels ? ` · ${fmt(c.channels)} channels` : ""}`,
    }),

    // Surfaces and what feeds them
    n("home", "surface", X_SURFACE, 100, { w: W.surface, h: SURFACE_H, title: "Home feed", path: "/home", sub: "every short, ranked" }),
    n("chat", "surface", X_SURFACE, 262, { w: W.surface, h: SURFACE_H, title: "Chat", path: "/chat", sub: "answers from the record" }),
    n("tracking", "surface", X_SURFACE, centered(Y_WATCH, SURFACE_H), { w: W.surface, h: SURFACE_H, title: "Tracking", path: "/tracking", sub: "curves against the channel median" }),
    n("vpages", "surface", X_SURFACE, centered(Y_WATCH, SURFACE_H) + SURFACE_H + 92, { w: W.surface, h: SURFACE_H, title: "Video pages", path: "/v", sub: "each video's measured record" }),
    n("i13", "instrument", X_RIGHT, centered(100 + SURFACE_H / 2, CHIP_H), { w: W.chip, n: 13 }),
    n("bedrock", "service", X_RIGHT, centered(262 + SURFACE_H / 2, SERVICE_H), { w: W.chip, h: SERVICE_H, title: "Amazon Bedrock", sub: "Chat's written answers" }),
    n("i3", "instrument", X_RIGHT, centered(Y_WATCH, CHIP_H), { w: W.chip, n: 3 }),
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

  // Where a pinned label sits: the middle of the intake stores' column, or of a gap.
  const storeMid = cx(X_STORE, W.store)
  const gapMid = (left: number) => left + GAP / 2
  // A rail's offset: how far past its lower (or upper) node it runs to reach its row.
  const below = (row: number, ...bottoms: number[]) => row - Math.max(...bottoms)
  const above = (row: number, ...tops: number[]) => Math.min(...tops) - row
  const bottom = (id: string) => {
    const node = nodes.find((x) => x.id === id)!
    return node.position.y + ((node.data as Box).h ?? CHIP_H)
  }

  const edges: Edge[] = [
    // Into the factory
    e("polly-record", "polly", "b", "record", "t", flow("narration")),
    e("record-uploads", "record", "r", "uploads", "l", flow("webm, transcoded to mp4")),
    e("upload-uploads", "upload", "r", "uploads", "l", flow("mp4")),
    e("uploads-measure", "uploads", "r", "measure", "l-uploads", flow("the S3 event starts a box")),
    e("button-measure", "button", "r", "measure", "l-button", planned("an unmeasured video through the boxes", { at: [storeMid, C.button] })),
    e("scrape-media", "scrape", "r", "media", "l", planned("fetches the files")),
    e("media-measure", "media", "r", "measure", "l-media", flow("mp4 and m4a")),
    e("process-measure", "process", "r", "measure", "l-process", planned("a held batch through Measure", { at: [storeMid, C.process] })),
    e("oauth-ledger", "oauth", "r", "ledger", "l", flow("catalog, analytics totals, retention curves")),
    e("ledger-measure", "ledger", "r", "measure", "l-ledger", planned("queued public videos, once the fetch worker is built")),
    e("ec2-measure", "ec2", "b", "measure", "t-ec2", flow("runs every measurement")),

    // Measure's outputs
    e("measure-composition", "measure", "t-comp", "composition", "b", flow("cuts, loudness, on-screen text")),
    e("measure-i4", "measure", "t-i4", "i4", "b", flow("transcript")),
    e("i4-index", "i4", "t", "index", "b", flow("embedding")),
    e("measure-score", "measure", "r-score", "score", "l", flow("the measured record")),

    // Score, Review, Publish
    e("rack-score", "rack", "b", "score", "t-rack", flow("2, 5, 6, 7 and 8 read each take", { wide: true })),
    e("q14-score", "q14", "l", "score", "t-q", flow("asks it anything", { wide: true, at: [X_PUBLISH + 130, Y_Q14] })),
    e("score-review", "score", "r", "review", "l", flow("the read")),
    e("review-publish", "review", "r", "publish", "l", flow("link sent")),
    e("score-ledger", "score", "b", "ledger", "b", flow("the read, saved with the video", { wide: true, offset: below(RAIL_BOTTOM[0], bottom("score"), bottom("ledger")), at: [X_MEASURE + W.measure + 60, RAIL_BOTTOM[0]] })),
    e("ledger-vpages", "ledger", "b", "vpages", "b", flow("each video's record", { wide: true, offset: below(RAIL_BOTTOM[1], bottom("ledger"), bottom("vpages")), at: [X_PUBLISH + 130, RAIL_BOTTOM[1]] })),

    // Watching
    e("readings-tracking", "readings", "r", "tracking", "l", flow("live and finished tables")),
    e("readings-i3", "readings", "t", "i3", "t", flow("first hours of views", { wide: true, offset: 30, at: [gapMid(X_SURFACE + W.surface), Y_READINGS - 30] })),
    e("i3-tracking", "i3", "l", "tracking", "r", flow("early-hit read at 72 hours")),

    // What feeds the surfaces
    e("catalog-home", "catalog", "t-home", "home", "t", flow("the feed index", { wide: true, offset: above(RAIL_TOP[0], Y_TOP, 100), at: [X_Q14 + W.q14 + 20, RAIL_TOP[0]] })),
    e("i13-home", "i13", "l", "home", "r", flow("reader-channel affinity it measured")),
    e("bedrock-chat", "bedrock", "l", "chat", "r", flow("written answers")),

    // Loop 1: published, polled, back in as measured outcome
    e("publish-readings", "publish", "b", "readings", "t", loop(1, "on the poller, read every 15 minutes")),
    e("readings-admin", "readings", "b", "admin", "b", loop(1, "outcomes, views against the channel median", { wide: true, offset: below(RAIL_BOTTOM[2], bottom("readings"), bottom("admin")), at: [X_SCORE + 130, RAIL_BOTTOM[2]] })),
    e("admin-measure", "admin", "r", "measure", "l-admin", loop(1, "re-enters as measured outcome", { at: [gapMid(X_STORE + W.store), C.admin] })),
    // Loop 2: measurements join the catalog; the instruments refit from it
    e("measure-catalog", "measure", "r-cat", "catalog", "b", loop(2, "measurements join the catalog", { at: [cx(X_CATALOG, W.catalog), (Y_TOP + TOP_H + MEASURE_Y + 40) / 2] })),
    e("catalog-rack", "catalog", "r", "rack", "l", loop(2, "refit")),
    // Loop 3: outcomes train P, P advises the next recording
    e("readings-p15", "readings", "b", "p15", "b", loop(3, "outcomes train the policy", { wide: true, offset: below(RAIL_BOTTOM[3], bottom("readings"), bottom("p15")), at: [X_STORE + 130, RAIL_BOTTOM[3]] })),
    e("p15-record", "p15", "r", "record", "l", loop(3, "advises the next recording")),
    // Loop 4: questions through Q become census columns
    e("chat-q14", "chat", "l", "q14", "r", loop(4, "a question asked in Chat")),
    e("q14-catalog", "q14", "t", "catalog", "t-q", loop(4, "the answer, a census column", { wide: true, offset: above(RAIL_TOP[1], Y_TOP, centered(Y_Q14, CHIP_H)), at: [X_RACK + W.rack / 2, RAIL_TOP[1]] })),
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
      fitViewOptions={{ padding: 0.02 }}
      minZoom={0.08}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#cbd5e1" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  )
}

/** The canvas, with the legend in a sidebar the config button slides in from the left, inside the page. */
export function FactoryCanvas({ counts }: { counts: FactoryCounts }) {
  const [legend, setLegend] = React.useState(false)
  return (
    <div className="relative flex min-h-[70dvh] min-w-0 flex-1 overflow-hidden bg-pax2-mist">
      <ReactFlowProvider>
        <Canvas counts={counts} />
      </ReactFlowProvider>
      <button type="button" onClick={() => setLegend(true)} aria-label="Legend" title="Legend" aria-expanded={legend} className={whiteButton("circle", cn("absolute left-4 top-4 z-10 transition-opacity", legend && "pointer-events-none opacity-0"))}>
        <Settings2 className="size-4" />
      </button>
      <div className={cn("absolute inset-y-4 left-4 z-20 w-[min(360px,calc(100%-32px))] transition-transform duration-300 ease-in-out", legend ? "translate-x-0" : "-translate-x-[calc(100%+24px)]")} aria-hidden={!legend}>
        <Legend onClose={() => setLegend(false)} />
      </div>
    </div>
  )
}
