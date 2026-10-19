"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// The cluster layer over the graph, in two views. Network: the clusters as an Obsidian-style
// force graph — every cluster a node floating around the corpus at the center, sized by its
// shorts, springing on its edge, bouncing off its neighbors, draggable and throwable, settling
// when let go (the switchboard cluster's physics, from nysgpt-landing's canvas variant). Points:
// every corpus short at its UMAP position on one canvas, as before. A cluster clicked once in
// the network is picked; clicked again it opens as points. The strip's statistic is lift:
// percentage points above each short's own channel's outlier rate, so one hot channel cannot
// masquerade as a content finding.

type MapPoint = { id: string; x: number; y: number; cluster: number; tier: string; label: string }
type MapCluster = { id: number; n: number; channels: number; rate: number | null; lift: number | null; labels: string[] }
type MapData = { run: string; builtAt: string; n: number; k: number; clusters: MapCluster[]; points: MapPoint[] }

const hue = (c: number) => `hsl(${(c * 47) % 360} 68% 52%)`
const TIER: Record<string, string> = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" }

/* ── the network's physics ───────────────────────────────────────────────── */

type SimNode = { c: MapCluster | null; x: number; y: number; vx: number; vy: number; r: number }

const FRICTION = 0.9
const REPEL = 2400
const SPRING = 0.012
const GRAV = 0.012

function seedNodes(data: MapData): SimNode[] {
  const center: SimNode = { c: null, x: 0, y: 0, vx: 0, vy: 0, r: 30 }
  const ring = data.clusters.map((c, i) => {
    const a = (i / data.clusters.length) * Math.PI * 2
    const rad = 220 + (i % 3) * 70
    return { c, x: Math.cos(a) * rad, y: Math.sin(a) * rad, vx: 0, vy: 0, r: 9 + Math.sqrt(c.n) * 0.45 }
  })
  return [center, ...ring]
}

/** One step: springs to the center, repulsion between every pair, soft collisions for the bounce,
 *  a light pull home, friction; the dragged node is the cursor's and sits the step out. */
function step(nodes: SimNode[], held: number | null) {
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i]
    const rest = 170 + n.r * 3
    const d = Math.hypot(n.x, n.y) || 1
    const f = SPRING * (d - rest)
    n.vx -= (n.x / d) * f
    n.vy -= (n.y / d) * f
    n.vx -= n.x * GRAV * 0.02
    n.vy -= n.y * GRAV * 0.02
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy || 1
      const d = Math.sqrt(d2)
      const push = Math.min(REPEL / d2, 6)
      const ux = dx / d
      const uy = dy / d
      a.vx -= ux * push
      a.vy -= uy * push
      b.vx += ux * push
      b.vy += uy * push
      const overlap = a.r + b.r + 6 - d
      if (overlap > 0) {
        const k = overlap * 0.18
        a.vx -= ux * k
        a.vy -= uy * k
        b.vx += ux * k
        b.vy += uy * k
      }
    }
  }
  nodes[0].x = 0
  nodes[0].y = 0
  nodes[0].vx = 0
  nodes[0].vy = 0
  for (let i = 1; i < nodes.length; i++) {
    if (i === held) continue
    const n = nodes[i]
    n.vx *= FRICTION
    n.vy *= FRICTION
    n.x += Math.max(-14, Math.min(14, n.vx))
    n.y += Math.max(-14, Math.min(14, n.vy))
  }
}

