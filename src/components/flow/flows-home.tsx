"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Copy, MoreHorizontal, PencilLine, Plus, Search, Trash2 } from "lucide-react"

import { deleteFlow, fromTemplate, readFlows, saveFlow, NODE_H, NODE_W, TEMPLATES, type SavedEdge, type SavedFlow, type SavedNode } from "@/components/flow/steps"
import { cn } from "@/ui/lib/utils"

// The flows home, in the shape of ElevenLabs' Flows: an inspiration row of templates,
// then the saved flows with search and sort. Opening anything lands on /flow/<id>'s canvas.

const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** A flow drawn small: its nodes as cards, its edges as curves, scaled into the card's preview. */
export function FlowThumb({ nodes, edges, className }: { nodes: SavedNode[]; edges: SavedEdge[]; className?: string }) {
  const W = 220
  const H = 96
  const PAD = 14
  const BW = 30
  const BH = 15
  const cx = (n: SavedNode) => n.x + NODE_W / 2
  const cy = (n: SavedNode) => n.y + NODE_H / 2
  const xs = nodes.map(cx)
  const ys = nodes.map(cy)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(1, Math.max(...xs) - minX)
  const spanY = Math.max(1, Math.max(...ys) - minY)
  const scale = Math.min((W - PAD * 2 - BW) / spanX, (H - PAD * 2 - BH) / spanY, 1)
  const px = (n: SavedNode) => PAD + BW / 2 + (cx(n) - minX) * scale + (W - PAD * 2 - BW - spanX * scale) / 2
  const py = (n: SavedNode) => PAD + BH / 2 + (cy(n) - minY) * scale + (H - PAD * 2 - BH - spanY * scale) / 2
  const by = new Map(nodes.map((n) => [n.id, n]))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-full w-full", className)} aria-hidden>
      {edges.map((e, i) => {
        const s = by.get(e.s)
        const t = by.get(e.t)
        if (!s || !t) return null
        const x1 = px(s) + BW / 2
        const y1 = py(s)
        const x2 = px(t) - BW / 2
        const y2 = py(t)
        const dx = Math.max(16, (x2 - x1) / 2)
        return <path key={i} d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`} fill="none" stroke="#b3c7e6" strokeWidth="1.5" />
      })}
      {nodes.map((n) => (
        <rect key={n.id} x={px(n) - BW / 2} y={py(n) - BH / 2} width={BW} height={BH} rx="3.5" fill="#fff" stroke="#cbd5e1" strokeWidth="1.25" />
      ))}
    </svg>
  )
}

function Kebab({ flow, onChanged }: { flow: SavedFlow; onChanged: () => void }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [renaming, setRenaming] = React.useState(false)
  const [name, setName] = React.useState(flow.name)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])
  const commitRename = () => {
    setRenaming(false)
    const clean = name.trim()
    if (!clean || clean === flow.name) return
    saveFlow({ ...flow, name: clean, updatedAt: new Date().toISOString() })
    onChanged()
  }
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue [&_svg]:size-3.5 [&_svg]:text-slate-400"
  if (renaming)
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename()
          if (e.key === "Escape") setRenaming(false)
        }}
        aria-label="Flow name"
        className="w-40 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm outline-none focus:border-pax2-light-blue"
      />
    )
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={`Options for ${flow.name}`} onClick={(e) => (e.preventDefault(), e.stopPropagation(), setOpen((v) => !v))} className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-pax2-blue">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-e3" onClick={(e) => (e.preventDefault(), e.stopPropagation())}>
          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), setRenaming(true))}>
            <PencilLine /> Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              const copy: SavedFlow = { ...flow, id: `f${Date.now()}`, name: `${flow.name} (copy)`, updatedAt: new Date().toISOString() }
              saveFlow(copy)
              setOpen(false)
              router.push(`/flow/${copy.id}`)
            }}
          >
            <Copy /> Duplicate
          </button>
          <button type="button" role="menuitem" className={cn(item, "text-pax2-red-deep hover:text-pax2-red-deep [&_svg]:text-pax2-red-deep")} onClick={() => (deleteFlow(flow.id), setOpen(false), onChanged())}>
            <Trash2 /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export function FlowsHome() {
  const router = useRouter()
  const [flows, setFlows] = React.useState<SavedFlow[]>([])
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<"edited" | "az">("edited")
  const refresh = React.useCallback(() => setFlows(readFlows()), [])
  React.useEffect(refresh, [refresh])
  const openTemplate = (name: string, steps: Parameters<typeof fromTemplate>[1]) => {
    const flow = fromTemplate(name, steps)
    saveFlow(flow)
    router.push(`/flow/${flow.id}`)
  }
  const needle = q.trim().toLowerCase()
  const shown = flows
    .filter((f) => !needle || f.name.toLowerCase().includes(needle))
    .sort((a, b) => (sort === "az" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt)))
  const preview = "aspect-[220/96] w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow group-hover:shadow-e2"
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-900">Inspiration</h2>
          <button type="button" onClick={() => router.push(`/flow/f${Date.now()}`)} className="press flex items-center gap-1.5 rounded-full bg-pax2-blue px-4 py-2 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-e3">
            <Plus className="size-4" /> New Flow
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const f = fromTemplate(t.name, t.steps)
            return (
              <button key={t.name} type="button" onClick={() => openTemplate(t.name, t.steps)} className="group flex flex-col gap-2 text-left">
                <span className={preview}>
                  <FlowThumb nodes={f.nodes} edges={f.edges} />
                </span>
                <span className="text-sm font-medium text-slate-900">{t.name}</span>
                <span className="text-xs text-slate-500">{t.steps.length} steps</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Recent flows</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-full max-w-sm items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-e1 transition-colors focus-within:border-slate-300">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flows…" aria-label="Search flows" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                ["edited", "Last edited"],
                ["az", "A to Z"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setSort(key)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-shadow", sort === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-e1 hover:shadow-e2")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{flows.length === 0 ? "No flows yet. Start from a template above, or New Flow." : "No flow matches."}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => (
              <div key={f.id} role="link" tabIndex={0} onClick={() => router.push(`/flow/${f.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/flow/${f.id}`)} className="group flex cursor-pointer flex-col gap-2 outline-none">
                <span className={preview}>
                  {f.nodes.length ? <FlowThumb nodes={f.nodes} edges={f.edges} /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">Empty canvas</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{f.name}</span>
                    <span className="text-xs text-slate-500">Updated {ago(f.updatedAt)}</span>
                  </span>
                  <Kebab flow={f} onChanged={refresh} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
