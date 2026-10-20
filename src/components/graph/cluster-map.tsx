"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow,
  type Edge, type Node, type NodeChange, type NodeProps,
} from "@xyflow/react"
import { Loader2, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// The cluster layer over the graph, in the Connected Papers shape with shorts where the papers
// go: a list of clusters ranked by lift on the left, the network in the middle, the selected
// cluster's detail on the right. Network: every cluster a node on the graph page's own ReactFlow
// canvas — seeded at its UMAP centroid so the map agrees with the points view, relaxed apart,
// sized by its shorts, wearing its cluster color, edged to its nearest neighbors, draggable.
// One click picks a cluster (the list, the detail and the canvas all follow); a second click
// opens it as points. Points: every corpus short at its UMAP position on one canvas; picking a
// cluster zooms to it. The ranking statistic is lift: percentage points above each short's own
// channel's outlier rate, so one hot channel cannot masquerade as a content finding.

type MapPoint = { id: string; x: number; y: number; cluster: number; tier: string; label: string }

/* The two proposed readings of the same vector space (2026-10-20):
   Resonance — semantic positions with the behavioral correction as the lens: every short colored
   by its cluster's lift over its own channels (green above, red below, gray where unmeasured).
   Composition — the same reading with compositional filters laid over it: headline traits
   computable today (question, number, length); pace, hook and audio join when extraction runs. */
type CompFilter = "question" | "number" | "short-title" | "long-title"
const COMP_FILTERS: { key: CompFilter; label: string; test: (p: MapPoint) => boolean }[] = [
  { key: "question", label: "Question headline", test: (p) => /\?/.test(p.label) },
  { key: "number", label: "Carries a number", test: (p) => /\d/.test(p.label) },
  { key: "short-title", label: "Title under 40 chars", test: (p) => p.label.length < 40 },
  { key: "long-title", label: "Title 70+ chars", test: (p) => p.label.length >= 70 },
]
/** Diverging lift color: green above the channel baseline, red below, gray near zero or unmeasured. */
const liftColor = (lift: number | null) => {
  if (lift == null || Math.abs(lift) < 1) return "#cbd5e1"
  const t = Math.min(Math.abs(lift) / 12, 1)
  return lift > 0 ? `hsl(145 ${45 + t * 30}% ${55 - t * 20}%)` : `hsl(0 ${45 + t * 30}% ${60 - t * 18}%)`
}
type MapCluster = { id: number; n: number; channels: number; rate: number | null; lift: number | null; labels: string[] }
type MapData = { run: string; builtAt: string; n: number; k: number; clusters: MapCluster[]; points: MapPoint[] }

const TOUR: string[] = [
  "Every dot is a short. Shorts that sit close together say similar things; distance is similarity, and the axes themselves carry no meaning.",
  "The list ranks neighborhoods by lift: how far their shorts run above their own channels' usual hit rate. A neighborhood spread across many channels is a content finding, not one channel's audience.",
  "By cluster colors each neighborhood, By tier colors each short by its outcome, and Resonance colors by lift: green above the channels' own baselines, red below, full strength at ±12 points.",
  "Click a neighborhood to pick it and dim the rest. Click it again to open its shorts as points.",
  "In Composition, each chip keeps the shorts that match it (pace, hook, on-screen text, speech, length, headline) and dims the rest.",
]

const hue = (c: number) => `hsl(${(c * 47) % 360} 68% 52%)`
const TIER: Record<string, string> = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" }
const title = (c: MapCluster) => c.labels[0] ?? `Cluster ${c.id}`

/* ── the network's layout ────────────────────────────────────────────────── */

type ClusterNodeData = { c: MapCluster; d: number; dim: boolean; on: boolean; hovered: boolean; liftColors: boolean }
type ClusterFlowNode = Node<ClusterNodeData, "cluster">

const dia = (n: number) => 2 * (14 + Math.sqrt(n) * 0.6)

/** Seed every cluster at its UMAP centroid scaled to canvas units, then relax overlapping
 *  circles apart so each keeps its neighborhood but earns its own room. */
function layoutClusters(data: MapData): { nodes: ClusterFlowNode[]; edges: Edge[] } {
  const sums = new Map<number, { x: number; y: number; n: number }>()
  for (const p of data.points) {
    const s = sums.get(p.cluster) ?? { x: 0, y: 0, n: 0 }
    s.x += p.x
    s.y += p.y
    s.n += 1
    sums.set(p.cluster, s)
  }
  const cents = data.clusters.map((c, i) => {
    const s = sums.get(c.id)
    const a = (i / data.clusters.length) * Math.PI * 2
    return { c, x: s ? s.x / s.n : Math.cos(a), y: s ? s.y / s.n : Math.sin(a), r: dia(c.n) / 2 }
  })
  const xs = cents.map((p) => p.x)
  const ys = cents.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = 1500 / Math.max(x1 - x0, y1 - y0, 1e-6)
  const pos = cents.map((p) => ({ ...p, x: (p.x - (x0 + x1) / 2) * k, y: (p.y - (y0 + y1) / 2) * k }))
  for (let iter = 0; iter < 250; iter++) {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i]
        const b = pos[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        const overlap = a.r + b.r + 30 - d
        if (overlap <= 0) continue
        const ux = dx / d
        const uy = dy / d
        a.x -= ux * (overlap / 2)
        a.y -= uy * (overlap / 2)
        b.x += ux * (overlap / 2)
        b.y += uy * (overlap / 2)
      }
    }
  }
  const nodes: ClusterFlowNode[] = pos.map((p) => ({
    id: String(p.c.id),
    type: "cluster",
    position: { x: p.x - p.r, y: p.y - p.r },
    data: { c: p.c, d: p.r * 2, dim: false, on: false, hovered: false, liftColors: false },
  }))
  const seen = new Set<string>()
  const edges: Edge[] = []
  for (const a of pos) {
    const near = pos
      .filter((b) => b !== a)
      .map((b) => ({ b, d: Math.hypot(b.x - a.x, b.y - a.y) }))
      .sort((p1, p2) => p1.d - p2.d)
      .slice(0, 3)
    near.forEach(({ b }, rank) => {
      const key = [Math.min(a.c.id, b.c.id), Math.max(a.c.id, b.c.id)].join("-")
      if (seen.has(key)) return
      seen.add(key)
      edges.push({
        id: key,
        source: String(a.c.id),
        target: String(b.c.id),
        type: "straight",
        focusable: false,
        style: { stroke: "#cbd5e1", strokeWidth: 1.25, opacity: [0.55, 0.32, 0.18][rank] },
      })
    })
  }
  return { nodes, edges }
}

