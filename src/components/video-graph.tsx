"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background, Controls, Handle, Panel, Position, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react"
import dagre from "@dagrejs/dagre"
import { toast } from "sonner"
import {
  ArrowLeft, Boxes, ChevronRight, Clapperboard, Crosshair, ExternalLink, GripVertical, Hash, MoreHorizontal, Plus, Search, Tv, Users, X,
} from "lucide-react"

import { setDragEntity } from "@/lib/drag-entity"
import { similarTo, type GraphChannel, type GraphData, type GraphVideo } from "@/lib/graph-data"
import { fmtCompact } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

export type { GraphChannel, GraphData, GraphVideo } from "@/lib/graph-data"

// The connections canvas, on NSR's /graph workspace: a catalog rail on the left, typed entity
// cards on a dagre-laid canvas, paged "+N more" supernodes for honest overflow, a detail panel on
// the right, and a receipt for every edge saying which record joins the two. Every data edge is a
// relation PAX2 holds: channel-published-video, the uploader's tags, YouTube's topic annotations,
// channel groups. The one inference, "similar", is drawn dashed and says so.

type GType = "channel" | "video" | "tag" | "topic" | "group" | "more"
type GNode = {
  type: GType
  id: string
  label: string
  sub?: string
  tier?: GraphVideo["tier"]
  parentKey?: string
  rel?: string
  /** Card row groups unfolded (collapsed by default). */
  openGroups?: string[]
  /** Similarity to the anchor that pulled this card in; rides onto the edge. */
  score?: number
}
/** Edge provenance. Absent kind = a record PAX2 holds. */
type EdgeMeta = { kind?: "similar"; score?: number }
const edgeKind = (e: Edge) => (e.data as EdgeMeta | undefined)?.kind
const keyOf = (n: { type: string; id: string }) => `${n.type}:${n.id}`
const rx = (r: number) => `${(r >= 10 ? r.toFixed(0) : r.toFixed(1)).replace(/^0\./, ".")}x`
const TIER_COLOR = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" } as const
const BLUE = "#2563eb" // pax2-light-blue

const NODE_W: Record<GType, number> = { channel: 210, video: 240, tag: 150, topic: 160, group: 170, more: 130 }
const PAGE = 8

/* ── relations, computed from the dataset we ship ────────────────────────── */

function useRelations(data: GraphData) {
  return useMemo(() => {
    const byChannel = new Map<string, GraphVideo[]>()
    const byTag = new Map<string, GraphVideo[]>()
    const byTopic = new Map<string, GraphVideo[]>()
    const byGroup = new Map<string, GraphChannel[]>()
    const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]) }
    for (const v of data.videos) {
      push(byChannel, v.channelId, v)
      for (const t of v.tags) push(byTag, t.toLowerCase(), v)
      for (const t of v.topics) push(byTopic, t, v)
    }
    for (const vs of byChannel.values()) vs.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    for (const c of data.channels) push(byGroup, c.group, c)
    const channelTopics = new Map<string, Map<string, number>>()
    for (const v of data.videos) {
      const m = channelTopics.get(v.channelId) ?? new Map<string, number>()
      for (const t of v.topics) m.set(t, (m.get(t) ?? 0) + 1)
      channelTopics.set(v.channelId, m)
    }
    return { byChannel, byTag, byTopic, byGroup, channelTopics, channel: new Map(data.channels.map((c) => [c.id, c])), video: new Map(data.videos.map((v) => [v.id, v])) }
  }, [data])
}

type Rels = ReturnType<typeof useRelations>

const videoNode = (v: GraphVideo): GNode => ({ type: "video", id: v.id, label: v.title, tier: v.tier, sub: `${v.ratio != null ? `${rx(v.ratio)} · ` : ""}${fmtCompact(v.views)} views` })
const channelNode = (c: GraphChannel): GNode => ({ type: "channel", id: c.id, label: c.name, sub: `${c.group} · ${c.subs != null ? `${fmtCompact(c.subs)} subs · ` : ""}${c.n} tracked · ${c.pushed} above 3x` })
const tagNode = (t: string, n: number): GNode => ({ type: "tag", id: t.toLowerCase(), label: t, sub: `${n} videos` })
const topicNode = (t: string, n: number): GNode => ({ type: "topic", id: t, label: t, sub: `${n} videos` })
const groupNode = (g: string, n: number): GNode => ({ type: "group", id: g, label: g, sub: `${n} channels` })
const tagOf = (t: string, R: Rels) => tagNode(t, R.byTag.get(t.toLowerCase())?.length ?? 0)
const topicOf = (t: string, R: Rels) => topicNode(t, R.byTopic.get(t)?.length ?? 0)
const groupOf = (g: string, R: Rels) => groupNode(g, R.byGroup.get(g)?.length ?? 0)

