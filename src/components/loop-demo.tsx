"use client"

import * as React from "react"
import "./loop-demo.css"

import { Activity, Brain, Gauge, ListChecks, Send, Video } from "lucide-react"
import { Background, BackgroundVariant, BaseEdge, EdgeLabelRenderer, getBezierPath, Handle, Panel, Position, ReactFlow, ReactFlowProvider, type EdgeProps, type NodeProps } from "@xyflow/react"

import { cn } from "@/ui/lib/utils"

// The closed loop as a living diagram, for anyone who needs to see the system in one look: the five
// stages on a circle, every video entering at Record, zaps running the edges without stop, the
// model-update edge in red closing the cycle, and the hub ticking through what the poller is
// carrying right now. Nothing here is a control; the loop runs whether or not anyone is watching,
// and every number is read from the serving model files and the poller's rows.

export type LoopStats = {
  catalog: number
  channels: number
  scored: number
  outliers: number
  classifierAuc: number
  classifierFit: string
  liftVideos: number
  watched: number
  readings: number
  curves: number
  velocityFit: string
}
export type TickerItem = { title: string; channel: string; p: number | null; views: number; hour: number }
export type LoopData = { stats: LoopStats; ticker: TickerItem[] }

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n))
const pct = (p: number) => `${Math.round(p * 100)}%`

type StageData = { key: string; name: string; icon: "video" | "gauge" | "list" | "send" | "activity" | "brain"; l1: string; l2: string; active?: boolean }
const ICON = { video: Video, gauge: Gauge, list: ListChecks, send: Send, activity: Activity, brain: Brain }

function StageNode({ data }: NodeProps) {
  const d = data as StageData
  const Icon = ICON[d.icon]
  return (
    <div className={cn("w-[232px] rounded-xl border bg-card p-3.5 shadow-xs transition-all duration-500", d.active && "stage-active")}>
      {(["t", "r", "b", "l"] as const).map((h) => (
        <React.Fragment key={h}>
          <Handle id={h} type="source" position={h === "t" ? Position.Top : h === "r" ? Position.Right : h === "b" ? Position.Bottom : Position.Left} className="!size-1 !border-0 !bg-transparent" />
          <Handle id={`${h}i`} type="target" position={h === "t" ? Position.Top : h === "r" ? Position.Right : h === "b" ? Position.Bottom : Position.Left} className="!size-1 !border-0 !bg-transparent" />
        </React.Fragment>
      ))}
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-full transition-colors duration-500", d.active ? "bg-pax2-blue text-white" : "bg-pax2-lavender text-pax2-blue")}>
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-semibold">{d.name}</p>
      </div>
      <p className="mt-2 text-xs leading-snug text-slate-800">{d.l1}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{d.l2}</p>
    </div>
  )
}

