"use client"

import * as React from "react"
import {
  Background, BackgroundVariant, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle,
  MarkerType, Position, ReactFlow, ReactFlowProvider,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react"
import {
  AudioLines, Binary, ChartLine, Clock, Columns3, Cpu, Database, Eye, FileBraces, FileText, Film, FlaskConical, GraduationCap, HardDrive, Layers,
  Lightbulb, ListVideo, Magnet, Mail, MessageCircleQuestionMark, Monitor, PenLine, RefreshCw, RotateCcw, Rss, Ruler, Save, Scissors, ScrollText,
  ScanEye, Search, Server, Settings2, Table, Timer, TrendingUp, X, Zap, type LucideIcon,
} from "lucide-react"

import { whiteButton } from "@/components/white-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/nova/tabs"
import { cn } from "@/ui/lib/utils"

// /erd (once /pipeline-2): the whole PAX2 factory as one fixed diagram on the xyflow canvas. Six node kinds
// (door, stage, store, instrument, service, surface) and three edge kinds (flow, loop, planned). Boxes carry
// their names and live counts; what each one is shows on hover. Each edge carries an icon chip, blue for flow,
// purple for a loop with its number, dashed for planned; its words show on hover. The sidebar the config
// button slides in from the left, inside the page, holds the key: Factory (the kinds and the loops) and
// Widgets (every chip and its words). Clicking an entry lights its boxes or lines and dims the rest.
// Instrument numbers are the rows of the Models table on docs/ACCOUNTING.html (scripts/accounting.mjs).
// Every position derives from the column and row constants above build().

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
const LIGHT: Record<Kindof, string> = { flow: "#3b82f6", loop: "#c4b5fd", planned: "#94a3b8" }

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
// What's lit: the boxes and lines a sidebar entry points at. Everything else dims while one is.

type NodeKind = "door" | "stage" | "store" | "instrument" | "service" | "surface"
type Kindof = "flow" | "loop" | "planned"
export type Focus = { on: "kind"; kind: NodeKind } | { on: "edges"; kind: Kindof } | { on: "loop"; n: number } | { on: "edge"; id: string } | null
type Lit = { nodes: Set<string>; edges: Set<string> } | null

const LitCtx = React.createContext<Lit>(null)
const useLit = (set: "nodes" | "edges", id: string): "lit" | "dim" | null => {
  const lit = React.useContext(LitCtx)
  return lit ? (lit[set].has(id) ? "lit" : "dim") : null
}
const glow = (s: "lit" | "dim" | null) => cn("transition-opacity duration-300", s === "lit" && "erd-lit", s === "dim" && "opacity-20")

function lights(focus: Focus, nodes: Node[], edges: Edge[]): Lit {
  if (!focus) return null
  const ns = new Set<string>()
  const es = new Set<string>()
  const kindOf = (n: Node) => (n.type === "rack" ? "instrument" : n.type)
  const ends = (e: Edge) => (es.add(e.id), ns.add(e.source), ns.add(e.target))
  if (focus.on === "kind") for (const n of nodes) kindOf(n) === focus.kind && ns.add(n.id)
  if (focus.on === "edges") {
    for (const e of edges) (e.data as FxData).kind === focus.kind && es.add(e.id)
    if (focus.kind === "planned") for (const n of nodes) (n.data as { planned?: boolean }).planned && ns.add(n.id)
  }
  if (focus.on === "loop") for (const e of edges) (e.data as FxData).loop === focus.n && ends(e)
  if (focus.on === "edge") for (const e of edges) e.id === focus.id && ends(e)
  return { nodes: ns, edges: es }
}

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
// The six node kinds: a name, a count where there is one; `about` is the hover.

type Box = { w: number; h: number; extra?: Extra[]; about?: string }
type DoorData = Box & { title: string; planned?: boolean; big?: boolean }
type StageData = Box & { title: string; tools?: [string, string][]; foot?: string[] }
type StoreData = Box & { service: "Amazon S3" | "Amazon DynamoDB" | "Catalog JSON"; title: string; count?: string | null }
type ChipData = Box & { n: number }
type RackData = Box & { ns: number[] }
type ServiceData = Box & { title: string; cost?: string }
type SurfaceData = Box & { title: string; path: string }

const STORE_ICON: Record<StoreData["service"], LucideIcon> = { "Amazon S3": HardDrive, "Amazon DynamoDB": Database, "Catalog JSON": FileBraces }

function Door({ id, data: d }: NodeProps<Node<DoorData>>) {
  return (
    <div title={d.about} style={{ width: d.w, height: d.h }} className={cn("flex items-center justify-center gap-2 rounded-xl px-3", d.planned ? "border-2 border-dashed border-slate-300 bg-white" : "bg-pax2-blue shadow-e1", d.big && "ring-4 ring-pax2-lavender", glow(useLit("nodes", id)))}>
      {d.title === "Button" && <FlaskConical className="size-4 shrink-0 text-white" />}
      <span className={cn("font-semibold leading-tight", d.big ? "text-lg" : "text-[15px]", d.planned ? "text-slate-500" : "text-white")}>{d.title}</span>
      <Sides extra={d.extra} />
    </div>
  )
}

function Stage({ id, data: d }: NodeProps<Node<StageData>>) {
  return (
    <div title={d.about} style={{ width: d.w, height: d.h }} className={cn("flex flex-col rounded-2xl border-2 border-pax2-light-blue bg-white px-4", d.tools ? "py-3.5" : "justify-center", glow(useLit("nodes", id)))}>
      <p className={cn("text-lg font-semibold text-pax2-blue", !d.tools && "text-center")}>{d.title}</p>
      {d.tools && (
        <ul className="mt-1.5 space-y-0.5">
          {d.tools.map(([tool, does]) => (
            <li key={tool} title={does} className="text-[13px] leading-5 text-slate-700">
              {tool}
            </li>
          ))}
        </ul>
      )}
      {d.foot?.length ? (
        <div className="mt-auto border-t border-slate-200 pt-2">
          {d.foot.map((f) => <p key={f} className="tabular text-[13px] font-semibold text-pax2-blue">{f}</p>)}
        </div>
      ) : null}
      <Sides extra={d.extra} />
    </div>
  )
}

function Store({ id, data: d }: NodeProps<Node<StoreData>>) {
  const Icon = STORE_ICON[d.service]
  return (
    <div title={d.about ? `${d.service}: ${d.about}` : d.service} style={{ width: d.w, height: d.h }} className={cn("flex flex-col justify-center rounded-[14px_14px_10px_10px] border border-slate-300 bg-slate-50 px-3", glow(useLit("nodes", id)))}>
      <p className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-slate-900">
        <Icon className="size-3.5 shrink-0 text-slate-500" />
        {d.title}
      </p>
      {d.count && <p className="tabular mt-0.5 text-[13px] font-semibold leading-snug text-pax2-blue">{d.count}</p>}
      <Sides extra={d.extra} />
    </div>
  )
}

// A staged instrument wears the planned dash: fitted or in build, not yet serving.
function ChipBody({ c }: { c: Chip }) {
  return (
    <span title={c.status} className={cn("flex min-h-[34px] items-center gap-2 rounded-[18px] border py-1 pl-1 pr-3 text-xs font-semibold leading-tight text-pax2-blue", c.status === "Live" ? "border-indigo-200 bg-indigo-50" : "border-dashed border-indigo-300 bg-white")}>
      <span className="tabular flex size-[26px] shrink-0 items-center justify-center rounded-full bg-pax2-blue text-[11px] text-white">{c.n}</span>
      <span>{c.name}</span>
    </span>
  )
}

function Instrument({ id, data: d }: NodeProps<Node<ChipData>>) {
  return (
    <div style={{ width: d.w }} className={cn("rounded-[18px]", glow(useLit("nodes", id)))}>
      <ChipBody c={model(d.n)} />
      <Sides extra={d.extra} />
    </div>
  )
}

function Rack({ id, data: d }: NodeProps<Node<RackData>>) {
  return (
    <div style={{ width: d.w }} className={cn("grid grid-cols-2 gap-1.5 rounded-2xl border border-indigo-200 bg-white/80 p-2.5", glow(useLit("nodes", id)))}>
      {d.ns.map((n) => <ChipBody key={n} c={model(n)} />)}
      <Sides extra={d.extra} />
    </div>
  )
}

function Service({ id, data: d }: NodeProps<Node<ServiceData>>) {
  return (
    <div title={d.about} style={{ width: d.w, height: d.h }} className={cn("flex flex-col justify-center rounded-xl border border-amber-300 bg-amber-50 px-3", glow(useLit("nodes", id)))}>
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-amber-950">
        <Server className="size-3.5 shrink-0 text-amber-700" /> {d.title}
      </p>
      {d.cost && <p className="tabular text-xs font-semibold text-amber-800">{d.cost}</p>}
      <Sides extra={d.extra} />
    </div>
  )
}

function Surface({ id, data: d }: NodeProps<Node<SurfaceData>>) {
  return (
    <div title={d.about} style={{ width: d.w, height: d.h }} className={cn("flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-e1", glow(useLit("nodes", id)))}>
      <div className="flex h-4 shrink-0 items-center gap-1 bg-slate-100 px-2">
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-slate-300" />)}
        <span className="ml-1.5 font-mono text-[10px] text-slate-500">{d.path}</span>
      </div>
      <p className="flex flex-1 items-center gap-1.5 px-3 text-[15px] font-semibold text-slate-900">
        <Monitor className="size-3.5 shrink-0 text-slate-500" /> {d.title}
      </p>
      <Sides extra={d.extra} />
    </div>
  )
}

const nodeTypes = { door: Door, stage: Stage, store: Store, instrument: Instrument, rack: Rack, service: Service, surface: Surface }

// ---------------------------------------------------------------------------------------------
// The one edge: a rounded orthogonal path, styled by kind, carrying its chip. `at` pins a chip (the long
// rails); `offset` sets how far a rail runs past its lower or upper node. Lit, it carries a travelling light.

type FxData = { kind: Kindof; label: string; icon?: LucideIcon; text?: string; loop?: number; offset?: number; at?: [number, number] }

function LoopBadge({ n }: { n: number }) {
  return <span className="tabular flex size-[18px] shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">{n}</span>
}

/** An edge's chip: a circle holding its icon (a pill for a word), blue on white for flow, purple with the
 *  loop's number on its shoulder, dashed when planned. `big` is the sidebar's size, where the loop's
 *  section heading carries the number. */
function EdgeChip({ d, big = false, className, style }: { d: FxData; big?: boolean; className?: string; style?: React.CSSProperties }) {
  const Icon = d.icon
  return (
    <span
      title={d.label}
      style={style}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border bg-white font-medium leading-none",
        Icon ? (big ? "size-8" : "size-7") : cn("w-max whitespace-nowrap px-2.5 text-xs", big ? "h-8" : "h-7"),
        d.kind === "loop" ? "border-violet-300 text-violet-700" : d.kind === "planned" ? "border-dashed border-slate-300 italic text-slate-400" : "border-slate-200 text-pax2-blue",
        className,
      )}
    >
      {Icon ? <Icon className={big ? "size-4" : "size-3.5"} strokeWidth={2} /> : d.text}
      {d.loop && !big && <span className="tabular absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-semibold not-italic text-white ring-2 ring-white">{d.loop}</span>}
    </span>
  )
}

function FxEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<Edge<FxData>>) {
  const d = data!
  const lit = useLit("edges", id)
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14, offset: d.offset ?? 22 })
  const [x, y] = d.at ?? [lx, ly]
  const color = d.kind === "loop" ? LOOP : d.kind === "planned" ? PLANNED : FLOW
  const width = (d.kind === "loop" ? 2.25 : 1.75) + (lit === "lit" ? 1 : 0)
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: width, opacity: lit === "dim" ? 0.15 : 1, transition: "opacity 300ms", ...(d.kind === "planned" && { strokeDasharray: "6 5" }) }} />
      {lit === "lit" && <path d={path} fill="none" stroke={LIGHT[d.kind]} strokeWidth={5} className="erd-travel" style={{ filter: `drop-shadow(0 0 4px ${LIGHT[d.kind]})` }} />}
      <EdgeLabelRenderer>
        {/* Above every line, the elevated loops included. */}
        <EdgeChip
          d={d}
          style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: 10 }}
          className={cn("pointer-events-auto absolute transition-opacity duration-300", lit === "dim" && "opacity-20", lit === "lit" && "ring-2 ring-sky-300")}
        />
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { fx: FxEdge }

// ---------------------------------------------------------------------------------------------
// The sidebar: Factory (the kinds and the loops) and Widgets (every chip and its words). An entry lights
// what it names on the canvas; a second click, Escape, or a click on the canvas puts the lights out.