/** What this node can pull onto the canvas, and the full result list for each relation. */
function relationsOf(g: GNode, R: Rels): { rel: string; label: string; items: GNode[] }[] {
  if (g.type === "channel") {
    const vs = R.byChannel.get(g.id) ?? []
    const topics = [...(R.channelTopics.get(g.id) ?? new Map())].sort((a, b) => b[1] - a[1])
    const c = R.channel.get(g.id)
    return [
      { rel: "videos", label: "videos", items: vs.map(videoNode) },
      { rel: "topics", label: "topics", items: topics.map(([t]) => topicOf(t, R)) },
      ...(c ? [{ rel: "group", label: "group", items: [groupOf(c.group, R)] }] : []),
    ]
  }
  if (g.type === "video") {
    const v = R.video.get(g.id)
    if (!v) return []
    const c = R.channel.get(v.channelId)
    return [
      ...(c ? [{ rel: "channel", label: "channel", items: [channelNode(c)] }] : []),
      { rel: "tags", label: "tags", items: v.tags.map((t) => tagOf(t, R)) },
      { rel: "topics", label: "topics", items: v.topics.map((t) => topicOf(t, R)) },
    ]
  }
  if (g.type === "tag") return [{ rel: "videos", label: "videos", items: [...(R.byTag.get(g.id) ?? [])].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).map(videoNode) }]
  if (g.type === "topic") {
    const vs = R.byTopic.get(g.id) ?? []
    const chIds = [...new Set(vs.map((v) => v.channelId))]
    return [
      { rel: "videos", label: "videos", items: [...vs].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).map(videoNode) },
      { rel: "channels", label: "channels", items: chIds.map((id) => R.channel.get(id)).filter((c): c is GraphChannel => !!c).map(channelNode) },
    ]
  }
  if (g.type === "group") return [{ rel: "channels", label: "channels", items: (R.byGroup.get(g.id) ?? []).map(channelNode) }]
  return []
}

/** Relation sizes without building the items: what a card's chips need on every render. */
function relCounts(g: GNode, R: Rels): Record<string, number> {
  if (g.type === "channel") return { videos: R.byChannel.get(g.id)?.length ?? 0, topics: R.channelTopics.get(g.id)?.size ?? 0, group: R.channel.has(g.id) ? 1 : 0 }
  if (g.type === "video") { const v = R.video.get(g.id); return { channel: v && R.channel.has(v.channelId) ? 1 : 0, tags: v?.tags.length ?? 0, topics: v?.topics.length ?? 0 } }
  if (g.type === "tag") return { videos: R.byTag.get(g.id)?.length ?? 0 }
  if (g.type === "topic") { const vs = R.byTopic.get(g.id) ?? []; return { videos: vs.length, channels: new Set(vs.map((v) => v.channelId)).size } }
  if (g.type === "group") return { channels: R.byGroup.get(g.id)?.length ?? 0 }
  return {}
}

/** The rows a card carries inside it, column-lineage style. Video: tags and topics. Channel: top videos. */
type RowGroup = { key: string; label: string; rel: string; items: GNode[] }
function cardGroups(g: GNode, R: Rels): RowGroup[] {
  if (g.type === "video") {
    const v = R.video.get(g.id)
    if (!v) return []
    return [
      { key: "tags", label: "tags", rel: "tags", items: v.tags.map((t) => tagOf(t, R)) },
      { key: "topics", label: "topics", rel: "topics", items: v.topics.map((t) => topicOf(t, R)) },
    ].filter((x) => x.items.length)
  }
  if (g.type === "channel") {
    const top = (R.byChannel.get(g.id) ?? []).slice(0, 4).map(videoNode)
    return top.length ? [{ key: "top", label: "top videos", rel: "videos", items: top }] : []
  }
  return []
}
/** Relations a card's group headers already cover; the chip row offers the rest. */
const GROUPED: Partial<Record<GType, string[]>> = { video: ["tags", "topics"], channel: ["videos"] }

/** Is there a direct record joining these two nodes? */
function related(a: GNode, b: GNode, R: Rels): boolean {
  const [x, y] = a.type <= b.type ? [a, b] : [b, a]
  const v = (n: GNode) => R.video.get(n.id)
  if (x.type === "channel" && y.type === "video") return v(y)?.channelId === x.id
  if (x.type === "tag" && y.type === "video") return v(y)?.tags.some((t) => t.toLowerCase() === x.id) ?? false
  if (x.type === "topic" && y.type === "video") return v(y)?.topics.includes(x.id) ?? false
  if (x.type === "channel" && y.type === "topic") return (R.channelTopics.get(x.id)?.get(y.id) ?? 0) > 0
  if (x.type === "channel" && y.type === "group") return R.channel.get(x.id)?.group === y.id
  return false
}

/** The record behind an edge. Every data edge is one PAX2 holds, named plainly. */
function receipt(a: GNode, b: GNode, meta?: EdgeMeta): { text: string; record: boolean } {
  if (meta?.kind === "similar") return { text: "Computed from shared tags and topics. Not a record.", record: false }
  const pair = (t1: GType, t2: GType) => (a.type === t1 && b.type === t2) || (a.type === t2 && b.type === t1)
  const of = (t: GType) => (a.type === t ? a : b)
  if (pair("channel", "video")) return { text: `${of("channel").label} published ${of("video").label}, the poller's own record.`, record: true }
  if (pair("video", "tag")) return { text: `The uploader tagged ${of("video").label} "${of("tag").label}", from the video's metadata.`, record: true }
  if (pair("video", "topic")) return { text: `YouTube annotates ${of("video").label} with the topic ${of("topic").label}.`, record: true }
  if (pair("channel", "topic")) return { text: `${of("channel").label}'s tracked videos carry the topic ${of("topic").label}.`, record: true }
  if (pair("channel", "group")) return { text: `${of("channel").label} sits in the ${of("group").label} group of channels.json.`, record: true }
  if (a.type === "more" || b.type === "more") return { text: "Overflow marker: the remainder of a paged expansion. Click it to load the next page.", record: false }
  return { text: "Relation from the tracked dataset.", record: true }
}