function HubNode({ data }: NodeProps) {
  const d = data as { ticker: TickerItem[]; watched: number }
  const [at, setAt] = React.useState(0)
  React.useEffect(() => {
    if (!d.ticker.length) return
    const t = window.setInterval(() => setAt((i) => (i + 1) % d.ticker.length), 3200)
    return () => window.clearInterval(t)
  }, [d.ticker.length])
  const v = d.ticker[at]
  return (
    <div className="w-[270px] rounded-xl border border-pax2-blue/30 bg-white p-4 text-center shadow-md">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-pax2-red uppercase">
        <span className="live-dot" /> running now
      </p>
      {v ? (
        <div key={at} className="hub-fade mt-2.5">
          <p className="line-clamp-2 text-sm leading-snug font-medium">{v.title}</p>
          <p className="mt-1.5 text-xs text-slate-500">
            {v.channel} · {fmt(v.views)} views at {Math.round(v.hour)}h{v.p != null ? ` · p(Hit) ${pct(v.p)}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-slate-500">the poller's next pass fills this</p>
      )}
      <p className="mt-3 border-t pt-2.5 text-xs text-slate-500">{fmt(d.watched)} shorts in the loop right now</p>
    </div>
  )
}

function ZapEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.45 })
  const d = (data ?? {}) as { color?: string; dur?: number; dots?: number; label?: string }
  const color = d.color ?? "var(--pax2-light-blue)"
  const dur = d.dur ?? 2.8
  const dots = d.dots ?? 3
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: "#cbd5e1", strokeWidth: 1.25 }} />
      {Array.from({ length: dots }).map((_, i) => (
        <circle key={i} r={3.5} fill={color}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${((i * dur) / dots).toFixed(2)}s`} path={path} />
        </circle>
      ))}
      {d.label && (
        <EdgeLabelRenderer>
          <p style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }} className="absolute rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-pax2-red">
            {d.label}
          </p>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { stage: StageNode, hub: HubNode }
const edgeTypes = { zap: ZapEdge }
const CYCLE = ["score", "recommend", "publish", "track", "learn"]
// Five stages on a circle of radius 310, Score at the top; Record feeds in from the left.
const AT = (deg: number, w = 232, h = 100) => {
  const r = (deg * Math.PI) / 180
  return { x: 310 * Math.cos(r) - w / 2, y: 310 * Math.sin(r) - h / 2 }
}

export function LoopDemo({ data }: { data: LoopData }) {
  const s = data.stats
  const [active, setActive] = React.useState(0)
  React.useEffect(() => {
    const t = window.setInterval(() => setActive((i) => (i + 1) % CYCLE.length), 2200)
    return () => window.clearInterval(t)
  }, [])
  const stage = (key: string, name: string, icon: StageData["icon"], l1: string, l2: string): StageData => ({ key, name, icon, l1, l2, active: CYCLE[active] === key })
  const nodes = [
    { id: "record", type: "stage", position: { x: -860, y: -360 }, data: stage("record", "Record", "video", "Camera takes, Studio takes, connected channels.", `${fmt(s.catalog)} shorts across ${s.channels} channels`) },
    { id: "score", type: "stage", position: AT(-90), data: stage("score", "Score", "gauge", "The chance of a Hit before anything is posted.", `${fmt(s.scored)} scored · AUC ${s.classifierAuc.toFixed(3)} · fit ${s.classifierFit}`) },
    { id: "recommend", type: "stage", position: AT(-18), data: stage("recommend", "Recommend", "list", "The measured changes, within channel, with ranges.", `${fmt(s.liftVideos)} shorts of evidence`) },
    { id: "publish", type: "stage", position: AT(54), data: stage("publish", "Publish", "send", "Approval, the upload, the watch-list write.", "unlisted until the client kickoff") },
    { id: "track", type: "stage", position: AT(126), data: stage("track", "Track", "activity", "The poller reads every watched short, around the clock.", `${fmt(s.watched)} under watch · ${fmt(s.readings)} readings`) },
    { id: "learn", type: "stage", position: AT(198), data: stage("learn", "Learn", "brain", "Every settled curve refits the serving models.", `${fmt(s.curves)} curves · fit ${s.velocityFit}`) },
    { id: "hub", type: "hub", position: { x: -135, y: -92 }, data: { ticker: data.ticker, watched: s.watched }, draggable: false },
  ]
  const zap = (id: string, source: string, target: string, sh: string, th: string, data?: Record<string, unknown>) => ({ id, source, target, sourceHandle: sh, targetHandle: `${th}i`, type: "zap", data })
  const edges = [
    zap("e-in", "record", "score", "r", "l", { dur: 3.4, dots: 2 }),
    zap("e1", "score", "recommend", "r", "t"),
    zap("e2", "recommend", "publish", "b", "r"),
    zap("e3", "publish", "track", "l", "r"),
    zap("e4", "track", "learn", "l", "b"),
    zap("e5", "learn", "score", "t", "l", { color: "var(--pax2-red)", dur: 2.2, dots: 2, label: "the model updates" }),
  ]
  return (
    <div style={{ height: "calc(100dvh - 130px)", minHeight: 560 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.12 }} proOptions={{ hideAttribution: true }} nodesConnectable={false} nodesDraggable={false} zoomOnScroll={false} preventScrolling={false}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Panel position="bottom-left" className="max-w-md text-xs text-slate-500">
            Every number read live from the serving model files and the poller's rows.
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