const CENTER_HANDLE: React.CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0, opacity: 0 }

function ClusterNode({ data }: NodeProps<ClusterFlowNode>) {
  const { c, d, dim, on, hovered, liftColors } = data
  return (
    <div className={cn("relative transition-opacity duration-200", dim && "opacity-15")} style={{ width: d, height: d }}>
      <Handle type="source" position={Position.Top} isConnectable={false} style={CENTER_HANDLE} />
      <Handle type="target" position={Position.Top} isConnectable={false} style={CENTER_HANDLE} />
      <div
        className="size-full cursor-pointer rounded-full transition-shadow"
        style={{ background: liftColors ? liftColor(c.lift) : hue(c.id), boxShadow: on ? "0 0 0 3px #fff, 0 0 0 5px var(--pax2-light-blue)" : hovered ? "0 0 0 3px #fff, 0 0 0 5px #bfdbfe" : undefined }}
      />
      <p className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-40 -translate-x-1/2 truncate text-center text-[10px] leading-tight text-slate-600">{title(c)}</p>
    </div>
  )
}

const nodeTypes = { cluster: ClusterNode }

function NetworkGraph({ layout, picked, hoverId, liftColors, onHover, onPick, onOpen }: {
  layout: { nodes: ClusterFlowNode[]; edges: Edge[] }
  picked: number | null
  hoverId: number | null
  liftColors: boolean
  onHover: (id: number | null) => void
  onPick: (id: number | null) => void
  onOpen: (id: number) => void
}) {
  const rf = useReactFlow()
  const [nodes, setNodes] = React.useState(layout.nodes)
  React.useEffect(() => {
    setNodes((ns) => ns.map((n) => {
      const id = Number(n.id)
      return { ...n, data: { ...n.data, dim: picked != null && id !== picked, on: picked === id, hovered: hoverId === id, liftColors } }
    }))
  }, [picked, hoverId, liftColors])
  React.useEffect(() => {
    if (picked == null) return
    const n = rf.getNodes().find((x) => x.id === String(picked)) as ClusterFlowNode | undefined
    if (!n) return
    rf.setCenter(n.position.x + n.data.d / 2, n.position.y + n.data.d / 2, { zoom: Math.max(rf.getZoom(), 0.7), duration: 500 })
  }, [picked, rf])
  const edges = React.useMemo(() => layout.edges.map((e) => {
    if (picked == null) return e
    const touches = e.source === String(picked) || e.target === String(picked)
    return { ...e, style: { ...e.style, ...(touches ? { stroke: "#94a3b8", opacity: 0.7 } : { opacity: 0.05 }) } }
  }), [layout, picked])
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={(changes: NodeChange<ClusterFlowNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns))}
      onNodeClick={(_, n) => { const id = Number(n.id); if (picked === id) onOpen(id); else onPick(id) }}
      onNodeMouseEnter={(_, n) => onHover(Number(n.id))}
      onNodeMouseLeave={() => onHover(null)}
      onPaneClick={() => onPick(null)}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.1}
      maxZoom={2.5}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#94a3b8" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