/* ── layout ──────────────────────────────────────────────────────────────── */

/** Card heights vary with their unfolded rows; dagre must see the truth. */
function nodeHeight(g: GNode, R: Rels): number {
  if (g.type === "more") return 40
  let h = g.type === "video" ? 88 : g.type === "channel" ? 80 : 66
  for (const grp of cardGroups(g, R)) {
    h += 22
    if (g.openGroups?.includes(grp.key)) h += grp.items.length * 18
  }
  return h
}

type LayoutMode = "none" | "dagre-lr" | "dagre-tb"

function layout(nodes: Node[], edges: Edge[], R: Rels, rankdir: "LR" | "TB"): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir, nodesep: 22, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) {
    const d = n.data as GNode
    g.setNode(n.id, { width: NODE_W[d.type] ?? 160, height: nodeHeight(d, R) })
  }
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target)
  dagre.layout(g)
  return nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } }
  })
}

/* ── node card ───────────────────────────────────────────────────────────── */

type CardData = GNode & {
  chips: { rel: string; label: string; total: number }[]
  groups: { key: string; label: string; rel: string; total: number; items: GNode[] }[]
  expanded: Record<string, { loaded: number; total: number }>
  dimmed: boolean
  onExpand: (node: GNode, rel: string) => void
  onMore: (parentKey: string, rel: string) => void
  onRow: (from: GNode, item: GNode) => void
  onToggleGroup: (key: string, group: string) => void
  onSimilar: (node: GNode) => void
} & Record<string, unknown>

const CARD = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-e1"
const ICON: Record<string, React.ElementType> = { channel: Tv, video: Clapperboard, tag: Hash, topic: Boxes, group: Users }
const CHIP = "rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
const HANDLE = "!h-2 !w-2 !border-0 !bg-slate-300"

function EntityNode({ data: d, selected }: NodeProps<Node<CardData>>) {
  if (d.type === "more")
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (d.parentKey && d.rel) d.onMore(d.parentKey, d.rel) }}
        className={cn("flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500 transition-[colors,opacity] hover:bg-slate-100 hover:text-slate-900", d.dimmed && "opacity-30")}
        style={{ width: NODE_W.more, height: 40 }}
        title="Load the next page"
      >
        <Handle type="target" position={Position.Left} className={HANDLE} />
        {d.label}
      </button>
    )
  const Icon = ICON[d.type]
  return (
    <div
      className={cn(CARD, "group/card relative transition-opacity", selected && "border-pax2-light-blue ring-1 ring-pax2-light-blue", d.dimmed && "opacity-30")}
      style={{ width: NODE_W[d.type], borderLeftWidth: d.type === "video" ? 3 : undefined, borderLeftColor: d.type === "video" && d.tier ? TIER_COLOR[d.tier] : undefined }}
    >
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <Handle type="source" position={Position.Right} className={HANDLE} />
      {/* nodrag keeps React Flow's pointer drag off the grip, so the native drag fires */}
      <span
        draggable
        onDragStart={(e) => { e.stopPropagation(); setDragEntity(e.dataTransfer, d) }}
        className="nodrag absolute right-1 top-1 hidden cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 group-hover/card:block"
        title="Drag onto the canvas or into the chat"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <p className="flex items-start gap-1.5 pr-3">
        <Icon className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
        <span className="line-clamp-2 font-semibold leading-snug text-slate-900">{d.label}</span>
      </p>
      {d.sub && <p className="tabular mt-0.5 truncate text-[10px] text-slate-500">{d.sub}</p>}

      {d.groups.map((grp) => {
        const open = !!d.openGroups?.includes(grp.key)
        const st = d.expanded[grp.rel]
        return (
          <div key={grp.key} className="mt-1.5 border-t border-slate-100 pt-1">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-slate-400">
              <button onClick={(e) => { e.stopPropagation(); d.onToggleGroup(keyOf(d), grp.key) }} className="flex items-center gap-0.5 transition-colors hover:text-slate-900">
                <ChevronRight className={cn("h-2.5 w-2.5 transition-transform", open && "rotate-90")} />
                {grp.label}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); d.onExpand(d, grp.rel) }}
                className="tabular rounded px-1 transition-colors hover:bg-slate-100 hover:text-slate-900"
                title={st ? `${st.loaded} of ${st.total} on the canvas` : `Pull ${grp.rel} onto the canvas`}
              >
                {st ? `${st.loaded}/${st.total}` : grp.total.toLocaleString()}
              </button>
            </div>
            {open && grp.items.map((it) => (
              <button
                key={keyOf(it)}
                onClick={(e) => { e.stopPropagation(); d.onRow(d, it) }}
                className="flex h-[18px] w-full items-center justify-between gap-1 rounded px-1 text-left text-[10px] text-slate-700 transition-colors hover:bg-slate-100"
              >
                <span className="truncate">{it.label}</span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.tier ? TIER_COLOR[it.tier] : "#cbd5e1" }} />
              </button>
            ))}
          </div>
        )
      })}

      <div className="mt-1.5 flex flex-wrap gap-1">
        {d.chips.map(({ rel, label, total }) => {
          const st = d.expanded[rel]
          return (
            <button key={rel} onClick={(e) => { e.stopPropagation(); d.onExpand(d, rel) }} className={CHIP} title={st ? `${st.loaded} of ${st.total} on the canvas` : `Expand ${label}`}>
              {st ? `${label} ${st.loaded}/${st.total}` : `+ ${label} ${total}`}
            </button>
          )
        })}
        {d.type === "video" && (
          <button onClick={(e) => { e.stopPropagation(); d.onSimilar(d) }} className={cn(CHIP, "border-dashed")} title="Videos sharing the most tags and topics, drawn dashed">
            {d.expanded.similar ? `similar ${d.expanded.similar.loaded}` : "≈ similar"}
          </button>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { entity: EntityNode }

/* ── rail ────────────────────────────────────────────────────────────────── */

const RAIL_TYPES = [
  { key: "channels", label: "Channels", icon: Tv },
  { key: "videos", label: "Videos", icon: Clapperboard },
  { key: "tags", label: "Tags", icon: Hash },
  { key: "topics", label: "Topics", icon: Boxes },
  { key: "groups", label: "Groups", icon: Users },
] as const

function railItems(key: string, R: Rels): GNode[] {
  if (key === "channels") return [...R.channel.values()].sort((a, b) => b.pushed - a.pushed || b.n - a.n).map(channelNode)
  if (key === "videos") return [...R.video.values()].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).map(videoNode)
  if (key === "tags") return [...R.byTag.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, vs]) => tagNode(vs[0]?.tags.find((x) => x.toLowerCase() === t) ?? t, vs.length))
  if (key === "topics") return [...R.byTopic.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, vs]) => topicNode(t, vs.length))
  return [...R.byGroup.entries()].sort((a, b) => b[1].length - a[1].length).map(([g, cs]) => groupNode(g, cs.length))
}