export function ClusterMap({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [data, setData] = React.useState<MapData | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [layer, setLayer] = React.useState<"network" | "points">("network")
  const [mode, setMode] = React.useState<"cluster" | "tier">("cluster")
  const [picked, setPicked] = React.useState<number | null>(null)
  const [hover, setHover] = React.useState<{ sx: number; sy: number; title: string; sub: string } | null>(null)
  const view = React.useRef({ k: 1, tx: 0, ty: 0 })
  const drag = React.useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const nodes = React.useRef<SimNode[]>([])
  const held = React.useRef<number | null>(null)
  const layerRef = React.useRef(layer)
  layerRef.current = layer

  React.useEffect(() => {
    fetch("/api/encoder-map").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true))
  }, [])
  React.useEffect(() => {
    if (data) nodes.current = seedNodes(data)
  }, [data])

  const fitPoints = React.useCallback(() => {
    const el = wrapRef.current
    if (!el || !data) return
    const xs = data.points.map((p) => p.x)
    const ys = data.points.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const k = Math.min(el.clientWidth / (x1 - x0 + 2), el.clientHeight / (y1 - y0 + 2)) * 0.94
    view.current = { k, tx: el.clientWidth / 2 - ((x0 + x1) / 2) * k, ty: el.clientHeight / 2 - ((y0 + y1) / 2) * k }
  }, [data])
  const fitNetwork = React.useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    view.current = { k: 0.9, tx: el.clientWidth / 2, ty: el.clientHeight / 2 }
  }, [])
  const fit = React.useCallback(() => (layerRef.current === "points" ? fitPoints() : fitNetwork()), [fitPoints, fitNetwork])

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
    if (layerRef.current === "points") {
      for (const p of data.points) {
        const dim = picked != null && p.cluster !== picked
        ctx.globalAlpha = dim ? 0.06 : 0.75
        ctx.fillStyle = mode === "cluster" ? hue(p.cluster) : (TIER[p.tier] ?? "#cbd5e1")
        ctx.beginPath()
        ctx.arc(p.x * k + tx, p.y * k + ty, 2.1, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      return
    }
    // The network: edges from the corpus out, then every cluster as its node.
    const ns = nodes.current
    ctx.lineWidth = 1
    for (let i = 1; i < ns.length; i++) {
      const n = ns[i]
      const dim = picked != null && n.c!.id !== picked
      ctx.globalAlpha = dim ? 0.08 : 0.3
      ctx.strokeStyle = "#94a3b8"
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(n.x * k + tx, n.y * k + ty)
      ctx.stroke()
    }
    for (let i = 1; i < ns.length; i++) {
      const n = ns[i]
      const dim = picked != null && n.c!.id !== picked
      ctx.globalAlpha = dim ? 0.18 : 1
      ctx.fillStyle = hue(n.c!.id)
      ctx.beginPath()
      ctx.arc(n.x * k + tx, n.y * k + ty, n.r * k, 0, Math.PI * 2)
      ctx.fill()
      if (picked === n.c!.id) {
        ctx.strokeStyle = "#2563eb"
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.lineWidth = 1
      }
      if (n.r * k > 11) {
        ctx.globalAlpha = dim ? 0.2 : 0.85
        ctx.fillStyle = "#334155"
        ctx.font = "10px var(--font-sans, sans-serif)"
        ctx.textAlign = "center"
        const t = n.c!.labels[0] ?? `cluster ${n.c!.id}`
        ctx.fillText(t.length > 22 ? `${t.slice(0, 21)}…` : t, n.x * k + tx, (n.y + n.r) * k + ty + 12)
      }
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = "#1e3a8a"
    ctx.beginPath()
    ctx.arc(tx, ty, ns[0].r * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = "600 10px var(--font-sans, sans-serif)"
    ctx.textAlign = "center"
    ctx.fillText("corpus", tx, ty + 3)
  }, [data, mode, picked])

  // The network never sleeps: the sim ticks and redraws each frame, Obsidian's idle sway included.
  React.useEffect(() => {
    if (!data || layer !== "network") return
    let raf = 0
    const tick = () => {
      step(nodes.current, held.current)
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data, layer, draw])

  React.useEffect(() => {
    fit()
    draw()
  }, [fit, draw, layer])
  React.useEffect(() => {
    const onResize = () => {
      fit()
      draw()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [fit, draw])

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
  const nodeAt = (sx: number, sy: number) => {
    const { k, tx, ty } = view.current
    for (let i = nodes.current.length - 1; i >= 1; i--) {
      const n = nodes.current[i]
      if (Math.hypot(n.x * k + tx - sx, n.y * k + ty - sy) <= n.r * k + 4) return i
    }
    return null
  }

  const strip = data ? [...data.clusters].filter((c) => c.lift != null && c.n >= 50).sort((a, b) => b.lift! - a.lift!) : []

  return (
    <div className="fixed inset-0 z-40 flex bg-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Clusters</p>
          <div className="flex rounded-full border border-slate-200 p-0.5">
            {(["network", "points"] as const).map((l) => (
              <button key={l} onClick={() => setLayer(l)} className={cn("h-7 rounded-full px-3 text-xs font-medium transition-colors", layer === l ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
                {l === "network" ? "Network" : "Points"}
              </button>
            ))}
          </div>
          {layer === "points" && (
            <div className="flex rounded-full border border-slate-200 p-0.5">
              {(["cluster", "tier"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn("h-7 rounded-full px-3 text-xs font-medium transition-colors", mode === m ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
                  {m === "cluster" ? "By cluster" : "By tier"}
                </button>
              ))}
            </div>
          )}
          {data && (
            <p className="text-xs text-slate-500">
              {data.n.toLocaleString()} shorts, k {data.k}, run {data.run}
            </p>
          )}
          <button onClick={onClose} aria-label="Close the cluster map" className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div
          ref={wrapRef}
          className={cn("relative min-h-0 flex-1 overflow-hidden", layer === "network" ? "cursor-grab" : "cursor-crosshair")}
          onWheel={(e) => {
            const el = wrapRef.current!
            const r = el.getBoundingClientRect()
            const sx = e.clientX - r.left
            const sy = e.clientY - r.top
            const f = Math.exp(-e.deltaY * 0.0016)
            const v = view.current
            view.current = { k: v.k * f, tx: sx - (sx - v.tx) * f, ty: sy - (sy - v.ty) * f }
            if (layerRef.current === "points") draw()
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const r = wrapRef.current!.getBoundingClientRect()
            if (layer === "network") held.current = nodeAt(e.clientX - r.left, e.clientY - r.top)
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
              if (layer === "network" && held.current != null) {
                // The held node rides the cursor and keeps its momentum for the throw.
                const n = nodes.current[held.current]
                const { k, tx, ty } = view.current
                n.vx = dx / k
                n.vy = dy / k
                n.x = (sx - tx) / k
                n.y = (sy - ty) / k
              } else {
                view.current = { ...view.current, tx: view.current.tx + dx, ty: view.current.ty + dy }
                if (layer === "points") draw()
              }
              return
            }
            if (layer === "points") {
              const p = nearestPoint(sx, sy)
              setHover(p ? { sx, sy, title: p.label, sub: `${p.tier} · cluster ${p.cluster}` } : null)
            } else {
              const i = nodeAt(sx, sy)
              const c = i != null ? nodes.current[i].c! : null
              setHover(c ? { sx, sy, title: c.labels[0] ?? `Cluster ${c.id}`, sub: `${c.n} shorts · ${c.channels} channels${c.lift != null ? ` · lift ${c.lift > 0 ? "+" : ""}${c.lift}` : ""}` } : null)
            }
          }}
          onPointerUp={(e) => {
            const moved = drag.current?.moved
            const heldNow = held.current
            drag.current = null
            held.current = null
            if (!data) return
            const r = wrapRef.current!.getBoundingClientRect()
            if (layer === "network") {
              if (moved || heldNow == null) return
              const c = nodes.current[heldNow].c!
              // First click picks the cluster; a second on the same one opens it as points.
              if (picked === c.id) {
                setLayer("points")
              } else setPicked(c.id)
              return
            }
            if (moved) return
            const p = nearestPoint(e.clientX - r.left, e.clientY - r.top)
            if (p) router.push(`/v/yt-${p.id}`)
          }}
          onPointerLeave={() => setHover(null)}
        >
          <canvas ref={canvasRef} className="size-full" />
          {!data && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
              {failed ? "No map built yet; scripts/encoder/map-launch.sh writes it." : <><Loader2 className="size-4 animate-spin" /> loading 18,455 points</>}
            </p>
          )}
          {hover && (
            <div style={{ left: hover.sx + 12, top: hover.sy + 12 }} className="pointer-events-none absolute z-10 max-w-72 rounded-md border bg-white px-2.5 py-1.5 shadow-md">
              <p className="line-clamp-2 text-xs font-medium">{hover.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{hover.sub}</p>
            </div>
          )}
        </div>
      </div>
      <div className="hidden w-80 shrink-0 overflow-y-auto border-l p-3 md:block">
        <p className="px-1 pb-2 text-[10px] tracking-wide text-slate-400 uppercase">Clusters by lift, points above the channel's own rate</p>
        {strip.map((c) => (
          <button key={c.id} onClick={() => setPicked(picked === c.id ? null : c.id)} className={cn("mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors", picked === c.id ? "border-pax2-light-blue bg-pax2-lavender/40" : "border-transparent hover:bg-slate-50")}>
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
            <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">{c.labels[0]}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
