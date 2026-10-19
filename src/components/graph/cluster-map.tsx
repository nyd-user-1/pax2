"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// The cluster layer over the graph: every corpus short as one point in the encoder's space,
// 2-D UMAP positions and k-means clusters from /api/encoder-map, drawn on one canvas so 18,455
// points pan and zoom without a framework in the way. Color by cluster or by tier; a cluster
// picked from the strip dims the rest; a clicked point opens its video, which centers it on the
// canvas beneath. The strip's statistic is lift: percentage points above each short's own
// channel's outlier rate, so one hot channel cannot masquerade as a content finding.

type MapPoint = { id: string; x: number; y: number; cluster: number; tier: string; label: string }
type MapCluster = { id: number; n: number; channels: number; rate: number | null; lift: number | null; labels: string[] }
type MapData = { run: string; builtAt: string; n: number; k: number; clusters: MapCluster[]; points: MapPoint[] }

const hue = (c: number) => `hsl(${(c * 47) % 360} 68% 52%)`
const TIER: Record<string, string> = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" }

export function ClusterMap({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [data, setData] = React.useState<MapData | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [mode, setMode] = React.useState<"cluster" | "tier">("cluster")
  const [picked, setPicked] = React.useState<number | null>(null)
  const [hover, setHover] = React.useState<{ p: MapPoint; sx: number; sy: number } | null>(null)
  const view = React.useRef({ k: 1, tx: 0, ty: 0 })
  const drag = React.useRef<{ x: number; y: number; moved: boolean } | null>(null)

  React.useEffect(() => {
    fetch("/api/encoder-map").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true))
  }, [])

  const fit = React.useCallback(() => {
    const el = wrapRef.current
    if (!el || !data) return
    const xs = data.points.map((p) => p.x)
    const ys = data.points.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const k = Math.min(el.clientWidth / (x1 - x0 + 2), el.clientHeight / (y1 - y0 + 2)) * 0.94
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
    for (const p of data.points) {
      const dim = picked != null && p.cluster !== picked
      ctx.globalAlpha = dim ? 0.06 : 0.75
      ctx.fillStyle = mode === "cluster" ? hue(p.cluster) : (TIER[p.tier] ?? "#cbd5e1")
      ctx.beginPath()
      ctx.arc(p.x * k + tx, p.y * k + ty, 2.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [data, mode, picked])

  React.useEffect(() => {
    fit()
    draw()
  }, [fit, draw])
  React.useEffect(() => {
    const onResize = () => {
      fit()
      draw()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [fit, draw])

  const nearest = (sx: number, sy: number) => {
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

  return (
    <div className="fixed inset-0 z-40 flex bg-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Clusters</p>
          <div className="flex rounded-full border border-slate-200 p-0.5">
            {(["cluster", "tier"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("h-7 rounded-full px-3 text-xs font-medium transition-colors", mode === m ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
                {m === "cluster" ? "By cluster" : "By tier"}
              </button>
            ))}
          </div>
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
          className="relative min-h-0 flex-1 cursor-crosshair overflow-hidden"
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
            drag.current = { x: e.clientX, y: e.clientY, moved: false }
          }}
          onPointerMove={(e) => {
            const r = wrapRef.current!.getBoundingClientRect()
            if (drag.current && e.buttons) {
              const dx = e.clientX - drag.current.x
              const dy = e.clientY - drag.current.y
              if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
              drag.current = { x: e.clientX, y: e.clientY, moved: drag.current.moved }
              view.current = { ...view.current, tx: view.current.tx + dx, ty: view.current.ty + dy }
              setHover(null)
              draw()
            } else {
              const p = nearest(e.clientX - r.left, e.clientY - r.top)
              setHover(p ? { p, sx: e.clientX - r.left, sy: e.clientY - r.top } : null)
            }
          }}
          onPointerUp={(e) => {
            const moved = drag.current?.moved
            drag.current = null
            if (moved || !data) return
            const r = wrapRef.current!.getBoundingClientRect()
            const p = nearest(e.clientX - r.left, e.clientY - r.top)
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
              <p className="line-clamp-2 text-xs font-medium">{hover.p.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {hover.p.tier} · cluster {hover.p.cluster}
              </p>
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