/** Hover ⋯ on a rail row: Center, Add, Ask in chat. */
function RowMenu({ g, onPick, onAdd, onAsk }: { g: GNode; onPick: (g: GNode) => void; onAdd: (g: GNode) => void; onAsk?: (g: GNode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])
  const item = "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-pax2-blue"
  return (
    <div ref={ref} className={cn("absolute right-1.5 top-1.5", !open && "hidden group-hover/row:block")}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="More">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg bg-white py-1 shadow-e2 ring-1 ring-slate-200">
          <button className={item} onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(g) }}><Crosshair className="h-3.5 w-3.5" /> Center on canvas</button>
          <button className={item} onClick={(e) => { e.stopPropagation(); setOpen(false); onAdd(g) }}><Plus className="h-3.5 w-3.5" /> Add to canvas</button>
          {onAsk && <button className={item} onClick={(e) => { e.stopPropagation(); setOpen(false); onAsk(g) }}><Hash className="h-3.5 w-3.5" /> Ask in chat</button>}
        </div>
      )}
    </div>
  )
}

const RAIL = "hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex"
const RAIL_ROW = "flex items-center gap-2 px-3 py-1.5 text-sm text-slate-900 transition-colors hover:bg-slate-50"

function RailHeader({ label, count, onBack }: { label: string; count?: number; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 p-3">
      <button onClick={onBack} className="text-slate-400 hover:text-slate-900" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      {count != null && <span className="tabular ml-auto text-xs text-slate-400">{count.toLocaleString()}</span>}
    </div>
  )
}

function RailFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="border-b border-slate-200 p-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Filter…" className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-pax2-light-blue" />
    </div>
  )
}

function RecordRail({ R, onPick, onAdd, onAsk }: { R: Rels; onPick: (g: GNode) => void; onAdd: (g: GNode) => void; onAsk?: (g: GNode) => void }) {
  const [browse, setBrowse] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const back = () => { setBrowse(null); setFilter("") }
  if (browse) {
    const all = railItems(browse, R)
    const f = filter.trim().toLowerCase()
    return (
      <div className={RAIL}>
        <RailHeader label={RAIL_TYPES.find((t) => t.key === browse)?.label ?? ""} count={all.length} onBack={back} />
        <RailFilter value={filter} onChange={setFilter} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {all.filter((g) => !f || `${g.label} ${g.sub ?? ""}`.toLowerCase().includes(f)).slice(0, 200).map((g) => (
            <div key={keyOf(g)} className="group/row relative border-b border-slate-100">
              <button
                onClick={() => onPick(g)}
                draggable
                onDragStart={(e) => setDragEntity(e.dataTransfer, g)}
                className="flex w-full flex-col gap-0.5 px-3 py-2 pr-7 text-left transition-colors hover:bg-slate-50"
              >
                <span className="line-clamp-2 text-xs font-semibold text-slate-900">{g.label}</span>
                {g.sub && <span className="tabular text-[10px] text-slate-500">{g.sub}</span>}
              </button>
              <RowMenu g={g} onPick={onPick} onAdd={onAdd} onAsk={onAsk} />
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={RAIL}>
      <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-wide text-slate-400">Tracked</p>
      {RAIL_TYPES.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => setBrowse(key)} className={RAIL_ROW}>
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          <span>{label}</span>
          <span className="tabular ml-auto text-xs text-slate-400">{railItems(key, R).length.toLocaleString()}</span>
        </button>
      ))}
    </div>
  )
}

/* ── detail panel ────────────────────────────────────────────────────────── */

const SIDE = "hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 md:block"
const BADGE = "rounded-full bg-pax2-lavender px-2 py-0.5 text-[10px] font-semibold text-pax2-blue"
const SECONDARY = "h-7 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-pax2-blue transition-colors hover:border-pax2-blue hover:bg-slate-50"

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  if (v === null || v === undefined || v === "") return null
  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
      <div className="tabular text-xs text-slate-900">{v}</div>
    </div>
  )
}

