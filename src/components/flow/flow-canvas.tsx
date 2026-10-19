"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  addEdge, Background, BackgroundVariant, Handle, Position, ReactFlow, ReactFlowProvider, SelectionMode,
  useEdgesState, useNodesState, useReactFlow, useViewport,
  type Connection, type Edge, type Node,
} from "@xyflow/react"
import { ArrowLeft, ArrowUp, Check, ChevronDown, Copy, ExternalLink, GitBranch, Hand, Maximize2, MousePointer2, PencilLine, Plus, Redo2, Search, Trash2, Undo2 } from "lucide-react"

import { deleteFlow, readFlows, saveFlow, tidy, CATEGORIES, NODE_W, STEP, STEP_KEYS, TEMPLATES, type SavedFlow, type StepKey } from "@/components/flow/steps"
import { cn } from "@/ui/lib/utils"

// The flow canvas, in the shape of ElevenLabs' Flows editor: the Flows menu and the flow's name
// floating top-left, zoom and tidy top-right, the tool rail and the quick-add bar along the bottom,
// and an add-step palette with search and categories. Every change saves itself; undo covers the
// canvas's content, never pan or zoom (the same rule as /graph).

const EDGE = { type: "default" as const, style: { stroke: "#8fb3e8", strokeWidth: 1.75 } }
const edgeOf = (s: string, t: string): Edge => ({ id: `e${s}-${t}`, source: s, target: t, ...EDGE })

type Snap = { nodes: { id: string; step: StepKey; x: number; y: number }[]; edges: { s: string; t: string }[] }

const CanvasCtx = React.createContext<{ remove: (id: string) => void }>({ remove: () => {} })

const HANDLE = "!size-2.5 !rounded-full !border-[1.5px] !border-[#8fb3e8] !bg-white"

