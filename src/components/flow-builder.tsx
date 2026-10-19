"use client"

import * as React from "react"
import Link from "next/link"
import dagre from "@dagrejs/dagre"
import { addEdge, Background, BackgroundVariant, Controls, Handle, MarkerType, Panel, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react"
import { ChevronRight, Plus, Trash2 } from "lucide-react"

import { CardBlock, ListBlock, MainBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"

// Flows: the production steps PAX2 already runs, composed on a canvas the way a take moves through
// them — write or pick a script, give it a voice and a bed, caption it, render, score, publish,
// track. A template seeds the canvas; steps add, connect and rearrange; a saved flow keeps in this
// browser. Each step names the page that runs it today.

type StepKey = "outliers" | "script" | "record" | "voice" | "sound" | "captions" | "endcard" | "render" | "score" | "publish" | "track"

const STEP: Record<StepKey, { name: string; makes: string; href: string; page: string }> = {
  outliers: { name: "Outliers", makes: "the catalog's Hits to model a short on", href: "/outliers", page: "iWAR" },
  script: { name: "Script", makes: "a draft on one of the library's structures", href: "/scripts", page: "Scripts" },
  record: { name: "Record", makes: "a camera take, paced by the teleprompter", href: "/recording", page: "Recording" },
  voice: { name: "Voice", makes: "a read with word timings, ElevenLabs or Polly", href: "/recording", page: "Recording" },
  sound: { name: "Sound bed", makes: "a music bed under the read", href: "/recording", page: "Recording" },
  captions: { name: "Captions", makes: "word-timed captions from the transcript", href: "/recording", page: "Recording" },
  endcard: { name: "End card", makes: "the hook and end cards over the take", href: "/recording", page: "Recording" },
  render: { name: "Render", makes: "the finished short, rendered in the browser", href: "/recording", page: "Recording" },
  score: { name: "Score", makes: "the pre-publish forecast and its recommendations", href: "/scoring", page: "Scoring" },
  publish: { name: "Publish", makes: "the upload to the connected channel on approval", href: "/publishing", page: "Publishing" },
  track: { name: "Track", makes: "the poller's watch and the live Hit call", href: "/live-tracking", page: "Live tracking" },
}

const TEMPLATES: { name: string; steps: StepKey[] }[] = [
  { name: "Script to published short", steps: ["script", "voice", "sound", "captions", "endcard", "render", "score", "publish", "track"] },
  { name: "Camera take to published short", steps: ["record", "captions", "score", "publish", "track"] },
  { name: "Outlier to new script", steps: ["outliers", "script", "score"] },
]

type SavedFlow = { id: string; name: string; nodes: { id: string; step: StepKey; x: number; y: number }[]; edges: { s: string; t: string }[]; updatedAt: string }
const KEY = "pax2:flows"
const readFlows = (): SavedFlow[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(v) ? (v as SavedFlow[]) : []
  } catch {
    return []
  }
}
const writeFlows = (flows: SavedFlow[]) => window.localStorage.setItem(KEY, JSON.stringify(flows))

function StepNode({ data }: { data: { step: StepKey } }) {
  const s = STEP[data.step]
  return (
    <div className="w-[210px] rounded-lg border bg-card p-3 shadow-xs">
      <Handle type="target" position={Position.Left} className="!size-2 !border-slate-300 !bg-white" />
      <p className="text-sm font-medium">{s.name}</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{s.makes}</p>
      <Link href={s.href} className="mt-1.5 inline-block text-xs text-pax2-light-blue hover:underline">
        {s.page}
      </Link>
      <Handle type="source" position={Position.Right} className="!size-2 !border-slate-300 !bg-white" />
    </div>
  )
}

const nodeTypes = { step: StepNode }
const EDGE = { type: "smoothstep" as const, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#94a3b8" }, style: { stroke: "#94a3b8", strokeWidth: 1.5 } }

function layout(steps: StepKey[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 56 })
  g.setDefaultEdgeLabel(() => ({}))
  steps.forEach((s, i) => g.setNode(String(i), { width: 210, height: 92 }))
  steps.slice(1).forEach((_, i) => g.setEdge(String(i), String(i + 1)))
  dagre.layout(g)
  return {
    nodes: steps.map((s, i) => ({ id: String(i), type: "step", position: { x: g.node(String(i)).x - 105, y: g.node(String(i)).y - 46 }, data: { step: s } })),
    edges: steps.slice(1).map((_, i) => ({ id: `e${i}`, source: String(i), target: String(i + 1), ...EDGE })),
  }
}

function Builder({ flow, onBack, onSaved }: { flow: SavedFlow; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = React.useState(flow.name)
  const [adding, setAdding] = React.useState<StepKey>("script")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(flow.nodes.map((n) => ({ id: n.id, type: "step", position: { x: n.x, y: n.y }, data: { step: n.step } })))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flow.edges.map((e, i) => ({ id: `e${i}`, source: e.s, target: e.t, ...EDGE })))
  const onConnect = React.useCallback((c: Connection) => setEdges((eds) => addEdge({ ...c, ...EDGE }, eds)), [setEdges])
  const save = () => {
    const kept = readFlows().filter((f) => f.id !== flow.id)
    writeFlows([
      {
        id: flow.id,
        name: name.trim() || "Untitled flow",
        nodes: nodes.map((n) => ({ id: n.id, step: (n.data as { step: StepKey }).step, x: n.position.x, y: n.position.y })),
        edges: edges.map((e) => ({ s: e.source, t: e.target })),
        updatedAt: new Date().toISOString(),
      },
      ...kept,
    ])
    onSaved()
  }
  const add = () => {
    const id = `n${Date.now()}`
    const rightmost = nodes.reduce((m, n) => Math.max(m, n.position.x), 0)
    setNodes((ns) => [...ns, { id, type: "step", position: { x: rightmost + 266, y: 40 }, data: { step: adding } }])
  }
  return (
    <MainBlock
      title="Flow"
      height="h-[640px]"
      tools={<input value={name} onChange={(e) => setName(e.target.value)} aria-label="Flow name" className="h-8 w-56 rounded-md border bg-transparent px-2 text-sm" />}
      actions={
        <>
          <button type="button" onClick={onBack} className="h-8 rounded-md px-3 text-sm text-slate-800 hover:bg-muted">
            All flows
          </button>
          <button type="button" onClick={save} className="h-8 rounded-md bg-pax2-blue px-3 text-sm text-white hover:opacity-90">
            Save
          </button>
        </>
      }
    >
      <div className="h-[540px]">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
          <Panel position="top-left" className="flex items-center gap-1.5 rounded-lg border bg-white p-1.5 shadow-xs">
            <select value={adding} onChange={(e) => setAdding(e.target.value as StepKey)} aria-label="Step to add" className="h-7 rounded-md border bg-transparent px-1.5 text-xs">
              {Object.entries(STEP).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={add} className="inline-flex h-7 items-center gap-1 rounded-md bg-pax2-lavender px-2 text-xs text-pax2-blue hover:opacity-90">
              <Plus className="size-3.5" /> Add step
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </MainBlock>
  )
}

export function FlowBuilder() {
  const [flows, setFlows] = React.useState<SavedFlow[]>([])
  const [open, setOpen] = React.useState<SavedFlow | null>(null)
  React.useEffect(() => setFlows(readFlows()), [open])
  const fresh = (name: string, steps: StepKey[]): SavedFlow => {
    const l = layout(steps)
    return {
      id: `f${Date.now()}`,
      name,
      nodes: l.nodes.map((n) => ({ id: n.id, step: (n.data as { step: StepKey }).step, x: n.position.x, y: n.position.y })),
      edges: l.edges.map((e) => ({ s: e.source, t: e.target })),
      updatedAt: new Date().toISOString(),
    }
  }
  const remove = (id: string) => {
    writeFlows(readFlows().filter((f) => f.id !== id))
    setFlows(readFlows())
  }
  if (open) return <Builder key={open.id} flow={open} onBack={() => setOpen(null)} onSaved={() => setOpen(null)} />
  return (
    <BlockOrder page="flow" initial={["inspiration", "yours"]}>
      <OrderedBlock id="inspiration" label="Inspiration">
        <CardBlock
          title="Inspiration"
          height="auto"
          actions={
            <button type="button" onClick={() => setOpen(fresh("Untitled flow", ["script", "score"]))} className="inline-flex h-8 items-center gap-1 rounded-md bg-pax2-blue px-3 text-sm text-white hover:opacity-90">
              <Plus className="size-4" /> New flow
            </button>
          }
        >
          <div className="grid gap-5 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button" data-find={t.name} onClick={() => setOpen(fresh(t.name, t.steps))} className="rounded-lg border bg-card p-4 text-left shadow-xs transition-shadow hover:shadow-md">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-slate-500">
                  {t.steps.map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && <ChevronRight className="size-3 text-slate-300" aria-hidden />}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">{STEP[s].name}</span>
                    </React.Fragment>
                  ))}
                </p>
              </button>
            ))}
          </div>
        </CardBlock>
      </OrderedBlock>
      <OrderedBlock id="yours" label="Your flows">
        <ListBlock title="Your flows" height="auto" search="Search flows" rows={flows as unknown as Record<string, unknown>[]} name="flows">
          {flows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No saved flows. A template above opens the canvas; Save keeps it here.</p>
          ) : (
            flows.map((f) => (
              <div key={f.id} data-find={f.name} className="flex items-center justify-between border-b py-3 last:border-b-0">
                <button type="button" onClick={() => setOpen(f)} className="text-left text-sm font-medium hover:underline">
                  {f.name}
                </button>
                <span className="flex items-center gap-4 text-xs text-slate-500">
                  {f.nodes.length} steps
                  <span>{new Date(f.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <button type="button" aria-label={`Delete ${f.name}`} onClick={() => remove(f.id)} className={cn("inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-muted hover:text-pax2-red")}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))
          )}
        </ListBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