const LOOPS: [number, string, string][] = [
  [1, "Re-entry", "Publish puts the video on the poller; its readings bring it back through the admin console as measured outcome."],
  [2, "Machine learning", "Every run's measurements join the catalog; the instruments refit from it."],
  [3, "Reinforcement learning", "Outcomes train the publish-next policy (15), which advises the next recording."],
  [4, "Questions", "A question asked in Chat runs through Q (14); the answer becomes a census column."],
]

function Line({ kind }: { kind: Kindof }) {
  const color = kind === "loop" ? LOOP : kind === "planned" ? PLANNED : FLOW
  return (
    <svg width="56" height="12" className="shrink-0" aria-hidden>
      <defs>
        <marker id={`lg-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line x1="2" y1="6" x2="50" y2="6" stroke={color} strokeWidth={kind === "loop" ? 2.25 : 1.75} strokeDasharray={kind === "flow" ? undefined : kind === "loop" ? "5" : "6 5"} markerEnd={`url(#lg-${kind})`}>
        {kind === "loop" && <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.5s" repeatCount="indefinite" />}
      </line>
    </svg>
  )
}

const same = (a: Focus, b: Focus) => JSON.stringify(a) === JSON.stringify(b)

function Entry({ focus, current, onFocus, sample, children }: { focus: Focus; current: Focus; onFocus: (f: Focus) => void; sample: React.ReactNode; children: React.ReactNode }) {
  const on = same(focus, current)
  return (
    <button type="button" onClick={() => onFocus(on ? null : focus)} aria-pressed={on} className={cn("-mx-2 flex w-[calc(100%+16px)] items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white", on && "bg-white ring-1 ring-pax2-light-blue")}>
      <span className="flex min-h-8 w-14 shrink-0 items-center justify-center">{sample}</span>
      <span className="min-w-0">{children}</span>
    </button>
  )
}

const Name = ({ children }: { children: React.ReactNode }) => <span className="block text-[13px] font-semibold text-slate-900">{children}</span>
const Def = ({ children }: { children: React.ReactNode }) => <span className="block text-xs leading-snug text-slate-500">{children}</span>

function Legend({ edges, focus, onFocus, onClose }: { edges: Edge[]; focus: Focus; onFocus: (f: Focus) => void; onClose: () => void }) {
  const kind = (k: NodeKind, sample: React.ReactNode, name: string, def: string) => (
    <Entry key={k} focus={{ on: "kind", kind: k }} current={focus} onFocus={onFocus} sample={sample}>
      <Name>{name}</Name>
      <Def>{def}</Def>
    </Entry>
  )
  const line = (k: Kindof, name: string, def: string) => (
    <Entry key={k} focus={{ on: "edges", kind: k }} current={focus} onFocus={onFocus} sample={<Line kind={k} />}>
      <Name>{name}</Name>
      <Def>{def}</Def>
    </Entry>
  )
  const chips = (pick: (d: FxData) => boolean) =>
    edges
      .filter((e) => pick(e.data as FxData))
      .map((e) => {
        const d = e.data as FxData
        return (
          <Entry key={e.id} focus={{ on: "edge", id: e.id }} current={focus} onFocus={onFocus} sample={<EdgeChip d={d} big />}>
            <Def>{d.label}</Def>
          </Entry>
        )
      })
  const heading = (label: React.ReactNode, f: Focus, loopN?: number) => {
    const on = same(f, focus)
    return (
      <button type="button" onClick={() => onFocus(on ? null : f)} aria-pressed={on} className={cn("mb-1 flex items-center gap-2 rounded-md text-[13px] font-semibold hover:underline", loopN ? "text-violet-700" : "text-slate-900")}>
        {loopN && <LoopBadge n={loopN} />}
        {label}
      </button>
    )
  }
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-500 bg-pax2-mist shadow-e2">
      <Tabs defaultValue="factory" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
          <TabsList variant="line" className="h-9">
            <TabsTrigger value="factory" className="px-2 font-display text-base">Factory</TabsTrigger>
            <TabsTrigger value="widgets" className="px-2 font-display text-base">Widgets</TabsTrigger>
          </TabsList>
          <button type="button" onClick={onClose} className={whiteButton("circle")} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <TabsContent value="factory" className="min-h-0 overflow-y-auto border-t border-slate-200/70 px-5 py-4">
          <div className="space-y-1">
            {kind("door", <span className="h-6 w-14 rounded-lg bg-pax2-blue" />, "Door", "How a video enters.")}
            {kind("stage", <span className="h-6 w-14 rounded-xl border-2 border-pax2-light-blue bg-white" />, "Stage", "What the Lab does to the video, with the tools that do it.")}
            {kind("store", <span className="flex h-6 w-14 items-center justify-center rounded-[10px_10px_6px_6px] border border-slate-300 bg-slate-50"><HardDrive className="size-3.5 text-slate-500" /></span>, "Store", "Where it is kept: S3 prefixes, the DynamoDB ledger, the catalog. The count is what it holds; a dated count is from the last accounting run.")}
            {kind("instrument", <span className="flex h-6 w-14 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-0.5"><span className="flex size-5 items-center justify-center rounded-full bg-pax2-blue text-[10px] font-semibold text-white">n</span></span>, "Instrument", "A fitted model, numbered to the Models table. A dashed one is staged: fitted or in build, not yet serving.")}
            {kind("service", <span className="flex h-6 w-14 items-center justify-center rounded-lg border border-amber-300 bg-amber-50"><Server className="size-3.5 text-amber-700" /></span>, "Service", "A paid external the factory calls, with its unit cost where one is recorded.")}
            {kind("surface", <span className="h-6 w-14 overflow-hidden rounded-lg border border-slate-300 bg-white"><span className="block h-1.5 bg-slate-100" /></span>, "Surface", "A page the factory feeds.")}
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-3">
            {line("flow", "Flow", "The video, or what was measured from it, moves on.")}
            {line("loop", "Loop", "A result returns to re-enter the factory or train what runs in it.")}
            {line("planned", "Planned", "Dashed: drawn where it will run; not yet wired.")}
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-3">
            {LOOPS.map(([n, name, def]) => (
              <Entry key={n} focus={{ on: "loop", n }} current={focus} onFocus={onFocus} sample={<LoopBadge n={n} />}>
                <span className="block text-[13px] font-semibold text-violet-700">{name}</span>
                <Def>{def}</Def>
              </Entry>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="widgets" className="min-h-0 space-y-3 divide-y divide-slate-200/70 overflow-y-auto border-t border-slate-200/70 px-5 py-4 [&>*:not(:first-child)]:pt-3">
          {LOOPS.map(([n, name]) => (
            <div key={n}>
              {heading(name, { on: "loop", n }, n)}
              {chips((d) => d.loop === n)}
            </div>
          ))}
          <div>
            {heading("Flow", { on: "edges", kind: "flow" })}
            {chips((d) => d.kind === "flow")}
          </div>
          <div>
            {heading("Planned", { on: "edges", kind: "planned" })}
            {chips((d) => d.kind === "planned")}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// The drawing's grid. Columns run left to right a gap apart; the doors stack a step apart, and each intake
// store, Measure's left handles and the stores' edges sit level with the door that feeds them.

const GAP = 80 // between columns: room for a chip
const STEP_GAP = 64 // Score, Review and Publish

const W = { door: 130, store: 200, service: 130, ec2: 160, surface: 150, measure: 210, score: 150, step: 130, comp: 180, index: 210, catalog: 180, rack: 440, chip: 190, p15: 200, i4: 210, q14: 180 }
const CHIP_H = 38 // an instrument chip whose name runs to two lines

const X_DOOR = 0
const X_P15 = X_DOOR - GAP - W.p15
const X_STORE = X_DOOR + W.door + GAP
const X_MEASURE = X_STORE + W.store + GAP
const X_SCORE = X_MEASURE + W.measure + GAP
const X_REVIEW = X_SCORE + W.score + STEP_GAP
const X_PUBLISH = X_REVIEW + W.step + STEP_GAP
const X_COMP = X_MEASURE // the top row starts level with Measure
const X_INDEX = X_COMP + W.comp + 20
const X_CATALOG = X_INDEX + W.index + 20
const X_RACK = X_CATALOG + W.catalog + GAP
const X_Q14 = X_RACK + W.rack + 20 // clear of the rack, so its rail rises beside it
const X_SURFACE = X_Q14 + W.q14 + GAP
const X_RIGHT = X_SURFACE + W.surface + GAP

// Rows. The doors, 44 tall and 20 apart.
const DOOR_H = 44
const Y_DOOR = 236
const doorY = (i: number) => Y_DOOR + i * (DOOR_H + 20)
const Y_OAUTH = doorY(5)
const OAUTH_H = 56
const Y_ADMIN = Y_OAUTH + OAUTH_H + 20
const mid = (y: number, h: number) => y + h / 2
const C = {
  record: mid(doorY(0), DOOR_H),
  upload: mid(doorY(1), DOOR_H),
  button: mid(doorY(2), DOOR_H),
  scrape: mid(doorY(3), DOOR_H),
  process: mid(doorY(4), DOOR_H),
  oauth: mid(Y_OAUTH, OAUTH_H),
  admin: mid(Y_ADMIN, DOOR_H),
}
const STORE_H = 60 // a store with a count; one without is 44
const Y_TOP = 70 // the stores above Measure, and the rack
const Y_SERVICE = 150 // Polly and EC2, top-aligned
const MEASURE_Y = 250
const MEASURE_H = Y_ADMIN + DOOR_H + 24 - MEASURE_Y
const Y_MAIN = 426 // the main line's center: Measure's right handle, Score, Review, Publish
const STAGE_H = 52
const Y_Q14 = 378 // Q's center, between the rack and Score
const READINGS_H = 80
const Y_READINGS = Y_MAIN + STAGE_H / 2 + 93 // under Publish, with room for its loop chip and the rail above it
const Y_WATCH = mid(Y_READINGS, READINGS_H) // readings, Tracking and the early-hit chip share a center line
const SURFACE_H = 48
const Y_HOME = 90
const Y_CHAT = 210
// The rails: two over the top, four under the bottom, 30 apart.
const RAIL_TOP = [10, 40]
const RAIL_BOTTOM = [745, 775, 805, 835]

// Measure's left handles sit level with the door or store that feeds each one.
const ML = (id: string, y: number): Extra => ({ id, side: "l", at: y - MEASURE_Y })

export function build(c: FactoryCounts): { nodes: Node[]; edges: Edge[] } {
  const asOf = (n: number | null, what: string) => (n == null ? null : `${fmt(n)} ${what}${c.asOf ? ` · ${c.asOf}` : ""}`)
  const n = (id: string, type: string, x: number, y: number, data: Record<string, unknown>): Node => ({ id, type, position: { x, y }, data, draggable: false, selectable: false })
  const centered = (cy: number, h: number) => cy - h / 2
  const cx = (x: number, w: number) => x + w / 2

  const nodes: Node[] = [
    // Doors
    n("record", "door", X_DOOR, doorY(0), { w: W.door, h: DOOR_H, title: "Record", about: "a take in the studio, in the browser" }),
    n("upload", "door", X_DOOR, doorY(1), { w: W.door, h: DOOR_H, title: "Upload", about: "the owner's own file" }),
    n("button", "door", X_DOOR, doorY(2), { w: W.door, h: DOOR_H, title: "Button", about: "the flask on any video card, opening /lab" }),
    n("scrape", "door", X_DOOR, doorY(3), { w: W.door, h: DOOR_H, title: "Scrape", about: "admin console: fetch a list of shorts", planned: true }),
    n("process", "door", X_DOOR, doorY(4), { w: W.door, h: DOOR_H, title: "Process", about: "admin console: measure what is held", planned: true }),
    n("oauth", "door", X_DOOR, Y_OAUTH, { w: W.door, h: OAUTH_H, title: "OAuth", about: "a client connects their YouTube channel", big: true }),
    n("admin", "door", X_DOOR, Y_ADMIN, { w: W.door, h: DOOR_H, title: "Admin", about: "the admin console: the poller's live and finished tables on /tracking" }),
    n("p15", "instrument", X_P15, centered(C.record, CHIP_H), { w: W.p15, n: 15 }),

    // Intake stores, each level with what feeds it
    n("uploads", "store", X_STORE, centered((C.record + C.upload) / 2, 44), { w: W.store, h: 44, service: "Amazon S3", title: "uploads/", about: "every recorded or uploaded take, as mp4" }),
    n("media", "store", X_STORE, centered(C.scrape, STORE_H), { w: W.store, h: STORE_H, service: "Amazon S3", title: "catalog-media/", about: "catalog shorts: 360p mp4 and m4a", count: asOf(c.media, "shorts held") }),
    n("ledger", "store", X_STORE, centered(C.oauth, 44), { w: W.store, h: 44, service: "Amazon DynamoDB", title: "pax2-ledger", about: "append-only: takes, reads, channel runs, the fetch queue" }),

    // Above Measure
    n("polly", "service", X_DOOR, Y_SERVICE, { w: W.service, h: 44, title: "Polly", about: "neural narration for a script" }),
    n("ec2", "service", X_STORE, Y_SERVICE, { w: W.ec2, h: 56, title: "EC2", cost: "1.5¢ an upload", about: "self-terminating boxes; about 1.5¢ an upload on a c7i.large" }),
    n("composition", "store", X_COMP, Y_TOP, { w: W.comp, h: STORE_H, service: "Amazon S3", title: "composition/", about: "per short: cuts, loudness, text", count: c.composition == null ? null : `${fmt(c.composition)} shorts measured` }),
    n("index", "store", X_INDEX, Y_TOP, { w: W.index, h: STORE_H, service: "Amazon S3", title: "model/encoder-index/", about: "the serving index", count: asOf(c.index, "embedded") }),
    n("i4", "instrument", cx(X_INDEX, W.index) - W.i4 / 2, Y_TOP + STORE_H + 36, { w: W.i4, n: 4 }),
    n("catalog", "store", X_CATALOG, Y_TOP, { w: W.catalog, h: STORE_H, service: "Catalog JSON", title: "feed-index.json", about: "every catalog short and its measured columns", count: c.catalog == null ? null : `${fmt(c.catalog)} shorts`, extra: [{ id: "t-q", side: "t", at: 40 }, { id: "t-home", side: "t", at: 150 }] }),
    n("rack", "rack", X_RACK, Y_TOP, { w: W.rack, ns: [1, 2, 5, 6, 7, 8, 9, 10, 11, 12] }),
    n("q14", "instrument", X_Q14, centered(Y_Q14, CHIP_H), { w: W.q14, n: 14 }),

    // Stages
    n("measure", "stage", X_MEASURE, MEASURE_Y, {
      w: W.measure, h: MEASURE_H, title: "Measure", about: "Where it runs: one self-terminating EC2 box per upload; a fleet of them for the catalog",
      tools: [
        ["ffmpeg", "the scene score of every frame, for cuts and pace; EBU R128 loudness each second"],
        ["ffprobe", "each file's duration"],
        ["Tesseract OCR", "on-screen text, one frame a second"],
        ["Whisper", "a word-timed transcript from the audio"],
        ["Captions", "YouTube's own, through the proxy fleet and TranscriptAPI"],
        ["Text embedding", "title, description and transcript into the serving index"],
      ],
      foot: [asOf(c.transcripts, "transcripts")].filter(Boolean),
      extra: [
        ML("l-uploads", (C.record + C.upload) / 2), ML("l-button", C.button), ML("l-media", C.scrape), ML("l-process", C.process), ML("l-ledger", C.oauth), ML("l-admin", C.admin),
        { id: "r-score", side: "r", at: Y_MAIN - MEASURE_Y },
        { id: "r-cat", side: "r", at: 40 },
        { id: "t-ec2", side: "t", at: 20 }, { id: "t-comp", side: "t", at: W.comp / 2 }, { id: "t-i4", side: "t", at: 190 },
      ],
    }),
    n("score", "stage", X_SCORE, centered(Y_MAIN, STAGE_H), {
      w: W.score, h: STAGE_H, title: "Score", about: "The read: outlier chance, headline pick, neighbors re-scored, persuasion evidence, the pair picker's call",
      extra: [{ id: "t-rack", side: "t", at: 100 }, { id: "t-q", side: "t", at: 130 }],
    }),
    n("review", "stage", X_REVIEW, centered(Y_MAIN, STAGE_H), { w: W.step, h: STAGE_H, title: "Review", about: "PAX review: the flask granted, the link sent" }),
    n("publish", "stage", X_PUBLISH, centered(Y_MAIN, STAGE_H), { w: W.step, h: STAGE_H, title: "Publish", about: "On YouTube: the poller watches it for 72 hours" }),

    // Below the main line
    n("readings", "store", cx(X_PUBLISH, W.step) - W.store / 2, Y_READINGS, {
      w: W.store, h: READINGS_H, service: "Amazon S3", title: "velocity/", about: "the poller's readings, every 15 minutes",
      count: c.window == null ? null : `${fmt(c.window)} shorts in the 72-hour window${c.channels ? ` · ${fmt(c.channels)} channels` : ""}`,
    }),

    // Surfaces and what feeds them
    n("home", "surface", X_SURFACE, Y_HOME, { w: W.surface, h: SURFACE_H, title: "Home feed", path: "/home", about: "every short, ranked" }),
    n("chat", "surface", X_SURFACE, Y_CHAT, { w: W.surface, h: SURFACE_H, title: "Chat", path: "/chat", about: "answers from the record" }),
    n("tracking", "surface", X_SURFACE, centered(Y_WATCH, SURFACE_H), { w: W.surface, h: SURFACE_H, title: "Tracking", path: "/tracking", about: "curves against the channel median" }),
    n("vpages", "surface", X_SURFACE, centered(Y_WATCH, SURFACE_H) + SURFACE_H + 48, { w: W.surface, h: SURFACE_H, title: "Video pages", path: "/v", about: "each video's measured record" }),
    n("i13", "instrument", X_RIGHT, centered(Y_HOME + SURFACE_H / 2, CHIP_H), { w: W.chip, n: 13 }),
    n("bedrock", "service", X_RIGHT, centered(Y_CHAT + SURFACE_H / 2, 44), { w: W.service, h: 44, title: "Bedrock", about: "Chat's written answers" }),
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
  const flow = (icon: LucideIcon | string, label: string, more: Partial<FxData> = {}): FxData => ({ kind: "flow", label, ...(typeof icon === "string" ? { text: icon } : { icon }), ...more })
  const loop = (loopN: number, icon: LucideIcon, label: string, more: Partial<FxData> = {}): FxData => ({ kind: "loop", loop: loopN, icon, label, ...more })
  const planned = (icon: LucideIcon | string, label: string, more: Partial<FxData> = {}): FxData => ({ kind: "planned", label, ...(typeof icon === "string" ? { text: icon } : { icon }), ...more })

  // Where a pinned chip sits: the middle of the intake stores' column, or of a gap.
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
    e("polly-record", "polly", "b", "record", "t", flow(AudioLines, "narration")),
    e("record-uploads", "record", "r", "uploads", "l", flow(Film, "webm, transcoded to mp4")),
    e("upload-uploads", "upload", "r", "uploads", "l", flow(Film, "mp4")),
    e("uploads-measure", "uploads", "r", "measure", "l-uploads", flow(Zap, "the S3 event starts a box")),
    e("button-measure", "button", "r", "measure", "l-button", planned(Film, "an unmeasured video through the boxes", { at: [storeMid, C.button] })),
    e("scrape-media", "scrape", "r", "media", "l", planned("fetches", "fetches the files")),
    e("media-measure", "media", "r", "measure", "l-media", flow(Film, "mp4 and m4a")),
    e("process-measure", "process", "r", "measure", "l-process", planned(Layers, "a held batch through Measure", { at: [storeMid, C.process] })),
    e("oauth-ledger", "oauth", "r", "ledger", "l", flow(ChartLine, "catalog, analytics totals, retention curves")),
    e("ledger-measure", "ledger", "r", "measure", "l-ledger", planned(ListVideo, "queued public videos, once the fetch worker is built")),
    e("ec2-measure", "ec2", "b", "measure", "t-ec2", flow(Cpu, "runs every measurement")),

    // Measure's outputs
    e("measure-composition", "measure", "t-comp", "composition", "b", flow(Scissors, "cuts, loudness, on-screen text")),
    e("measure-i4", "measure", "t-i4", "i4", "b", flow(FileText, "transcript")),
    e("i4-index", "i4", "t", "index", "b", flow(Binary, "embedding")),
    e("measure-score", "measure", "r-score", "score", "l", flow(Ruler, "the measured record")),

    // Score, Review, Publish
    e("rack-score", "rack", "b", "score", "t-rack", flow(ScanEye, "2, 5, 6, 7 and 8 read each take")),
    e("q14-score", "q14", "l", "score", "t-q", flow(MessageCircleQuestionMark, "asks it anything", { at: [X_PUBLISH + W.step / 2, Y_Q14] })),
    e("score-review", "score", "r", "review", "l", flow(Search, "the read")),
    e("review-publish", "review", "r", "publish", "l", flow(Mail, "link sent")),
    e("score-ledger", "score", "b", "ledger", "b", flow(Save, "the read, saved with the video", { offset: below(RAIL_BOTTOM[0], bottom("score"), bottom("ledger")), at: [X_MEASURE + W.measure + GAP / 2, RAIL_BOTTOM[0]] })),
    e("ledger-vpages", "ledger", "b", "vpages", "b", flow(ScrollText, "each video's record", { offset: below(RAIL_BOTTOM[1], bottom("ledger"), bottom("vpages")), at: [X_REVIEW + W.step / 2, RAIL_BOTTOM[1]] })),

    // Watching
    e("readings-tracking", "readings", "r", "tracking", "l", flow(Table, "live and finished tables")),
    e("readings-i3", "readings", "t", "i3", "t", flow(Eye, "first hours of views", { offset: 22, at: [gapMid(X_SURFACE + W.surface), Y_READINGS - 22] })),
    e("i3-tracking", "i3", "l", "tracking", "r", flow(Timer, "early-hit read at 72 hours")),

    // What feeds the surfaces
    e("catalog-home", "catalog", "t-home", "home", "t", flow(Rss, "the feed index", { offset: above(RAIL_TOP[0], Y_TOP, Y_HOME), at: [X_Q14 + W.q14 + GAP / 2, RAIL_TOP[0]] })),
    e("i13-home", "i13", "l", "home", "r", flow(Magnet, "reader-channel affinity it measured")),
    e("bedrock-chat", "bedrock", "l", "chat", "r", flow(PenLine, "written answers")),

    // Loop 1: published, polled, back in as measured outcome
    e("publish-readings", "publish", "b", "readings", "t", loop(1, Clock, "on the poller, read every 15 minutes", { at: [cx(X_PUBLISH, W.step), Y_MAIN + STAGE_H / 2 + 34] })),
    e("readings-admin", "readings", "b", "admin", "b", loop(1, TrendingUp, "outcomes, views against the channel median", { offset: below(RAIL_BOTTOM[2], bottom("readings"), bottom("admin")), at: [X_SCORE + W.score / 2, RAIL_BOTTOM[2]] })),
    e("admin-measure", "admin", "r", "measure", "l-admin", loop(1, RotateCcw, "re-enters as measured outcome", { at: [gapMid(X_STORE + W.store), C.admin] })),
    // Loop 2: measurements join the catalog; the instruments refit from it
    e("measure-catalog", "measure", "r-cat", "catalog", "b", loop(2, Ruler, "measurements join the catalog", { at: [cx(X_CATALOG, W.catalog), (Y_TOP + STORE_H + MEASURE_Y + 40) / 2] })),
    e("catalog-rack", "catalog", "r", "rack", "l", loop(2, RefreshCw, "refit")),
    // Loop 3: outcomes train P, P advises the next recording
    e("readings-p15", "readings", "b", "p15", "b", loop(3, GraduationCap, "outcomes train the policy", { offset: below(RAIL_BOTTOM[3], bottom("readings"), bottom("p15")), at: [cx(X_STORE, W.store), RAIL_BOTTOM[3]] })),
    e("p15-record", "p15", "r", "record", "l", loop(3, Lightbulb, "advises the next recording")),
    // Loop 4: questions through Q become census columns
    e("chat-q14", "chat", "l", "q14", "r", loop(4, MessageCircleQuestionMark, "a question asked in Chat")),
    e("q14-catalog", "q14", "t", "catalog", "t-q", loop(4, Columns3, "the answer, a census column", { offset: above(RAIL_TOP[1], Y_TOP, centered(Y_Q14, CHIP_H)), at: [X_RACK + W.rack / 2, RAIL_TOP[1]] })),
  ]
  return { nodes, edges }
}

function Canvas({ nodes, edges, onPane }: { nodes: Node[]; edges: Edge[]; onPane: () => void }) {
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
      onPaneClick={onPane}
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

/** The canvas, with its key in a sidebar the config button slides in from the left, inside the page. */
export function FactoryCanvas({ counts }: { counts: FactoryCounts }) {
  const { nodes, edges } = React.useMemo(() => build(counts), [counts])
  const [open, setOpen] = React.useState(false)
  const [focus, setFocus] = React.useState<Focus>(null)
  const lit = React.useMemo(() => lights(focus, nodes, edges), [focus, nodes, edges])
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setFocus(null)
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  return (
    <div className="relative flex min-h-[70dvh] min-w-0 flex-1 overflow-hidden bg-pax2-mist">
      <LitCtx.Provider value={lit}>
        <ReactFlowProvider>
          <Canvas nodes={nodes} edges={edges} onPane={() => setFocus(null)} />
        </ReactFlowProvider>
      </LitCtx.Provider>
      <button type="button" onClick={() => setOpen(true)} aria-label="Key" title="Key" aria-expanded={open} className={whiteButton("circle", "absolute left-4 top-4 z-10", open && "pointer-events-none opacity-0")}>
        <Settings2 className="size-4" />
      </button>
      <div className={cn("absolute inset-y-4 left-4 z-20 w-[min(360px,calc(100%-32px))] transition-transform duration-300 ease-in-out", open ? "translate-x-0" : "-translate-x-[calc(100%+24px)]")} aria-hidden={!open}>
        <Legend
          edges={edges}
          focus={focus}
          onFocus={setFocus}
          onClose={() => {
            setOpen(false)
            setFocus(null)
          }}
        />
      </div>
    </div>
  )
}