/* ── the overlay ─────────────────────────────────────────────────────────── */

export function ClusterMap({ onClose, initialLayer = "network" }: { onClose: () => void; initialLayer?: "network" | "points" | "vector" }) {
  const router = useRouter()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [data, setData] = React.useState<MapData | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [layer, setLayer] = React.useState<"network" | "points" | "vector">(initialLayer)
  const [mode, setMode] = React.useState<"cluster" | "tier" | "resonance" | "composition">(initialLayer === "vector" ? "resonance" : "cluster")
  const [filters, setFilters] = React.useState<Set<CompFilter>>(new Set())
  const [picked, setPicked] = React.useState<number | null>(null)
  const [hoverId, setHoverId] = React.useState<number | null>(null)
  const [tour, setTour] = React.useState<number | null>(null)
  const [hover,setHover] = React.useState<{ sx: number; sy: number; title: string; sub: string } | null>(null)
  const view = React.useRef({ k: 1, tx: 0, ty: 0 })
  const drag = React.useRef<{ x: number; y: number; moved: boolean } | null>(null)

  React.useEffect(() => {
    fetch("/api/encoder-map").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true))
  }, [])

  const layout = React.useMemo(() => (data ? layoutClusters(data) : null), [data])

  const fitPoints = React.useCallback((cluster: number | null) => {
    const el = wrapRef.current
    if (!el || !data) return
    const pts = cluster == null ? data.points : data.points.filter((p) => p.cluster === cluster)
    if (!pts.length) return
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const k = Math.min(el.clientWidth / ((x1 - x0) * 1.2 + 2), el.clientHeight / ((y1 - y0) * 1.2 + 2))
    view.current = { k, tx: el.clientWidth / 2 - ((x0 + x1) / 2) * k, ty: el.clientHeight / 2 - ((y0 + y1) / 2) * k }
  }, [data])

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    const el = wrapRef.current
    if (!canvas || !el || !data) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== el.clientWidth * dpr) {
      canvas.width = el.clientWidth * dpr
      canvas.height = el.clientHeight * dpr
    }
    const ctx = canvas.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, el.clientWidth, el.clientHeight)
    const { k, tx, ty } = view.current
    // The vector reading: dashed zero axes through the space's origin, the four quadrants kept.
    if (layer === "vector") {
      ctx.strokeStyle = "#94a3b8"
      ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(0, ty)
      ctx.lineTo(el.clientWidth, ty)
      ctx.moveTo(tx, 0)
      ctx.lineTo(tx, el.clientHeight)
      ctx.stroke()
      ctx.setLineDash([])
    }
    const liftOf = new Map(data.clusters.map((c) => [c.id, c.lift]))
    const active = COMP_FILTERS.filter((f) => filters.has(f.key))
    for (const p of data.points) {
      const filtered = mode === "composition" && active.length > 0 && !active.every((f) => f.test(p))
      const dim = (picked != null && p.cluster !== picked) || filtered
      ctx.globalAlpha = dim ? 0.06 : 0.75
      ctx.fillStyle = mode === "cluster" ? hue(p.cluster) : mode === "tier" ? (TIER[p.tier] ?? "#cbd5e1") : liftColor(liftOf.get(p.cluster) ?? null)
      ctx.beginPath()
      ctx.arc(p.x * k + tx, p.y * k + ty, 2.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [data, mode, picked, filters, layer])

  // The points canvas frames the picked cluster (or the whole corpus) whenever the pick,
  // the layer or the data changes; the network's ReactFlow canvas frames itself.
  React.useEffect(() => {
    if (layer === "network") return
    fitPoints(picked)
    draw()
  }, [layer, picked, fitPoints, draw])
  React.useEffect(() => {
    const onResize = () => {
      if (layer === "network") return
      fitPoints(picked)
      draw()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [layer, picked, fitPoints, draw])

  const nearestPoint = (sx: number, sy: number) => {
    if (!data) return null
    const { k, tx, ty } = view.current
    let best: MapPoint | null = null
    let bd = 81
    for (const p of data.points) {
      if (picked != null && p.cluster !== picked) continue
      const dx = p.x * k + tx - sx
      const dy = p.y * k + ty - sy
      const d = dx * dx + dy * dy
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  const strip = data ? [...data.clusters].filter((c) => c.lift != null && c.n >= 50).sort((a, b) => b.lift! - a.lift!) : []
  const sel = data ? (data.clusters.find((c) => c.id === hoverId) ?? data.clusters.find((c) => c.id === picked) ?? strip[0] ?? null) : null
  const selShorts = React.useMemo(() => (data && sel ? data.points.filter((p) => p.cluster === sel.id).slice(0, 8) : []), [data, sel])
  const pick = (id: number | null) => setPicked(id)
  const openPoints = (id: number) => {
    setPicked(id)
    setLayer("points")
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <p className="text-sm font-semibold">Clusters</p>
        <div className="flex rounded-full border border-slate-200 p-0.5">
          {(["network", "points", "vector"] as const).map((l) => (
            <button key={l} onClick={() => setLayer(l)} className={cn("h-7 rounded-full px-3 text-xs font-medium transition-colors", layer === l ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
              {l === "network" ? "Network" : l === "points" ? "Points" : "Vector"}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-slate-200 p-0.5">
          {(["cluster", "tier", "resonance", "composition"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("h-7 rounded-full px-3 text-xs font-medium transition-colors", mode === m ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
              {m === "cluster" ? "By cluster" : m === "tier" ? "By tier" : m === "resonance" ? "Resonance" : "Composition"}
            </button>
          ))}
        </div>
        {layer !== "network" && mode === "composition" && (
          <div className="flex items-center gap-1.5">
            {COMP_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilters((s) => { const n = new Set(s); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n })}
                className={cn("h-7 rounded-full border px-3 text-xs font-medium transition-colors", filters.has(f.key) ? "border-pax2-light-blue bg-pax2-lavender/60 text-pax2-blue" : "border-slate-200 text-slate-500 hover:text-pax2-blue")}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setTour(tour == null ? 0 : null)} className={cn("ml-auto h-7 rounded-full border px-3 text-xs font-medium transition-colors", tour != null ? "border-pax2-light-blue bg-pax2-lavender/60 text-pax2-blue" : "border-slate-200 text-slate-500 hover:text-pax2-blue")}>
          Tour
        </button>
        <button onClick={onClose} aria-label="Close the cluster map" className="inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 overflow-y-auto border-r p-3 lg:block">
          {data && (
            <button
              onClick={() => pick(null)}
              className={cn("mb-2 w-full rounded-md border px-2.5 py-2 text-left transition-colors", picked == null ? "border-pax2-light-blue bg-pax2-lavender/40" : "border-transparent hover:bg-slate-50")}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pax2-blue">Origin corpus</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">Run {data.run}</p>
              <p className="text-[11px] text-slate-500">{data.n.toLocaleString()} shorts · k {data.k}</p>
            </button>
          )}
          {strip.map((c) => (
            <button
              key={c.id}
              onClick={() => (picked === c.id ? pick(null) : pick(c.id))}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
              className={cn(
                "mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                picked === c.id ? "border-pax2-light-blue bg-pax2-lavender/40" : hoverId === c.id ? "border-transparent bg-slate-50" : "border-transparent hover:bg-slate-50",
              )}
            >
              <p className="flex items-baseline gap-2 text-xs">
                <span className="size-2.5 shrink-0 self-center rounded-full" style={{ background: hue(c.id) }} />
                <span className={cn("font-semibold tabular-nums", c.lift! > 0 ? "text-pax2-above" : "text-pax2-below")}>
                  {c.lift! > 0 ? "+" : ""}
                  {c.lift}
                </span>
                <span className="text-slate-500">
                  {c.n} shorts · {c.channels} channels
                </span>
              </p>
              <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">{title(c)}</p>
            </button>
          ))}
        </div>
        <div className="relative min-h-0 min-w-0 flex-1">
          {layer === "network" && layout && (
            <ReactFlowProvider>
              <NetworkGraph layout={layout} picked={picked} hoverId={hoverId} liftColors={mode === "resonance" || mode === "composition"} onHover={setHoverId} onPick={pick} onOpen={openPoints} />
            </ReactFlowProvider>
          )}
          {layer !== "network" && (
            <div
              ref={wrapRef}
              className="absolute inset-0 cursor-crosshair overflow-hidden"
              onWheel={(e) => {
                const el = wrapRef.current!
                const r = el.getBoundingClientRect()
                const sx = e.clientX - r.left
                const sy = e.clientY - r.top
                const f = Math.exp(-e.deltaY * 0.0016)
                const v = view.current
                view.current = { k: v.k * f, tx: sx - (sx - v.tx) * f, ty: sy - (sy - v.ty) * f }
                draw()
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { x: e.clientX, y: e.clientY, moved: false }
              }}
              onPointerMove={(e) => {
                const r = wrapRef.current!.getBoundingClientRect()
                const sx = e.clientX - r.left
                const sy = e.clientY - r.top
                if (drag.current && e.buttons) {
                  const dx = e.clientX - drag.current.x
                  const dy = e.clientY - drag.current.y
                  if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
                  drag.current = { x: e.clientX, y: e.clientY, moved: drag.current.moved }
                  setHover(null)
                  view.current = { ...view.current, tx: view.current.tx + dx, ty: view.current.ty + dy }
                  draw()
                  return
                }
                const p = nearestPoint(sx, sy)
                setHover(p ? { sx, sy, title: p.label, sub: `${p.tier} · cluster ${p.cluster}` } : null)
              }}
              onPointerUp={(e) => {
                const moved = drag.current?.moved
                drag.current = null
                if (!data || moved) return
                const r = wrapRef.current!.getBoundingClientRect()
                const p = nearestPoint(e.clientX - r.left, e.clientY - r.top)
                if (p) router.push(`/v/yt-${p.id}`)
              }}
              onPointerLeave={() => setHover(null)}
            >
              <canvas ref={canvasRef} className="size-full" />
              {hover && (
                <div style={{ left: hover.sx + 12, top: hover.sy + 12 }} className="pointer-events-none absolute z-10 max-w-72 rounded-md border bg-white px-2.5 py-1.5 shadow-md">
                  <p className="line-clamp-2 text-xs font-medium">{hover.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{hover.sub}</p>
                </div>
              )}
            </div>
          )}
          {(mode === "resonance" || mode === "composition") && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-stretch gap-1.5 rounded-md border bg-white/90 p-2 shadow-sm">
              <div className="w-2.5 rounded-sm" style={{ background: `linear-gradient(to bottom, ${liftColor(12)}, #cbd5e1, ${liftColor(-12)})` }} />
              <div className="flex flex-col justify-between text-[10px] tabular-nums text-slate-500">
                <span>+12</span>
                <span>0</span>
                <span>−12</span>
              </div>
            </div>
          )}
          {tour != null && (
            <div className="absolute bottom-6 left-1/2 z-20 w-[26rem] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-e2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pax2-blue">{tour + 1} of {TOUR.length}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{TOUR[tour]}</p>
              <div className="mt-3 flex items-center gap-2">
                {tour > 0 && <button onClick={() => setTour(tour - 1)} className="h-7 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:border-pax2-blue">Back</button>}
                {tour < TOUR.length - 1 ? (
                  <button onClick={() => setTour(tour + 1)} className="h-7 rounded-full bg-pax2-blue px-3 text-xs font-medium text-white hover:opacity-90">Next</button>
                ) : (
                  <button onClick={() => setTour(null)} className="h-7 rounded-full bg-pax2-blue px-3 text-xs font-medium text-white hover:opacity-90">Done</button>
                )}
                <button onClick={() => setTour(null)} className="ml-auto h-7 px-2 text-xs text-slate-400 hover:text-slate-600">Skip</button>
              </div>
            </div>
          )}
          {!data && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
              {failed ? "No map built yet; scripts/encoder/map-launch.sh writes it." : <><Loader2 className="size-4 animate-spin" /> loading the map</>}
            </p>
          )}
        </div>
        <div className="hidden w-80 shrink-0 overflow-y-auto border-l p-4 md:block">
          {sel && (
            <>
              <p className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: hue(sel.id) }} />
                {sel.lift != null && (
                  <span className={cn("text-sm font-semibold tabular-nums", sel.lift > 0 ? "text-pax2-above" : "text-pax2-below")}>
                    {sel.lift > 0 ? "+" : ""}
                    {sel.lift}
                  </span>
                )}
                <span className="text-xs text-slate-500">{sel.n} shorts · {sel.channels} channels</span>
              </p>
              <h2 className="mt-2 text-sm font-semibold leading-snug text-slate-900">{title(sel)}</h2>
              {sel.rate != null && <p className="mt-1 text-xs text-slate-500">Outlier rate {sel.rate}%</p>}
              <div className="mt-3 flex gap-2">
                {layer === "network" ? (
                  <button onClick={() => openPoints(sel.id)} className="h-7 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-pax2-blue transition-colors hover:border-pax2-blue hover:bg-slate-50">
                    Open as points
                  </button>
                ) : (
                  <button onClick={() => setLayer("network")} className="h-7 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-pax2-blue transition-colors hover:border-pax2-blue hover:bg-slate-50">
                    Back to the network
                  </button>
                )}
              </div>
              {selShorts.length > 0 && (
                <>
                  <p className="mt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shorts</p>
                  {selShorts.map((p) => (
                    <button key={p.id} onClick={() => router.push(`/v/yt-${p.id}`)} className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-slate-50">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: TIER[p.tier] ?? "#cbd5e1" }} />
                      <span className="line-clamp-2 text-xs text-slate-700">{p.label}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