function Chips({ items, onPick }: { items: GNode[]; onPick: (g: GNode) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((it) => (
        <button key={keyOf(it)} onClick={() => onPick(it)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 transition-colors hover:bg-pax2-lavender hover:text-pax2-blue">{it.label}</button>
      ))}
    </div>
  )
}

const num = (x: number | null | undefined) => (x == null ? null : x.toLocaleString("en-US"))
const secs = (s: number | null) => (s == null ? null : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`)

function DetailBody({ g, R, data, onCanvas, onWired }: { g: GNode; R: Rels; data: GraphData; onCanvas: (g: GNode, rel: string) => void; onWired: (from: GNode, item: GNode) => void }) {
  if (g.type === "video") {
    const v = R.video.get(g.id)
    if (!v) return null
    return (
      <div>
        <Field k="Channel" v={v.channel} />
        <Field k="Published" v={new Date(v.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
        <Field k="Length" v={secs(v.durationSec)} />
        <Field k="Views" v={num(v.views)} />
        <Field k="Likes" v={num(v.likes)} />
        <Field k="Comments" v={num(v.comments)} />
        <Field k="Ratio" v={<span className="flex items-center gap-2">{v.ratio != null ? rx(v.ratio) : "none"}<span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: TIER_COLOR[v.tier] }}>{v.tier}</span></span>} />
        {v.tags.length > 0 && <Field k="Tags" v={<Chips items={v.tags.map((t) => tagOf(t, R))} onPick={(it) => onWired(g, it)} />} />}
        {v.topics.length > 0 && <Field k="Topics" v={<Chips items={v.topics.map((t) => topicOf(t, R))} onPick={(it) => onWired(g, it)} />} />}
        <div className="mt-4 rounded-lg border border-slate-200 bg-pax2-mist p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Provenance</p>
          <Field k="Source" v="YouTube Data API, read by the poller" />
          <Field k="Catalog fetched" v={data.start} />
          <Field k="Readings" v={num(data.readings)} />
        </div>
      </div>
    )
  }
  if (g.type === "channel") {
    const c = R.channel.get(g.id)
    if (!c) return null
    return (
      <div>
        <Field k="Group" v={c.group} />
        <Field k="Subscribers" v={num(c.subs)} />
        <Field k="Median views" v={num(c.median)} />
        <Field k="Tracked" v={num(c.n)} />
        <Field k="Above 3x" v={num(c.pushed)} />
        <Field k="Killed" v={num(c.killed)} />
        <div className="mt-3 flex items-center gap-3">
          <button className={SECONDARY} onClick={() => onCanvas(g, "videos")}>Videos on canvas</button>
          <a href="/campaigns" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-pax2-blue">Campaigns <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    )
  }
  if (g.type === "tag" || g.type === "topic") {
    const n = (g.type === "tag" ? R.byTag : R.byTopic).get(g.id)?.length ?? 0
    return (
      <div>
        <Field k="Videos" v={num(n)} />
        <button className={cn(SECONDARY, "mt-3")} onClick={() => onCanvas(g, "videos")}>Videos on canvas</button>
      </div>
    )
  }
  if (g.type === "group") {
    return (
      <div>
        <Field k="Channels" v={num(R.byGroup.get(g.id)?.length ?? 0)} />
        <button className={cn(SECONDARY, "mt-3")} onClick={() => onCanvas(g, "channels")}>Channels on canvas</button>
      </div>
    )
  }
  return null
}

function SideHeader({ badge, onClose }: { badge: string; onClose: () => void }) {
  return (
    <div className="mb-2 flex items-start justify-between">
      <span className={BADGE}>{badge}</span>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-900" aria-label="Close"><X className="h-4 w-4" /></button>
    </div>
  )
}

/* ── the canvas ──────────────────────────────────────────────────────────── */

type Props = { data: GraphData; email: string | null; admin: boolean; boot: { view?: string; center?: string } }

function VideoGraphInner({ data, boot }: Props) {
  const R = useRelations(data)
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])
  const store = useRef(new Map<string, GNode>())
  const expandState = useRef(new Map<string, { loaded: number; total: number }>())
  // The edge list's source of truth between renders: several mutations can land in one tick.
  const edgesRef = useRef<Edge[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [edgeInfo, setEdgeInfo] = useState<{ source: GNode; target: GNode; meta?: EdgeMeta } | null>(null)
  const [q, setQ] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [visible, setVisible] = useState(15)
  const [joinKinds, setJoinKinds] = useState<Record<string, boolean>>({ channel: true, group: true, topic: true, tag: true })
  const layoutModeRef = useRef<LayoutMode>("dagre-lr")

  const fit = useCallback(() => setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60), [fitView])

  const syncNodes = useCallback((allEdges: Edge[], relayout: boolean) => {
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      const mode = layoutModeRef.current
      // "none": nothing moves; new nodes land beside their edge source, stacked
      const fresh = new Map<string, number>()
      let next: Node[] = [...store.current.values()].map((g) => {
        const k = keyOf(g)
        let position = prevPos.get(k)
        if (!position && mode === "none") {
          const e = allEdges.find((x) => x.target === k) ?? allEdges.find((x) => x.source === k)
          const anchor = e ? (e.source === k ? e.target : e.source) : null
          const src = anchor ? prevPos.get(anchor) : undefined
          if (src && anchor) {
            const i = fresh.get(anchor) ?? 0
            fresh.set(anchor, i + 1)
            position = { x: src.x + (NODE_W[store.current.get(anchor)?.type ?? "video"] ?? 160) + 70, y: src.y + i * 96 }
          }
        }
        return { id: k, type: "entity", position: position ?? { x: 0, y: 0 }, data: { ...g } }
      })
      if (relayout && mode !== "none") next = layout(next, allEdges, R, mode === "dagre-tb" ? "TB" : "LR")
      return next
    })
  }, [setNodes, R])

  const commitEdges = useCallback((all: Edge[], relayout: boolean) => {
    edgesRef.current = all
    setEdges(all)
    syncNodes(all, relayout)
  }, [setEdges, syncNodes])

  const addNodes = useCallback((items: GNode[], from?: string, opts: { relayout?: boolean; kind?: EdgeMeta["kind"]; at?: { x: number; y: number } } = {}) => {
    const { relayout = true, kind, at } = opts
    for (const it of items) store.current.set(keyOf(it), { ...store.current.get(keyOf(it)), ...it })
    // an explicit drop point wins over layout: seed the position so syncNodes sees it placed
    if (at) setNodes((prev) => [
      ...prev.filter((n) => !items.some((it) => keyOf(it) === n.id)),
      ...items.map((it, i) => ({ id: keyOf(it), type: "entity", position: { x: at.x, y: at.y + i * 96 }, data: { ...it } })),
    ])
    const prev = edgesRef.current
    const have = new Set(prev.map((e) => e.id))
    const added: Edge[] = from
      ? items
          .filter((it) => keyOf(it) !== from && !have.has(`${from}->${keyOf(it)}`) && !have.has(`${keyOf(it)}->${from}`))
          .map((it) => kind === "similar"
            ? { id: `${from}->${keyOf(it)}`, source: from, target: keyOf(it), data: { kind, score: it.score } as EdgeMeta, label: it.score != null ? it.score.toFixed(2) : undefined }
            : { id: `${from}->${keyOf(it)}`, source: from, target: keyOf(it) })
      : []
    commitEdges([...prev, ...added], relayout)
    if (relayout) fit()
  }, [setNodes, commitEdges, fit])

  const patchNode = useCallback((key: string, patch: Partial<GNode>) => {
    const g = store.current.get(key)
    if (!g) return
    store.current.set(key, { ...g, ...patch })
    setNodes((prev) => prev.map((n) => (n.id === key ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [setNodes])

  const removeNode = useCallback((key: string) => {
    if (!store.current.delete(key)) return
    commitEdges(edgesRef.current.filter((e) => e.source !== key && e.target !== key), true)
  }, [commitEdges])

  const toggleGroup = useCallback((key: string, group: string) => {
    const g = store.current.get(key)
    if (!g) return
    const cur = g.openGroups ?? []
    patchNode(key, { openGroups: cur.includes(group) ? cur.filter((x) => x !== group) : [...cur, group] })
    // the card's height changed; dagre must see it
    syncNodes(edgesRef.current, true)
  }, [patchNode, syncNodes])

  const expand = useCallback((node: GNode, rel: string) => {
    const r = relationsOf(node, R).find((x) => x.rel === rel)
    if (!r) return
    const k = `${keyOf(node)}|${rel}`
    const st = expandState.current.get(k)
    const offset = st?.loaded ?? 0
    if (st && st.loaded >= st.total) { toast.info("All loaded"); return }
    const page = r.items.slice(offset, offset + PAGE)
    const loaded = offset + page.length
    expandState.current.set(k, { loaded, total: r.items.length })
    const moreKey = `more:${k}`
    if (loaded < r.items.length) {
      addNodes([...page, { type: "more", id: k, label: `+${(r.items.length - loaded).toLocaleString()} more`, parentKey: keyOf(node), rel }], keyOf(node))
    } else {
      addNodes(page, keyOf(node))
      if (store.current.has(moreKey)) removeNode(moreKey)
    }
  }, [R, addNodes, removeNode])

  /** Nearest videos by shared tags and topics: inference edges, drawn dashed. */
  const similar = useCallback((node: GNode) => {
    const k = `${keyOf(node)}|similar`
    if (expandState.current.has(k)) { toast.info("Similar videos are already on the canvas"); return }
    const v = R.video.get(node.id)
    if (!v) return
    const sims = similarTo(v, data.videos)
    if (!sims.length) { toast.info("No video shares a tag or topic with this one"); return }
    const items = sims.map((s) => ({ ...videoNode(R.video.get(s.id)!), score: s.score }))
    expandState.current.set(k, { loaded: items.length, total: items.length })
    addNodes(items, keyOf(node), { kind: "similar" })
  }, [R, data.videos, addNodes])

  /** Selecting a card surfaces its joins: every missing edge to a card already on the canvas,
   *  and any channel, group, topic or tag that connects it to at least one other card. Those
   *  connector cards are added and wired to everything they join. The chips filter which kinds. */
  const surfaceJoins = useCallback((key: string) => {
    const g = store.current.get(key)
    if (!g || g.type === "more") return
    const canvas = [...store.current.values()].filter((n) => keyOf(n) !== key && n.type !== "more")

    const connectors: GNode[] = []
    if (g.type === "video") {
      const v = R.video.get(g.id)
      if (v) {
        const c = R.channel.get(v.channelId)
        if (c && joinKinds.channel) connectors.push(channelNode(c))
        if (c && joinKinds.group) connectors.push(groupOf(c.group, R))
        if (joinKinds.tag) for (const t of v.tags) connectors.push(tagOf(t, R))
        if (joinKinds.topic) for (const t of v.topics) connectors.push(topicOf(t, R))
      }
    }
    if (g.type === "channel") {
      const c = R.channel.get(g.id)
      if (c && joinKinds.group) connectors.push(groupOf(c.group, R))
      if (joinKinds.topic) for (const [t] of R.channelTopics.get(g.id) ?? []) connectors.push(topicOf(t, R))
    }

    const added: GNode[] = []
    const wires: [string, string][] = []
    for (const n of canvas) if (related(g, n, R)) wires.push([key, keyOf(n)])
    for (const a of connectors) {
      if (store.current.has(keyOf(a))) continue
      const others = canvas.filter((n) => related(a, n, R))
      if (!others.length) continue
      added.push(a)
      wires.push([keyOf(a), key])
      for (const n of others) wires.push([keyOf(a), keyOf(n)])
    }
    const prev = edgesRef.current
    const have = new Set(prev.map((e) => e.id))
    const fresh = wires
      .filter(([f, t]) => !have.has(`${f}->${t}`) && !have.has(`${t}->${f}`))
      .map(([f, t]) => ({ id: `${f}->${t}`, source: f, target: t }))
    if (!fresh.length && !added.length) return
    for (const a of added) store.current.set(keyOf(a), a)
    commitEdges([...prev, ...fresh], true)
    fit()
  }, [R, joinKinds, commitEdges, fit])

  /** Replace the canvas with one entity, arriving with its first relation expanded. */
  const center = useCallback((g: GNode) => {
    store.current = new Map([[keyOf(g), g]])
    expandState.current = new Map()
    edgesRef.current = []
    setEdges([])
    setNodes([{ id: keyOf(g), type: "entity", position: { x: 0, y: 0 }, data: { ...g } }])
    setSelectedKey(keyOf(g))
    setEdgeInfo(null)
    setQ("")
    const first = relationsOf(g, R)[0]
    if (first) expand(g, first.rel)
    else fit()
  }, [R, setEdges, setNodes, expand, fit])

  const addToCanvas = useCallback((g: GNode) => {
    if (store.current.has(keyOf(g))) { toast.info(`${g.label} is already on the canvas`); return }
    addNodes([g])
  }, [addNodes])

  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const c = boot.center
    if (c?.includes(":")) {
      const [type, ...rest] = c.split(":")
      const id = rest.join(":")
      const found = [...railItems(`${type}s`, R)].find((x) => x.id === id || x.id === id.toLowerCase())
      if (found) { center(found); return }
    }
    const top = [...R.channel.values()].sort((a, b) => b.pushed - a.pushed)[0]
    if (top) center(channelNode(top))
  }, [boot, R, center])

  /* ── search ── */
  const everything = useMemo(() => [...railItems("channels", R), ...railItems("videos", R), ...railItems("tags", R), ...railItems("topics", R), ...railItems("groups", R)], [R])
  const mostTracked = useMemo(() => [
    ...railItems("channels", R).filter((g) => (R.channel.get(g.id)?.pushed ?? 0) > 0),
    ...railItems("videos", R),
    ...[...railItems("tags", R), ...railItems("topics", R)].sort((a, b) => parseInt(b.sub ?? "0") - parseInt(a.sub ?? "0")),
  ], [R])
  const typed = q.trim().length >= 2
  const suggestions = typed ? everything.filter((g) => `${g.label} ${g.sub ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40) : mostTracked.slice(0, visible)

  /* ── selection and dimming ── */
  const connected = useMemo(() => {
    if (!selectedKey) return null
    const set = new Set<string>([selectedKey])
    for (const e of edges) {
      if (e.source === selectedKey) set.add(e.target)
      if (e.target === selectedKey) set.add(e.source)
    }
    return set
  }, [selectedKey, edges])

  const rfNodes = useMemo(() => nodes.map((n) => {
    const g = n.data as GNode
    const counts = relCounts(g, R)
    const groups = cardGroups(g, R).map((grp) => ({ ...grp, total: counts[grp.rel] ?? grp.items.length }))
    const chips = Object.entries(counts)
      .filter(([rel, total]) => total > 0 && !(GROUPED[g.type] ?? []).includes(rel))
      .map(([rel, total]) => ({ rel, label: rel, total }))
    return {
      ...n,
      selected: n.id === selectedKey,
      data: {
        ...g,
        chips,
        groups,
        expanded: Object.fromEntries([...expandState.current.entries()].filter(([k]) => k.startsWith(`${n.id}|`)).map(([k, v]) => [k.slice(n.id.length + 1), v])),
        dimmed: connected ? !connected.has(n.id) : false,
        onExpand: expand,
        onMore: (parentKey: string, rel: string) => { const p = store.current.get(parentKey); if (p) expand(p, rel) },
        onRow: (from: GNode, item: GNode) => {
          if (store.current.has(keyOf(item))) { toast.info(`${item.label} is already on the canvas`); return }
          addNodes([item], keyOf(from))
        },
        onToggleGroup: toggleGroup,
        onSimilar: similar,
      },
    }
  }), [nodes, R, selectedKey, connected, expand, addNodes, toggleGroup, similar])

  const rfEdges = useMemo(() => edges.map((e) => {
    const hot = !!selectedKey && (e.source === selectedKey || e.target === selectedKey)
    const sim = edgeKind(e) === "similar"
    return {
      ...e,
      style: {
        stroke: hot ? BLUE : sim ? "#94a3b8" : "#cbd5e1",
        strokeWidth: hot ? 2 : 1,
        strokeDasharray: sim ? "6 3" : undefined,
        opacity: connected && !hot ? 0.15 : 1,
      },
      labelStyle: sim ? { fontSize: 9, fill: "#64748b" } : undefined,
      labelBgStyle: sim ? { fill: "#ffffff", fillOpacity: 0.9 } : undefined,
      labelBgPadding: sim ? ([3, 2] as [number, number]) : undefined,
      labelBgBorderRadius: sim ? 3 : undefined,
    }
  }), [edges, selectedKey, connected])

  const sel = selectedKey ? store.current.get(selectedKey) : null

  return (
    <div className="flex min-h-0 flex-1">
      <RecordRail R={R} onPick={center} onAdd={addToCanvas} />

      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, n) => { setSelectedKey(n.id); setEdgeInfo(null); surfaceJoins(n.id) }}
          onEdgeClick={(_, e) => {
            const s = store.current.get(e.source), t = store.current.get(e.target)
            if (s && t) { setEdgeInfo({ source: s, target: t, meta: e.data as EdgeMeta | undefined }); setSelectedKey(null) }
          }}
          onPaneClick={() => { setSelectedKey(null); setEdgeInfo(null) }}
          onNodesDelete={(del) => del.forEach((n) => removeNode(n.id))}
          fitView
          minZoom={0.15}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <Panel position="top-left">
            <div className="relative">
              <div className="rounded-full border border-slate-200 bg-white/90 p-1 shadow-e1 backdrop-blur-sm">
                <div className="flex h-8 w-96 max-w-[calc(100vw-3rem)] items-center gap-2 overflow-hidden rounded-full border border-slate-200 bg-white px-3">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => { setSearchFocused(false); setVisible(15) }, 150)}
                    placeholder="Center a channel, video, tag or topic…"
                    className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              {searchFocused && suggestions.length > 0 && (
                <div
                  onScroll={(e) => {
                    const el = e.currentTarget
                    if (!typed && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setVisible((v) => v + 15)
                  }}
                  className="absolute left-0 top-[48px] z-20 max-h-80 w-96 max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl bg-white py-1 shadow-e2 ring-1 ring-slate-200"
                >
                  {!typed && <p className="px-2.5 pb-1 pt-2 text-[10px] uppercase tracking-wide text-slate-400">Most tracked</p>}
                  {suggestions.map((g) => (
                    <button
                      key={keyOf(g)}
                      onClick={() => center(g)}
                      draggable
                      onDragStart={(e) => setDragEntity(e.dataTransfer, g)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-50"
                    >
                      <span className="w-14 shrink-0 rounded-full border border-slate-200 py-px text-center text-[9px] text-slate-500">{g.type}</span>
                      <span className="truncate font-medium text-slate-900">{g.label}</span>
                      <span className="tabular ml-auto shrink-0 text-[10px] text-slate-500">{g.sub?.split(" · ").slice(-1)[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          <Panel position="top-right">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 p-1 pl-3 shadow-e1 backdrop-blur-sm">
              <span className="text-xs text-slate-500">Join on select</span>
              {(["channel", "group", "topic", "tag"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setJoinKinds((j) => ({ ...j, [k]: !j[k] }))}
                  className={cn("h-8 rounded-full px-3 text-[13px] font-semibold transition-colors", joinKinds[k] ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-400")}
                >
                  {k}
                </button>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {!sel && edgeInfo && (() => {
        const r = receipt(edgeInfo.source, edgeInfo.target, edgeInfo.meta)
        return (
          <div className={SIDE}>
            <SideHeader badge={edgeInfo.meta?.kind === "similar" ? "inference" : "edge"} onClose={() => setEdgeInfo(null)} />
            <div className="mt-3 space-y-2">
              {([["Source", edgeInfo.source], ["Target", edgeInfo.target]] as const).map(([role, g]) => (
                <div key={role} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">{role}</span>
                  <button onClick={() => { setSelectedKey(keyOf(g)); setEdgeInfo(null) }} className="truncate font-medium text-pax2-light-blue hover:underline">{g.label}</button>
                </div>
              ))}
            </div>
            {edgeInfo.meta?.score != null && <Field k="Score" v={edgeInfo.meta.score.toFixed(2)} />}
            <p className="mt-4 text-xs leading-relaxed text-slate-600">{r.text}</p>
            {r.record && <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] leading-relaxed text-slate-500">Every data edge on this canvas is a record PAX2 holds. Nothing is inferred.</p>}
          </div>
        )
      })()}
      {sel && sel.type !== "more" && (
        <div className={SIDE}>
          <SideHeader badge={sel.type} onClose={() => setSelectedKey(null)} />
          <h2 draggable onDragStart={(e) => setDragEntity(e.dataTransfer, sel)} className="cursor-grab text-sm font-semibold leading-snug text-slate-900">
            {sel.type === "video" ? <a href={`/v/yt-${sel.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-pax2-light-blue">{sel.label}</a> : sel.label}
          </h2>
          <DetailBody
            g={sel}
            R={R}
            data={data}
            onCanvas={(g, rel) => expand(g, rel)}
            onWired={(from, item) => { if (store.current.has(keyOf(item))) toast.info(`${item.label} is already on the canvas`); else addNodes([item], keyOf(from)) }}
          />
        </div>
      )}
    </div>
  )
}

export function VideoGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <VideoGraphInner {...props} />
    </ReactFlowProvider>
  )
}