function StepNode({ id, data, selected }: { id: string; data: { step: StepKey }; selected?: boolean }) {
  const { remove } = React.useContext(CanvasCtx)
  const s = STEP[data.step]
  const Icon = s.icon
  return (
    <div className="group/node relative" style={{ width: NODE_W }}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Icon className="size-3" /> {s.name}
      </p>
      <div className={cn("relative rounded-xl border bg-white p-3.5 shadow-e1 transition-shadow", selected ? "border-pax2-light-blue ring-2 ring-pax2-light-blue/30" : "border-slate-200 group-hover/node:shadow-e2")}>
        <Handle type="target" position={Position.Left} className={HANDLE} />
        <p className="text-xs leading-snug text-slate-600">{s.makes}</p>
        <p className="mt-2.5 text-[11px] text-slate-400">
          Runs on <span className="font-medium text-pax2-light-blue">{s.page}</span>
        </p>
        <Handle type="source" position={Position.Right} className={HANDLE} />
      </div>
      <div className="pointer-events-none absolute -bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-e2 transition-opacity group-hover/node:pointer-events-auto group-hover/node:opacity-100">
        <Link href={s.href} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue">
          <ExternalLink className="size-3.5" /> Open {s.page}
        </Link>
        <button type="button" aria-label={`Delete ${s.name}`} onClick={() => remove(id)} className="flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-pax2-red-soft hover:text-pax2-red-deep">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

const nodeTypes = { step: StepNode }

/** The steps ranked against a search: name first, then what the step makes, then its page. */
function matchSteps(q: string): StepKey[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return STEP_KEYS
  const rank = (k: StepKey) => {
    const s = STEP[k]
    if (s.name.toLowerCase().startsWith(needle)) return 0
    if (s.name.toLowerCase().includes(needle)) return 1
    if (s.makes.toLowerCase().includes(needle)) return 2
    if (s.page.toLowerCase().includes(needle)) return 3
    return 4
  }
  return STEP_KEYS.filter((k) => rank(k) < 4).sort((a, b) => rank(a) - rank(b))
}

function ZoomMenu() {
  const { zoomTo, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue"
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="tabular flex h-9 items-center gap-1 rounded-full px-3 text-sm text-slate-700 transition-colors hover:bg-slate-100">
        {Math.round(zoom * 100)}% <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-40 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-e3">
          <button type="button" role="menuitem" className={item} onClick={() => (fitView({ padding: 0.2, duration: 300 }), setOpen(false))}>
            <Maximize2 className="size-3.5 text-slate-400" /> Zoom to fit
          </button>
          {[0.5, 1, 1.5].map((z) => (
            <button key={z} type="button" role="menuitem" className={cn(item, "tabular")} onClick={() => (zoomTo(z, { duration: 200 }), setOpen(false))}>
              {z * 100}%
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Canvas({ id }: { id: string }) {
  const router = useRouter()
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [booted, setBooted] = React.useState(false)
  const [name, setName] = React.useState("Untitled Flow")
  const [renaming, setRenaming] = React.useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [tool, setTool] = React.useState<"select" | "pan">("select")
  const [menu, setMenu] = React.useState(false)
  const [palette, setPalette] = React.useState(false)
  const [paletteQ, setPaletteQ] = React.useState("")
  const [paletteCat, setPaletteCat] = React.useState<"All" | (typeof CATEGORIES)[number]>("All")
  const [quick, setQuick] = React.useState("")
  const [savedAt, setSavedAt] = React.useState<string | null>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const paletteRef = React.useRef<HTMLDivElement>(null)

  // Undo and redo hold the canvas's content; a snapshot lands before every structural change.
  const undoStack = React.useRef<Snap[]>([])
  const redoStack = React.useRef<Snap[]>([])
  const nodesRef = React.useRef(nodes)
  const edgesRef = React.useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges
  const snap = (): Snap => ({
    nodes: nodesRef.current.map((n) => ({ id: n.id, step: (n.data as { step: StepKey }).step, x: n.position.x, y: n.position.y })),
    edges: edgesRef.current.map((e) => ({ s: e.source, t: e.target })),
  })
  const mark = React.useCallback(() => {
    undoStack.current = [...undoStack.current.slice(-49), snap()]
    redoStack.current = []
  }, [])
  const apply = (s: Snap) => {
    setNodes(s.nodes.map((n) => ({ id: n.id, type: "step", position: { x: n.x, y: n.y }, data: { step: n.step } })))
    setEdges(s.edges.map((e) => edgeOf(e.s, e.t)))
  }
  const undo = React.useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(snap())
    apply(prev)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const redo = React.useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(snap())
    apply(next)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  // The saved flow loads after mount: localStorage is the browser's, so the server renders an
  // empty canvas and the client fills it without a hydration mismatch.
  const loaded = React.useRef(false)
  React.useEffect(() => {
    const f = readFlows().find((x) => x.id === id)
    if (f) {
      setName(f.name)
      setNodes(f.nodes.map((n) => ({ id: n.id, type: "step", position: { x: n.x, y: n.y }, data: { step: n.step } })))
      setEdges(f.edges.map((e) => edgeOf(e.s, e.t)))
      loaded.current = true
      setTimeout(() => fitView({ padding: 0.2 }), 60)
    }
    setBooted(true)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Everything saves itself, debounced; a brand-new empty canvas stays out of the list until it holds something.
  React.useEffect(() => {
    if (!booted) return
    if (!loaded.current && nodes.length === 0 && name === "Untitled Flow") return
    loaded.current = true
    const t = setTimeout(() => {
      saveFlow({
        id,
        name: name.trim() || "Untitled Flow",
        nodes: nodes.map((n) => ({ id: n.id, step: (n.data as { step: StepKey }).step, x: n.position.x, y: n.position.y })),
        edges: edges.map((e) => ({ s: e.source, t: e.target })),
        updatedAt: new Date().toISOString(),
      })
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
    }, 600)
    return () => clearTimeout(t)
  }, [booted, id, name, nodes, edges])

  React.useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) setMenu(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [menu])
  React.useEffect(() => {
    if (!palette) return
    const onDown = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as HTMLElement)) setPalette(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [palette])

  const addStep = (step: StepKey) => {
    mark()
    const nid = `n${Date.now()}`
    if (nodesRef.current.length === 0) {
      const p = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      setNodes([{ id: nid, type: "step", position: { x: p.x - NODE_W / 2, y: p.y - 56 }, data: { step } }])
    } else {
      const rightmost = nodesRef.current.reduce((m, n) => (n.position.x > m.position.x ? n : m))
      setNodes((ns) => [...ns, { id: nid, type: "step", position: { x: rightmost.position.x + NODE_W + 72, y: rightmost.position.y }, data: { step } }])
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
  }
  const quickAdd = (q: string) => {
    const best = matchSteps(q)[0]
    if (best) addStep(best)
    setQuick("")
  }
  const remove = React.useCallback(
    (nid: string) => {
      mark()
      setNodes((ns) => ns.filter((n) => n.id !== nid))
      setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid))
    },
    [mark, setNodes, setEdges],
  )
  const onConnect = React.useCallback(
    (c: Connection) => {
      mark()
      setEdges((eds) => addEdge({ ...c, ...EDGE }, eds))
    },
    [mark, setEdges],
  )
  const relayout = () => {
    mark()
    const pos = tidy(
      nodesRef.current.map((n) => ({ id: n.id })),
      edgesRef.current.map((e) => ({ s: e.source, t: e.target })),
    )
    setNodes((ns) => ns.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })))
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
  }
  const duplicate = () => {
    const copy: SavedFlow = {
      id: `f${Date.now()}`,
      name: `${name} (copy)`,
      nodes: nodes.map((n) => ({ id: n.id, step: (n.data as { step: StepKey }).step, x: n.position.x, y: n.position.y })),
      edges: edges.map((e) => ({ s: e.source, t: e.target })),
      updatedAt: new Date().toISOString(),
    }
    saveFlow(copy)
    router.push(`/flow/${copy.id}`)
  }

  const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue [&_svg]:size-3.5 [&_svg]:text-slate-400"
  const toolBtn = (on: boolean) => cn("flex size-9 items-center justify-center rounded-full transition-colors", on ? "bg-pax2-blue text-white" : "text-slate-600 hover:bg-slate-100")
  const paletteSteps = matchSteps(paletteQ).filter((k) => paletteCat === "All" || STEP[k].category === paletteCat)

  const paletteList = (
    <div ref={paletteRef} className="absolute bottom-20 left-1/2 z-40 w-[340px] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-e3">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input autoFocus value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} placeholder="Search steps…" aria-label="Search steps" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
      </div>
      <div className="flex gap-1.5 px-3 pt-2.5">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" onClick={() => setPaletteCat(c)} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors", paletteCat === c ? "bg-pax2-blue text-white" : "bg-slate-100 text-slate-600 hover:text-pax2-blue")}>
            {c}
          </button>
        ))}
      </div>
      <div className="no-scrollbar max-h-72 overflow-y-auto p-1.5">
        {paletteSteps.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-slate-500">No step matches.</p>
        ) : (
          paletteSteps.map((k) => {
            const s = STEP[k]
            const Icon = s.icon
            return (
              <button key={k} type="button" onClick={() => (addStep(k), setPalette(false), setPaletteQ(""))} className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-pax2-mist">
                <Icon className="mt-0.5 size-4 shrink-0 text-slate-400 transition-colors group-hover:text-pax2-blue" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{s.name}</span>
                  <span className="block truncate text-xs text-slate-500">{s.makes}</span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <CanvasCtx.Provider value={{ remove }}>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={mark}
          onBeforeDelete={async () => (mark(), true)}
          connectionLineStyle={EDGE.style}
          deleteKeyCode={["Backspace", "Delete"]}
          panOnDrag={tool === "pan" ? true : [1, 2]}
          selectionOnDrag={tool === "select"}
          selectionMode={SelectionMode.Partial}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          className="!bg-pax2-mist"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.25} color="#cbd5e1" />
        </ReactFlow>

        <div className="absolute left-4 top-4 z-40 flex items-center gap-2">
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} className={cn("flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 shadow-e1 transition-colors", menu && "bg-slate-50")}>
              <GitBranch className="size-4 text-slate-500" /> Flows <ChevronDown className="size-3.5 text-slate-400" />
            </button>
            {menu && (
              <div role="menu" className="absolute left-0 top-full z-40 mt-1.5 w-48 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-e3">
                <button type="button" role="menuitem" className={menuItem} onClick={() => router.push("/flow")}>
                  <ArrowLeft /> Back to home
                </button>
                <button type="button" role="menuitem" className={menuItem} onClick={() => router.push(`/flow/f${Date.now()}`)}>
                  <Plus /> New Flow
                </button>
                <button type="button" role="menuitem" className={menuItem} onClick={() => (setMenu(false), setRenaming(true))}>
                  <PencilLine /> Rename
                </button>
                <button type="button" role="menuitem" className={menuItem} onClick={duplicate}>
                  <Copy /> Duplicate
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" role="menuitem" className={menuItem} onClick={() => (undo(), setMenu(false))}>
                  <Undo2 /> Undo <kbd className="ml-auto text-[10px] text-slate-400">⌘Z</kbd>
                </button>
                <button type="button" role="menuitem" className={menuItem} onClick={() => (redo(), setMenu(false))}>
                  <Redo2 /> Redo <kbd className="ml-auto text-[10px] text-slate-400">⇧⌘Z</kbd>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" role="menuitem" className={cn(menuItem, "text-pax2-red-deep hover:text-pax2-red-deep [&_svg]:text-pax2-red-deep")} onClick={() => (deleteFlow(id), router.push("/flow"))}>
                  <Trash2 /> Delete Flow
                </button>
              </div>
            )}
          </div>
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setRenaming(false)}
              aria-label="Flow name"
              className="h-10 w-56 rounded-full border border-pax2-light-blue bg-white px-4 text-sm font-medium text-slate-900 shadow-e1 outline-none"
            />
          ) : (
            <button type="button" onClick={() => setRenaming(true)} title="Rename" className="flex h-10 max-w-64 items-center truncate rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-e1 transition-colors hover:bg-slate-50">
              {name}
            </button>
          )}
        </div>

        <div className="absolute right-4 top-4 z-40 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 shadow-e1">
          {savedAt && (
            <span className="flex items-center gap-1 pl-2.5 text-xs text-slate-400">
              <Check className="size-3" /> Saved {savedAt}
            </span>
          )}
          <button type="button" onClick={relayout} className="flex h-9 items-center rounded-full px-3 text-sm text-slate-700 transition-colors hover:bg-slate-100">
            Tidy up
          </button>
          <ZoomMenu />
        </div>

        {booted && nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="pointer-events-auto flex w-[440px] max-w-[90vw] flex-col items-center gap-4">
              <form
                className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white py-2 pl-4 pr-2 shadow-e3"
                onSubmit={(e) => (e.preventDefault(), quickAdd(quick))}
              >
                <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a first step: script, voice, score…" aria-label="Add a step" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                <button type="submit" aria-label="Add" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pax2-blue text-white transition-opacity disabled:opacity-40" disabled={!matchSteps(quick).length || !quick.trim()}>
                  <ArrowUp className="size-4" />
                </button>
              </form>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-xs text-slate-400">or start from</span>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      mark()
                      const seeded = t.steps.map((step, i) => ({ id: `n${i}`, step, x: 0, y: 0 }))
                      const es = t.steps.slice(1).map((_, i) => ({ s: `n${i}`, t: `n${i + 1}` }))
                      const pos = tidy(seeded, es)
                      setNodes(seeded.map((n) => ({ id: n.id, type: "step", position: pos.get(n.id)!, data: { step: n.step } })))
                      setEdges(es.map((e) => edgeOf(e.s, e.t)))
                      if (name === "Untitled Flow") setName(t.name)
                      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
                    }}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-e1 transition-shadow hover:text-pax2-blue hover:shadow-e2"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {palette && paletteList}

        <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1 shadow-e2">
            <button type="button" aria-label="Select" aria-pressed={tool === "select"} onClick={() => setTool("select")} className={toolBtn(tool === "select")}>
              <MousePointer2 className="size-4" />
            </button>
            <button type="button" aria-label="Pan" aria-pressed={tool === "pan"} onClick={() => setTool("pan")} className={toolBtn(tool === "pan")}>
              <Hand className="size-4" />
            </button>
            <button type="button" aria-label="Add a step" aria-expanded={palette} onClick={() => setPalette((v) => !v)} className={toolBtn(palette)}>
              <Plus className="size-4" />
            </button>
          </div>
          {nodes.length > 0 && (
            <form
              className="flex w-[clamp(180px,40vw,300px)] items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-4 pr-1 shadow-e2"
              onSubmit={(e) => (e.preventDefault(), quickAdd(quick))}
            >
              <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a step…" aria-label="Add a step" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              <button type="submit" aria-label="Add" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pax2-blue text-white transition-opacity disabled:opacity-40" disabled={!matchSteps(quick).length || !quick.trim()}>
                <ArrowUp className="size-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </CanvasCtx.Provider>
  )
}

export function FlowCanvas({ id }: { id: string }) {
  return (
    <ReactFlowProvider>
      <Canvas id={id} />
    </ReactFlowProvider>
  )
}
