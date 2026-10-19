"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addEdge, Background, BackgroundVariant, Controls, Handle, MarkerType, Panel, Position, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
  type Connection, type ConnectionLineType, type ConnectionMode, type Edge, type Node, type NodeProps, type PanOnScrollMode, type SelectionMode,
} from "@xyflow/react"
import dagre from "@dagrejs/dagre"
import { toast } from "sonner"
import {
  ArrowLeft, BookOpen, Boxes, Check, ChevronRight, Clapperboard, Crosshair, ExternalLink, FileText, GripVertical, Hash, History, Layers, Loader2,
  MessageSquare, Minus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Play, Plus, Save, Search, Settings2, Tv, Users, X,
} from "lucide-react"

import { canvasUploadUrl, listCanvases, listCanvasFiles, loadCanvas, saveCanvas, type CanvasFile } from "@/app/graph-actions"
import { ChatDock } from "@/components/graph/chat-dock"
import { DEFAULT_FLOW_PROPS, FlowSettingsPanel, type FlowProps } from "@/components/graph/flow-settings"
import { RECIPE_DEFAULTS, RECIPE_H, RECIPE_LABEL, RECIPE_W, RecipeForm, RecipeNode } from "@/components/graph/recipe-nodes"
import { whiteButton } from "@/components/white-button"
import { describeEntity, readDragEntity, setDragEntity, type DragEntity } from "@/lib/drag-entity"
import { isRecipeType, similarTo, type CanvasRow, type CanvasState, type GraphChannel, type GraphData, type GraphVideo, type RecipeType, type SavedEdge } from "@/lib/graph-data"
import { LOOPS } from "@/lib/recipes/loops"
import { TEMPLATES, type RecipeTemplate } from "@/lib/recipes/memorable"
import { fmtCompact } from "@/lib/velocity-meta"
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/nova/dialog"
import { cn } from "@/ui/lib/utils"

export type { GraphChannel, GraphData, GraphVideo } from "@/lib/graph-data"

// The connections canvas, on NSR's /graph workspace: a catalog rail on the left, typed entity
// cards on a dagre-laid canvas, paged "+N more" supernodes for honest overflow, a detail panel on
// the right, and a receipt for every edge saying which record joins the two. Every data edge is a
// relation PAX2 holds: channel-published-video, the uploader's tags, YouTube's topic annotations,
// channel groups. The one inference, "similar", is drawn dashed and says so.

type GType = "channel" | "video" | "tag" | "topic" | "group" | "more" | "prompt" | "file" | RecipeType
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
  /** Prompt steps. */
  prompt?: string
  output?: string
  /** Files dropped on the canvas: the S3 key, and the first 4,000 characters of a text file. */
  fileKey?: string
  fileText?: string
  /** Recipe cards: their fields (name, status, and the rest by type). */
  r?: Record<string, string>
}
/** Edge provenance. Absent kind = a record PAX2 holds; "wired" = drawn into a prompt step;
 *  "drawn" = a line on a model recipe, by an admin or from a template. */
type EdgeMeta = { kind?: "similar" | "wired" | "drawn"; score?: number; by?: string; at?: string; tpl?: string }
const edgeKind = (e: Edge) => (e.data as EdgeMeta | undefined)?.kind
const keyOf = (n: { type: string; id: string }) => `${n.type}:${n.id}`
const rx = (r: number) => `${(r >= 10 ? r.toFixed(0) : r.toFixed(1)).replace(/^0\./, ".")}x`
const TIER_COLOR = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" } as const
const BLUE = "#2563eb" // pax2-light-blue

const NODE_W: Record<GType, number> = { channel: 210, video: 240, tag: 150, topic: 160, group: 170, more: 130, prompt: 260, file: 180, ingredient: RECIPE_W, step: RECIPE_W, model: RECIPE_W, output: RECIPE_W }
const rfType = (t: string) => (isRecipeType(t) ? "recipe" : "entity")
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
  if (meta?.kind === "drawn" || isRecipeType(a.type) || isRecipeType(b.type))
    return { text: meta?.tpl ? `From the ${meta.tpl} template. A plan, not a record.` : `Drawn by ${meta?.by ?? "an admin"}${meta?.at ? ` on ${new Date(meta.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}. A plan, not a record.`, record: false }
  if (meta?.kind === "wired" || a.type === "prompt" || b.type === "prompt") return { text: "Drawn into a prompt step: the step reads this as context. A wiring, not a record.", record: false }
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
  if (g.type === "prompt") return g.output ? 170 : 126
  if (g.type === "file") return 64
  if (isRecipeType(g.type)) return RECIPE_H
  let h = g.type === "video" ? 88 : g.type === "channel" ? 80 : 66
  for (const grp of cardGroups(g, R)) {
    h += 22
    if (g.openGroups?.includes(grp.key)) h += grp.items.length * 18
  }
  return h
}

type LayoutMode = "none" | "dagre-lr" | "dagre-tb"
const LAYOUT_MODES: LayoutMode[] = ["none", "dagre-lr", "dagre-tb"]

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
  onEditPrompt: (key: string, text: string) => void
  onRun: (key: string) => void
  running: string | null
} & Record<string, unknown>

const CARD = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-e1"
const ICON: Record<string, React.ElementType> = { channel: Tv, video: Clapperboard, tag: Hash, topic: Boxes, group: Users }
const CHIP = "rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
const HANDLE = "!h-2 !w-2 !border-0 !bg-slate-300"
const HANDLE_BLUE = "!h-2.5 !w-2.5 !border-0 !bg-pax2-light-blue"

function EntityNode({ data: d, selected }: NodeProps<Node<CardData>>) {
  const ring = selected && "border-pax2-light-blue ring-1 ring-pax2-light-blue"
  if (d.type === "prompt") {
    const busy = d.running === keyOf(d)
    return (
      <div className={cn(CARD, "border-dashed border-slate-400 transition-opacity", ring, d.dimmed && "opacity-30")} style={{ width: NODE_W.prompt }}>
        <Handle type="target" position={Position.Left} className={HANDLE_BLUE} />
        <Handle type="source" position={Position.Right} className={HANDLE_BLUE} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-pax2-light-blue">Prompt step</p>
          <button onClick={(e) => { e.stopPropagation(); d.onRun(keyOf(d)) }} className={cn(CHIP, "nodrag flex items-center gap-1")} title="Runs the steps wired into this one first">
            {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />} Run
          </button>
        </div>
        <textarea
          value={d.prompt ?? ""}
          onChange={(e) => d.onEditPrompt(keyOf(d), e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Ask about the wired context…"
          className="nodrag mt-1.5 h-16 w-full resize-none rounded-md border border-slate-200 bg-white p-1.5 text-[11px] text-slate-900 outline-none focus:border-pax2-light-blue"
        />
        {d.output && <p className="mt-1.5 line-clamp-3 rounded bg-slate-50 p-1.5 text-[10px] leading-snug text-slate-600">{d.output}</p>}
      </div>
    )
  }
  if (d.type === "file")
    return (
      <div className={cn(CARD, "transition-opacity", ring, d.dimmed && "opacity-30")} style={{ width: NODE_W.file }}>
        <Handle type="source" position={Position.Right} className={HANDLE} />
        <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-slate-900"><FileText className="h-3 w-3 shrink-0 text-pax2-light-blue" />{d.label}</p>
        {d.sub && <p className="mt-0.5 truncate text-[10px] text-slate-500">{d.sub}</p>}
        {d.fileText && <span className="mt-1 inline-block rounded bg-pax2-lavender px-1.5 py-px text-[9px] text-pax2-blue">text wired</span>}
      </div>
    )
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
      className={cn(CARD, "group/card relative transition-opacity", ring, d.dimmed && "opacity-30")}
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

const nodeTypes = { entity: EntityNode, recipe: RecipeNode }

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
          {onAsk && <button className={item} onClick={(e) => { e.stopPropagation(); setOpen(false); onAsk(g) }}><MessageSquare className="h-3.5 w-3.5" /> Ask in chat</button>}
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

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "")
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString()} KB`

function SavedRows({ rows, filter, onLoad }: { rows: CanvasRow[] | null; filter: string; onLoad: (id: string) => void }) {
  const f = filter.trim().toLowerCase()
  if (!rows) return <Loader2 className="m-3 h-4 w-4 animate-spin text-slate-400" />
  return (
    <>
      {rows.filter((v) => !f || `${v.name} ${v.by}`.toLowerCase().includes(f)).map((v) => (
        <button key={v.id} onClick={() => onLoad(v.id)} className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50">
          <span className="flex w-full items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-slate-900">{v.name}</span>
            <span className="tabular shrink-0 text-[10px] text-slate-400">{v.nodes} nodes</span>
          </span>
          <span className="truncate text-[10px] text-slate-500">{v.by} · {day(v.at)}</span>
        </button>
      ))}
    </>
  )
}

type RailProps = {
  R: Rels
  admin: boolean
  refresh: number
  onPick: (g: GNode) => void
  onAdd: (g: GNode) => void
  onAsk?: (g: GNode) => void
  onAddFile: (f: CanvasFile) => void
  onLoad: (id: string) => void
}

function RecordRail({ R, admin, refresh, onPick, onAdd, onAsk, onAddFile, onLoad }: RailProps) {
  const [browse, setBrowse] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [files, setFiles] = useState<CanvasFile[] | null>(null)
  const [saved, setSaved] = useState<CanvasRow[] | null>(null)
  const back = () => { setBrowse(null); setFilter("") }
  useEffect(() => {
    if (browse === "library") listCanvasFiles().then(setFiles).catch(() => setFiles([]))
    if (browse === "views" || browse === "recipes") listCanvases().then(setSaved).catch(() => setSaved([]))
  }, [browse, refresh])

  if (browse === "library") {
    const f = filter.trim().toLowerCase()
    const items = (files ?? []).filter((x) => !f || x.name.toLowerCase().includes(f))
    return (
      <div className={RAIL}>
        <RailHeader label="Library" count={files?.length} onBack={back} />
        <RailFilter value={filter} onChange={setFilter} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!files && <Loader2 className="m-3 h-4 w-4 animate-spin text-slate-400" />}
          {items.map((x) => (
            <button key={x.key} onClick={() => onAddFile(x)} className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50">
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-900">{x.name}</span>
                <span className="tabular block text-[10px] text-slate-500">{kb(x.size)}{x.modified ? ` · ${day(x.modified)}` : ""}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (browse === "views" || browse === "recipes") {
    const rows = saved?.filter((v) => v.kind === (browse === "recipes" ? "recipe" : "view")) ?? null
    return (
      <div className={RAIL}>
        <RailHeader label={browse === "recipes" ? "Recipes" : "Views"} count={rows?.length} onBack={back} />
        <RailFilter value={filter} onChange={setFilter} />
        <div className="min-h-0 flex-1 overflow-y-auto"><SavedRows rows={rows} filter={filter} onLoad={onLoad} /></div>
      </div>
    )
  }
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
      <p className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-wide text-slate-400">Workspace</p>
      {([["library", "Library", FileText], ["views", "Views", Layers], ...(admin ? [["recipes", "Recipes", BookOpen] as const] : [])] as const).map(([key, label, Icon]) => (
        <button key={key} onClick={() => setBrowse(key)} className={RAIL_ROW}>
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

/** The recipe builder's rail: the templates (constants) and the saved recipes (the ledger). */
function RecipeRail({ refresh, onTemplate, onLoad }: { refresh: number; onTemplate: (t: RecipeTemplate) => void; onLoad: (id: string) => void }) {
  const [browse, setBrowse] = useState<"templates" | "saved" | null>(null)
  const [filter, setFilter] = useState("")
  const [saved, setSaved] = useState<CanvasRow[] | null>(null)
  const back = () => { setBrowse(null); setFilter("") }
  useEffect(() => {
    if (browse === "saved") listCanvases().then((rows) => setSaved(rows.filter((r) => r.kind === "recipe"))).catch(() => setSaved([]))
  }, [browse, refresh])
  if (browse === "templates")
    return (
      <div className={RAIL}>
        <RailHeader label="Templates" count={TEMPLATES.length} onBack={back} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => onTemplate(t)} className="flex w-full items-baseline justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50">
              <span className="truncate text-xs font-semibold text-slate-900">{t.name}</span>
              <span className="tabular shrink-0 text-[10px] text-slate-400">{t.nodes.length} nodes</span>
            </button>
          ))}
        </div>
      </div>
    )
  if (browse === "saved")
    return (
      <div className={RAIL}>
        <RailHeader label="Saved recipes" count={saved?.length} onBack={back} />
        <RailFilter value={filter} onChange={setFilter} />
        <div className="min-h-0 flex-1 overflow-y-auto"><SavedRows rows={saved} filter={filter} onLoad={onLoad} /></div>
      </div>
    )
  return (
    <div className={RAIL}>
      <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-wide text-slate-400">Recipes</p>
      <button onClick={() => setBrowse("templates")} className={RAIL_ROW}><Layers className="h-3.5 w-3.5 text-slate-400" /><span>Templates</span><span className="tabular ml-auto text-xs text-slate-400">{TEMPLATES.length}</span></button>
      <button onClick={() => onTemplate(LOOPS)} className={RAIL_ROW}><Play className="h-3.5 w-3.5 text-slate-400" /><span>Loops</span></button>
      <button onClick={() => setBrowse("saved")} className={RAIL_ROW}><BookOpen className="h-3.5 w-3.5 text-slate-400" /><span>Saved recipes</span></button>
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

/** One execution of prompt steps, kept in the browser. */
type TraceStep = { key: string; prompt: string; status: "running" | "done" | "error" | "skipped"; input?: string; output?: string; error?: string; startedAt: number; ms?: number }
type RunTrace = { id: string; label: string; startedAt: number; finishedAt?: number; steps: TraceStep[] }
const RUNS_KEY = "pax2-graph-runs"
const PROPS_KEY = "pax2-graph-flow-props"
const LAYOUT_KEY = "pax2-graph-layout"
const RAIL_KEY = "pax2-graph-rail"

type Mode = "networks" | "recipes"
type Stash = { store: Map<string, GNode>; expand: Map<string, { loaded: number; total: number }>; edges: Edge[]; nodes: Node[]; canvas: { id?: string; name: string } | null }
const RECIPE_TOOLS: [RecipeType, string][] = [["ingredient", "Ingredient"], ["step", "Process"], ["model", "Model"], ["output", "Output"]]

/** An undo step: the canvas's content, never pan, zoom or selection. */
type Snap = { store: [string, GNode][]; expand: [string, { loaded: number; total: number }][]; edges: Edge[]; pos: [string, { x: number; y: number }][]; at: number }

const PILL = whiteButton("md", "h-8 px-3.5 py-0 text-[13px] shadow-none")
const PILL_ICON = whiteButton("circle", "size-8 shadow-none")
const GROUP_BAR = "flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 p-1 shadow-e1 backdrop-blur-sm"

const toEdge = (e: SavedEdge): Edge => ({
  id: `${e.s}->${e.t}`, source: e.s, target: e.t,
  ...(e.k ? { data: { kind: e.k, score: e.score, by: e.by, at: e.at, tpl: e.tpl } as EdgeMeta } : {}),
  ...(e.k === "similar" && e.score != null ? { label: e.score.toFixed(2) } : {}),
})
const fromEdge = (e: Edge): SavedEdge => {
  const m = e.data as EdgeMeta | undefined
  return { s: e.source, t: e.target, ...(m?.kind ? { k: m.kind } : {}), ...(m?.score != null ? { score: m.score } : {}), ...(m?.by ? { by: m.by } : {}), ...(m?.at ? { at: m.at } : {}), ...(m?.tpl ? { tpl: m.tpl } : {}) }
}

function VideoGraphInner({ data, email, admin, boot }: Props) {
  const R = useRelations(data)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])
  const store = useRef(new Map<string, GNode>())
  const expandState = useRef(new Map<string, { loaded: number; total: number }>())
  // The edge list's source of truth between renders: several mutations can land in one tick.
  const edgesRef = useRef<Edge[]>([])
  const nodesRef = useRef<Node[]>(nodes)
  nodesRef.current = nodes
  const paneRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [edgeInfo, setEdgeInfo] = useState<{ source: GNode; target: GNode; meta?: EdgeMeta } | null>(null)
  const [q, setQ] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [visible, setVisible] = useState(15)
  const [joinKinds, setJoinKinds] = useState<Record<string, boolean>>({ channel: true, group: true, topic: true, tag: true })
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("dagre-lr")
  // syncNodes reads the mode through a ref so a change doesn't churn every callback built on it
  const layoutModeRef = useRef<LayoutMode>(layoutMode)
  layoutModeRef.current = layoutMode
  const [flowProps, setFlowProps] = useState<FlowProps>(DEFAULT_FLOW_PROPS)
  const propsLoaded = useRef(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataset, setDataset] = useState("top-reform-core")
  const [dockOpen, setDockOpen] = useState(false)
  const [attached, setAttached] = useState<DragEntity | null>(null)
  const [canvas, setCanvas] = useState<{ id?: string; name: string } | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)
  const [railRefresh, setRailRefresh] = useState(0)
  // Admins switch the canvas between the record graph and the model recipe builder; each mode
  // keeps its own canvas while the other is showing.
  const [mode, setMode] = useState<Mode>("networks")
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode
  const canvasRef = useRef(canvas)
  canvasRef.current = canvas
  const stash = useRef<Partial<Record<Mode, Stash>>>({})
  // The left rail folds away for more canvas; the button at the toolbar's left end brings it back.
  const [railOpen, setRailOpen] = useState(true)
  useEffect(() => { if (localStorage.getItem(RAIL_KEY) === "0") setRailOpen(false) }, [])
  const toggleRail = () => setRailOpen((o) => { try { localStorage.setItem(RAIL_KEY, o ? "0" : "1") } catch { /* quota */ } return !o })

  const fit = useCallback(() => setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60), [fitView])

  // The settings persist in the browser; read after mount so the server render matches.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROPS_KEY) ?? "null")
      if (saved && typeof saved === "object") setFlowProps({ ...DEFAULT_FLOW_PROPS, ...saved })
      const m = localStorage.getItem(LAYOUT_KEY) as LayoutMode | null
      if (m && LAYOUT_MODES.includes(m)) { setLayoutMode(m); layoutModeRef.current = m }
    } catch { /* defaults */ }
    propsLoaded.current = true
  }, [])
  useEffect(() => {
    if (!propsLoaded.current) return
    try { localStorage.setItem(PROPS_KEY, JSON.stringify(flowProps)) } catch { /* quota */ }
  }, [flowProps])

  /* ── undo and redo: every content mutation snapshots first; ⌘Z, ⌘⇧Z and ⌘Y walk the stacks.
   *    Snapshots within 150 ms coalesce (an expansion adds its cards, then its "+N more"). ── */
  const past = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])
  const takeSnap = useCallback((): Snap => ({
    store: [...store.current.entries()],
    expand: [...expandState.current.entries()],
    edges: edgesRef.current,
    pos: nodesRef.current.map((n) => [n.id, n.position]),
    at: Date.now(),
  }), [])
  const snapshot = useCallback(() => {
    const last = past.current[past.current.length - 1]
    if (last && Date.now() - last.at < 150) return
    past.current = [...past.current.slice(-49), takeSnap()]
    future.current = []
  }, [takeSnap])
  const restore = useCallback((snap: Snap) => {
    store.current = new Map(snap.store)
    expandState.current = new Map(snap.expand)
    edgesRef.current = snap.edges
    const pos = new Map(snap.pos)
    setSelectedKey(null)
    setEdgeInfo(null)
    setEdges(snap.edges)
    setNodes([...store.current.values()].map((g) => ({ id: keyOf(g), type: rfType(g.type), position: pos.get(keyOf(g)) ?? { x: 0, y: 0 }, data: { ...g } })))
  }, [setEdges, setNodes])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k !== "z" && k !== "y") return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return
      const redo = k === "y" || (k === "z" && e.shiftKey)
      const from = redo ? future.current : past.current
      if (!from.length) return
      e.preventDefault()
      const snap = from[from.length - 1]
      const now = takeSnap()
      if (redo) { future.current = from.slice(0, -1); past.current = [...past.current.slice(-49), now] }
      else { past.current = from.slice(0, -1); future.current = [...future.current.slice(-49), now] }
      restore(snap)
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [restore, takeSnap])

  const syncNodes = useCallback((allEdges: Edge[], relayout: boolean) => {
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      const lm = layoutModeRef.current
      // "none": nothing moves; new nodes land beside their edge source, stacked
      const fresh = new Map<string, number>()
      let next: Node[] = [...store.current.values()].map((g) => {
        const k = keyOf(g)
        let position = prevPos.get(k)
        if (!position && lm === "none") {
          const e = allEdges.find((x) => x.target === k) ?? allEdges.find((x) => x.source === k)
          const anchor = e ? (e.source === k ? e.target : e.source) : null
          const src = anchor ? prevPos.get(anchor) : undefined
          if (src && anchor) {
            const i = fresh.get(anchor) ?? 0
            fresh.set(anchor, i + 1)
            position = { x: src.x + (NODE_W[store.current.get(anchor)?.type ?? "video"] ?? 160) + 70, y: src.y + i * 96 }
          }
        }
        return { id: k, type: rfType(g.type), position: position ?? { x: 0, y: 0 }, data: { ...g } }
      })
      if (relayout && lm !== "none") next = layout(next, allEdges, R, lm === "dagre-tb" ? "TB" : "LR")
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
    snapshot()
    for (const it of items) store.current.set(keyOf(it), { ...store.current.get(keyOf(it)), ...it })
    // an explicit drop point wins over layout: seed the position so syncNodes sees it placed
    if (at) setNodes((prev) => [
      ...prev.filter((n) => !items.some((it) => keyOf(it) === n.id)),
      ...items.map((it, i) => ({ id: keyOf(it), type: rfType(it.type), position: { x: at.x, y: at.y + i * 96 }, data: { ...it } })),
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
  }, [setNodes, commitEdges, fit, snapshot])

  const patchNode = useCallback((key: string, patch: Partial<GNode>) => {
    const g = store.current.get(key)
    if (!g) return
    store.current.set(key, { ...g, ...patch })
    setNodes((prev) => prev.map((n) => (n.id === key ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [setNodes])

  const removeNode = useCallback((key: string) => {
    if (!store.current.has(key)) return
    snapshot()
    store.current.delete(key)
    // a recipe is arranged by hand; only the record graph relays out on a delete
    commitEdges(edgesRef.current.filter((e) => e.source !== key && e.target !== key), modeRef.current === "networks")
  }, [commitEdges, snapshot])

  const toggleGroup = useCallback((key: string, group: string) => {
    const g = store.current.get(key)
    if (!g) return
    const cur = g.openGroups ?? []
    snapshot()
    patchNode(key, { openGroups: cur.includes(group) ? cur.filter((x) => x !== group) : [...cur, group] })
    // the card's height changed; dagre must see it
    syncNodes(edgesRef.current, true)
  }, [patchNode, syncNodes, snapshot])

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
    if (!g || g.type === "more" || g.type === "prompt" || g.type === "file") return
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
    snapshot()
    for (const a of added) store.current.set(keyOf(a), a)
    commitEdges([...prev, ...fresh], true)
    fit()
  }, [R, joinKinds, commitEdges, fit, snapshot])

  /** Replace the canvas with one entity, arriving with its first relation expanded. */
  const center = useCallback((g: GNode) => {
    snapshot()
    store.current = new Map([[keyOf(g), g]])
    expandState.current = new Map()
    edgesRef.current = []
    setEdges([])
    setNodes([{ id: keyOf(g), type: rfType(g.type), position: { x: 0, y: 0 }, data: { ...g } }])
    setSelectedKey(keyOf(g))
    setEdgeInfo(null)
    setCanvas(null)
    setQ("")
    const first = relationsOf(g, R)[0]
    if (first) expand(g, first.rel)
    else fit()
  }, [R, setEdges, setNodes, expand, fit, snapshot])

  const addToCanvas = useCallback((g: GNode) => {
    if (store.current.has(keyOf(g))) { toast.info(`${g.label} is already on the canvas`); return }
    addNodes([g])
  }, [addNodes])

  const findEntity = useCallback((type: string, id: string): GNode | null => {
    if (type === "video") { const v = R.video.get(id); return v ? videoNode(v) : null }
    if (type === "channel") { const c = R.channel.get(id); return c ? channelNode(c) : null }
    if (type === "tag") return R.byTag.has(id.toLowerCase()) ? tagOf(id, R) : null
    if (type === "topic") return R.byTopic.has(id) ? topicOf(id, R) : null
    if (type === "group") return R.byGroup.has(id) ? groupOf(id, R) : null
    return null
  }, [R])

  const enterMode = useCallback((m: Mode) => {
    if (modeRef.current === m) return
    stash.current[modeRef.current] = { store: new Map(store.current), expand: new Map(expandState.current), edges: edgesRef.current, nodes: nodesRef.current, canvas: canvasRef.current }
    const next = stash.current[m]
    store.current = new Map(next?.store ?? [])
    expandState.current = new Map(next?.expand ?? [])
    edgesRef.current = next?.edges ?? []
    setEdges(edgesRef.current)
    setNodes(next?.nodes ?? [])
    setCanvas(next?.canvas ?? null)
    setSelectedKey(null)
    setEdgeInfo(null)
    past.current = []
    future.current = []
    modeRef.current = m
    setMode(m)
    fit()
  }, [setEdges, setNodes, fit])

  /* ── saved canvases ── */

  const applyState = useCallback((state: CanvasState) => {
    snapshot()
    store.current = new Map(state.nodes.map(({ x: _x, y: _y, ...g }) => [keyOf(g), g as GNode]))
    expandState.current = new Map()
    const es = state.edges.filter((e) => store.current.has(e.s) && store.current.has(e.t)).map(toEdge)
    edgesRef.current = es
    setEdges(es)
    setNodes(state.nodes.map(({ x, y, ...g }) => ({ id: keyOf(g), type: rfType(g.type), position: { x, y }, data: { ...g } })))
    setSelectedKey(null)
    setEdgeInfo(null)
    fit()
  }, [setEdges, setNodes, fit, snapshot])

  /** A saved view replaces the canvas; nothing on /graph navigates away. */
  const loadView = useCallback(async (id: string) => {
    try {
      const v = await loadCanvas(id)
      enterMode(v.kind === "recipe" ? "recipes" : "networks")
      applyState(v.state)
      setCanvas({ id: v.id, name: v.name })
      toast.success(`Loaded ${v.name}`)
    } catch {
      toast.error("That canvas was not found")
    }
  }, [applyState, enterMode])

  const serialize = useCallback((): CanvasState => ({
    nodes: nodesRef.current.flatMap((n) => {
      const g = store.current.get(n.id)
      if (!g) return []
      return [{
        type: g.type, id: g.id, label: g.label, sub: g.sub, tier: g.tier, openGroups: g.openGroups?.length ? g.openGroups : undefined,
        prompt: g.prompt, output: g.output ? g.output.slice(0, 2000) : undefined, fileKey: g.fileKey, fileText: g.fileText, r: g.r,
        x: Math.round(n.position.x), y: Math.round(n.position.y),
      }]
    }),
    edges: edgesRef.current.map(fromEdge),
  }), [])

  const save = async () => {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const row = await saveCanvas({ id: canvas?.id, name: saveName, state: serialize() })
      setCanvas({ id: row.id, name: row.name })
      setSaveOpen(false)
      setRailRefresh((x) => x + 1)
      toast.success(`${row.kind === "recipe" ? "Recipe" : "View"} saved`)
    } catch (e) {
      toast.error((e as Error).message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    // the boot itself is not an undo step
    if (boot.view) { loadView(boot.view).finally(() => { past.current = [] }); return }
    const c = boot.center
    const [type, ...rest] = c?.includes(":") ? c.split(":") : []
    const found = type ? findEntity(type, rest.join(":")) : null
    const top = [...R.channel.values()].sort((a, b) => b.pushed - a.pushed)[0]
    if (found) center(found)
    else if (top) center(channelNode(top))
    past.current = []
  }, [boot, R, center, findEntity, loadView])

  /* ── the settings panel's two extra sections: seed datasets and the layout library ── */

  const datasets = useMemo(() => {
    const topOf = (group: string) => [...R.channel.values()].filter((c) => c.group === group).sort((a, b) => b.pushed - a.pushed || b.n - a.n)[0]
    const core = topOf("reform-core"), reform = topOf("reform")
    const topic = [...R.byTopic.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const video = [...R.video.values()].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
    return [
      ...(core ? [{ id: "top-reform-core", label: `${core.name} (reform-core)`, seed: channelNode(core) }] : []),
      ...(reform ? [{ id: "top-reform", label: `${reform.name} (reform)`, seed: channelNode(reform) }] : []),
      ...(topic ? [{ id: "top-topic", label: `${topic[0]} (topic)`, seed: topicOf(topic[0], R) }] : []),
      ...(video ? [{ id: "top-video", label: `${video.title.slice(0, 40)} (video)`, seed: videoNode(video) }] : []),
      { id: "empty", label: "Empty canvas", seed: null as GNode | null },
    ]
  }, [R])

  const applyDataset = useCallback((id: string) => {
    const d = datasets.find((x) => x.id === id)
    if (!d) return
    setDataset(id)
    enterMode("networks")
    if (d.seed) { center(d.seed); return }
    snapshot()
    store.current = new Map()
    expandState.current = new Map()
    edgesRef.current = []
    setEdges([])
    setNodes([])
    setSelectedKey(null)
    setEdgeInfo(null)
    setCanvas(null)
  }, [datasets, center, snapshot, setEdges, setNodes, enterMode])

  const changeLayoutMode = useCallback((m: string) => {
    if (!LAYOUT_MODES.includes(m as LayoutMode)) return
    setLayoutMode(m as LayoutMode)
    layoutModeRef.current = m as LayoutMode
    try { localStorage.setItem(LAYOUT_KEY, m) } catch { /* quota */ }
    syncNodes(edgesRef.current, true)
    fit()
  }, [syncNodes, fit])

  /** Citation chips in the chat center their video on the canvas instead of navigating. */
  useEffect(() => {
    const h = (e: Event) => {
      const { type, id } = (e as CustomEvent<{ type?: string; id?: string }>).detail ?? {}
      const g = type && id ? findEntity(type, id) : null
      if (!g) return
      e.preventDefault()
      enterMode("networks")
      center(g)
    }
    window.addEventListener("open-entity", h)
    return () => window.removeEventListener("open-entity", h)
  }, [center, findEntity, enterMode])

  /* ── prompt steps and traced runs ── */

  const [runs, setRuns] = useState<RunTrace[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [traceOpen, setTraceOpen] = useState<string | null>(null)
  const [traceStep, setTraceStep] = useState<number | null>(null)
  const activeRun = useRef<RunTrace | null>(null)
  useEffect(() => { setTraceOpen(null) }, [mode])
  useEffect(() => {
    try { setRuns(JSON.parse(localStorage.getItem(RUNS_KEY) ?? "[]")) } catch { /* none kept */ }
  }, [])
  const keepRuns = useCallback((next: RunTrace[]) => {
    try { localStorage.setItem(RUNS_KEY, JSON.stringify(next.slice(0, 20))) } catch { /* quota */ }
  }, [])
  const mutateRun = useCallback((fn: (r: RunTrace) => void) => {
    const r = activeRun.current
    if (!r) return
    fn(r)
    setRuns((prev) => {
      const next = [{ ...r, steps: r.steps.map((s) => ({ ...s })) }, ...prev.filter((x) => x.id !== r.id)].slice(0, 20)
      keepRuns(next)
      return next
    })
  }, [keepRuns])

  const upstreamPrompts = useCallback((key: string) => edgesRef.current.filter((e) => e.target === key && store.current.get(e.source)?.type === "prompt").map((e) => e.source), [])

  const contextFor = useCallback((key: string, outputs: Map<string, string>): string => {
    const parts: string[] = []
    for (const e of edgesRef.current.filter((x) => x.target === key)) {
      const g = store.current.get(e.source)
      if (!g || g.type === "more") continue
      if (g.type === "prompt") {
        const out = outputs.get(e.source) ?? g.output
        if (out) parts.push(`OUTPUT OF THE PREVIOUS STEP ("${(g.prompt ?? "").slice(0, 80)}"):\n${out.slice(0, 3000)}`)
      } else parts.push(describeEntity(g, data))
    }
    return parts.length ? `This is one step of a prompt chain on the PAX2 graph canvas. The reader wired this context into the step:\n\n${parts.join("\n\n")}` : ""
  }, [data])

  const runStep = useCallback(async (key: string, outputs: Map<string, string>) => {
    const g = store.current.get(key)
    if (!g || g.type !== "prompt") return
    const t0 = Date.now()
    mutateRun((r) => r.steps.push({ key, prompt: g.prompt ?? "", status: "running", startedAt: t0 }))
    const stamp = (patch: Partial<TraceStep>) => mutateRun((r) => {
      const s = [...r.steps].reverse().find((x) => x.key === key)
      if (s) Object.assign(s, patch, { ms: Date.now() - t0 })
    })
    setRunning(key)
    try {
      if (!g.prompt?.trim()) throw new Error("Empty prompt step")
      const systemContext = contextFor(key, outputs)
      stamp({ input: systemContext.slice(0, 20_000) })
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: g.prompt }], systemContext: systemContext || undefined }),
      })
      if (!res.ok || !res.body) throw new Error(`The chat answered ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        patchNode(key, { output: acc })
      }
      if (!acc.trim()) throw new Error("No answer came back")
      outputs.set(key, acc)
      stamp({ status: "done", output: acc.slice(0, 20_000) })
    } catch (e) {
      stamp({ status: "error", error: (e as Error).message })
      throw e
    } finally {
      setRunning(null)
    }
  }, [contextFor, mutateRun, patchNode])

  /** Run the given steps after everything upstream of them, in dependency order. A failed step
   *  stops the run, and every step downstream of it is marked skipped. */
  const runTraced = useCallback(async (keys: string[], label: string) => {
    if (activeRun.current) { toast.info("A run is already in progress"); return }
    const order: string[] = []
    const done = new Set<string>(), visiting = new Set<string>()
    const visit = (k: string) => {
      if (done.has(k) || visiting.has(k)) return
      visiting.add(k)
      for (const u of upstreamPrompts(k)) visit(u)
      visiting.delete(k)
      done.add(k)
      order.push(k)
    }
    keys.forEach(visit)
    const run: RunTrace = { id: Math.random().toString(36).slice(2, 10), label, startedAt: Date.now(), steps: [] }
    activeRun.current = run
    setRuns((prev) => [run, ...prev].slice(0, 20))
    setTraceOpen(run.id)
    setTraceStep(null)
    setSelectedKey(null)
    setEdgeInfo(null)
    const outputs = new Map<string, string>()
    let failed: string | null = null
    try {
      for (const k of order) {
        try {
          await runStep(k, outputs)
        } catch (e) {
          failed = k
          // everything that reads this step's output, directly or through another step
          const down = new Set<string>([k])
          for (let grew = true; grew;) {
            grew = false
            for (const e2 of edgesRef.current) if (down.has(e2.source) && !down.has(e2.target) && store.current.get(e2.target)?.type === "prompt") { down.add(e2.target); grew = true }
          }
          const skipped = order.slice(order.indexOf(k) + 1).filter((x) => down.has(x))
          mutateRun((r) => { for (const s of skipped) r.steps.push({ key: s, prompt: store.current.get(s)?.prompt ?? "", status: "skipped", startedAt: Date.now() }) })
          toast.error(`Step failed: ${(e as Error).message}`)
          break
        }
      }
      mutateRun((r) => { r.finishedAt = Date.now() })
    } finally {
      activeRun.current = null
    }
    if (!failed && order.length > 1) toast.success("Run complete")
  }, [upstreamPrompts, runStep, mutateRun])

  const runAll = useCallback(() => {
    const prompts = [...store.current.values()].filter((g) => g.type === "prompt").map(keyOf)
    if (!prompts.length) { toast.info("No prompt steps on the canvas"); return }
    runTraced(prompts, `${prompts.length} step${prompts.length === 1 ? "" : "s"}`)
  }, [runTraced])

  const paneCenter = () => {
    const r = paneRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 3 } : { x: window.innerWidth / 2, y: window.innerHeight / 3 }
  }

  const addPromptNode = useCallback((screen: { x: number; y: number }) => {
    const g: GNode = { type: "prompt", id: Math.random().toString(36).slice(2, 8), label: "Prompt step", prompt: "" }
    snapshot()
    store.current.set(keyOf(g), g)
    setNodes((prev) => [...prev, { id: keyOf(g), type: "entity", position: screenToFlowPosition(screen), data: { ...g } }])
  }, [setNodes, screenToFlowPosition, snapshot])

  /* ── the model recipe builder ── */

  const addRecipeNode = (type: RecipeType) => {
    const r = { ...RECIPE_DEFAULTS[type] }
    const g: GNode = { type, id: `${type[0]}-${Math.random().toString(36).slice(2, 8)}`, label: r.name, r }
    snapshot()
    store.current.set(keyOf(g), g)
    setNodes((prev) => [...prev, { id: keyOf(g), type: "recipe", position: screenToFlowPosition(paneCenter()), data: { ...g } }])
    setSelectedKey(keyOf(g))
    setEdgeInfo(null)
  }

  const editRecipe = (key: string, field: string, value: string) => {
    const g = store.current.get(key)
    if (!g) return
    const r = { ...g.r, [field]: value }
    patchNode(key, field === "name" ? { r, label: value } : { r })
  }

  /** A template loads as an unsaved recipe; Save writes the copy, never the constant. */
  const loadTemplate = useCallback((t: RecipeTemplate) => {
    enterMode("recipes")
    snapshot()
    const gs: GNode[] = t.nodes.map((n) => ({ type: n.type, id: n.id, label: n.fields.name ?? n.id, r: { ...n.fields } }))
    store.current = new Map(gs.map((g) => [keyOf(g), g]))
    expandState.current = new Map()
    const k = new Map(gs.map((g) => [g.id, keyOf(g)]))
    const es: Edge[] = t.edges.filter(([a, b]) => k.has(a) && k.has(b)).map(([a, b]) => ({ id: `${k.get(a)}->${k.get(b)}`, source: k.get(a)!, target: k.get(b)!, data: { kind: "drawn", tpl: t.name } as EdgeMeta }))
    edgesRef.current = es
    setEdges(es)
    // A template whose every node carries a position (the Loops cycle) keeps its drawn shape; the rest lay out by dagre.
    const fixed = t.nodes.every((n) => n.pos)
    setNodes(fixed ? t.nodes.map((n, i) => ({ id: keyOf(gs[i]), type: "recipe" as const, position: n.pos!, data: { ...gs[i] } })) : layout(gs.map((g) => ({ id: keyOf(g), type: "recipe", position: { x: 0, y: 0 }, data: { ...g } })), es, R, layoutModeRef.current === "dagre-tb" ? "TB" : "LR"))
    setSelectedKey(null)
    setEdgeInfo(null)
    setCanvas({ name: t.name })
    fit()
  }, [enterMode, snapshot, setEdges, setNodes, R, fit])

  /* ── the Loops recipe's walk: Play triggers each stage in order, one pass, then rests ── */
  const [playingLoop, setPlayingLoop] = useState(false)
  const playLoop = useCallback(() => {
    if (playingLoop) return
    setPlayingLoop(true)
    const seq = LOOPS.edges.map(([a, b]) => [`step:${a}`, `step:${b}`] as const)
    const STEP_MS = 1150
    seq.forEach(([src, tgt], i) => {
      const closing = i === seq.length - 1
      window.setTimeout(() => {
        setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, pulse: n.id === src || n.id === tgt } })))
        setEdges((es) => es.map((e) => (e.id === `${src}->${tgt}` ? { ...e, animated: true, style: { stroke: closing ? "var(--pax2-red)" : "var(--pax2-light-blue)", strokeWidth: 2 } } : { ...e, animated: false, style: undefined })))
      }, i * STEP_MS)
    })
    window.setTimeout(() => {
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, pulse: false } })))
      setEdges((es) => es.map((e) => ({ ...e, animated: false, style: undefined })))
      setPlayingLoop(false)
    }, seq.length * STEP_MS + 700)
  }, [playingLoop, setNodes, setEdges])

  /** Data edges are records; the only lines a reader draws go into prompt steps, or between the
   *  cards of a recipe, where every line is a plan. */
  const onConnect = useCallback((c: Connection) => {
    if (modeRef.current === "recipes") {
      const a = store.current.get(c.source), b = store.current.get(c.target)
      if (!a || !b || !isRecipeType(a.type) || !isRecipeType(b.type) || c.source === c.target) return
      snapshot()
      const all = addEdge({ ...c, id: `${c.source}->${c.target}`, data: { kind: "drawn", by: email ?? undefined, at: new Date().toISOString() } as EdgeMeta }, edgesRef.current)
      edgesRef.current = all
      setEdges(all)
      return
    }
    if (!c.target?.startsWith("prompt:")) { toast.error("Draw connections into prompt steps; data edges are records, not drawings."); return }
    snapshot()
    const all = addEdge({ ...c, id: `${c.source}->${c.target}`, data: { kind: "wired" } as EdgeMeta }, edgesRef.current)
    edgesRef.current = all
    setEdges(all)
  }, [setEdges, snapshot, email])

  /* ── drops: an entity lands where dropped; a file uploads, then lands ── */

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const ent = readDragEntity(e.dataTransfer)
    const recipes = modeRef.current === "recipes"
    if (ent) {
      if (recipes !== isRecipeType(ent.type)) { toast.info(recipes ? "Only recipe cards go on a recipe." : "Recipe cards stay on recipes."); return }
      if (store.current.has(keyOf(ent))) { toast.info(`${ent.label} is already on the canvas`); return }
      addNodes([ent as GNode], undefined, { relayout: false, at: pos })
      return
    }
    const files = [...(e.dataTransfer?.files ?? [])]
    if (!files.length) return
    if (recipes) { toast.info("Files go on the Networks canvas."); return }
    if (!email) { toast.error("Sign in to drop files on the canvas."); return }
    for (const [i, f] of files.entries()) {
      try {
        const type = f.type || "application/octet-stream"
        const { key, url } = await canvasUploadUrl(f.name, type)
        const put = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: f })
        if (!put.ok) throw new Error(`upload ${put.status}`)
        const texty = f.size < 300_000 && (f.type.startsWith("text/") || /\.(txt|csv|md|json|xml|tsv|srt|vtt)$/i.test(f.name))
        const fileText = texty ? (await f.text()).slice(0, 4000) : undefined
        addNodes([{ type: "file", id: key, label: f.name, sub: `${kb(f.size)} · ${f.type || "file"}`, fileKey: key, fileText }], undefined, { relayout: false, at: { x: pos.x, y: pos.y + i * 80 } })
        setRailRefresh((x) => x + 1)
        toast.success(`${f.name} is on the canvas${fileText ? ", its text wired" : ""}`)
      } catch (err) {
        toast.error(`${f.name}: ${(err as Error).message}`)
      }
    }
  }, [screenToFlowPosition, addNodes, email])

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
        onEditPrompt: (key: string, text: string) => patchNode(key, { prompt: text }),
        onRun: (key: string) => runTraced([key], "Single step"),
        running,
      },
    }
  }), [nodes, R, selectedKey, connected, expand, addNodes, toggleGroup, similar, patchNode, runTraced, running])

  const rfEdges = useMemo(() => edges.map((e) => {
    const hot = !!selectedKey && (e.source === selectedKey || e.target === selectedKey)
    const sim = edgeKind(e) === "similar"
    const intoPrompt = e.target.startsWith("prompt:")
    const drawn = edgeKind(e) === "drawn"
    return {
      ...e,
      ...(drawn ? { markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: hot ? BLUE : "#94a3b8" } } : {}),
      animated: intoPrompt && running === e.target,
      style: {
        stroke: hot || intoPrompt ? BLUE : sim || drawn ? "#94a3b8" : "#cbd5e1",
        strokeWidth: hot ? 2 : 1,
        strokeDasharray: sim ? "6 3" : undefined,
        opacity: connected && !hot ? 0.15 : 1,
      },
      labelStyle: sim ? { fontSize: 9, fill: "#64748b" } : undefined,
      labelBgStyle: sim ? { fill: "#ffffff", fillOpacity: 0.9 } : undefined,
      labelBgPadding: sim ? ([3, 2] as [number, number]) : undefined,
      labelBgBorderRadius: sim ? 3 : undefined,
    }
  }), [edges, selectedKey, connected, running])

  const sel = selectedKey ? store.current.get(selectedKey) : null
  const hasPrompts = nodes.some((n) => (n.data as GNode).type === "prompt")

  /** What the dock knows: an attached entity, the canvas inventory, the selection. */
  const canvasContext = useCallback(() => {
    const ents = [...store.current.values()].filter((g) => g.type !== "more")
    const parts: string[] = []
    if (attached) parts.push(`ACTIVE CONTEXT. The reader attached this to the conversation:\n${describeEntity(attached, data)}`)
    parts.push(ents.length ? `The reader is on the PAX2 graph canvas, which shows:\n${ents.slice(0, 30).map((g) => `${g.type} ${g.label}`).join("\n")}` : "The reader is on the PAX2 graph canvas, which is empty.")
    if (selectedKey) parts.push(`The reader has ${selectedKey} selected.`)
    parts.push("When naming a tracked video, link it as [its title](/v/yt-<id>); the link centers it on the canvas.")
    return parts.join("\n\n")
  }, [attached, data, selectedKey])

  const run = traceOpen ? runs.find((r) => r.id === traceOpen) : null

  return (
    <div className="flex min-h-0 flex-1">
      {!railOpen ? null : mode === "recipes" ? <RecipeRail refresh={railRefresh} onTemplate={loadTemplate} onLoad={loadView} /> : <RecordRail
        R={R}
        admin={admin}
        refresh={railRefresh}
        onPick={center}
        onAdd={addToCanvas}
        onAsk={(g) => { setAttached(g); setDockOpen(true) }}
        onAddFile={(f) => addToCanvas({ type: "file", id: f.key, label: f.name, sub: kb(f.size), fileKey: f.key })}
        onLoad={loadView}
      />}

      <div ref={paneRef} className="relative min-h-0 min-w-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => { setSelectedKey(n.id); setEdgeInfo(null); if (modeRef.current === "networks") surfaceJoins(n.id) }}
          onEdgeClick={(_, e) => {
            const s = store.current.get(e.source), t = store.current.get(e.target)
            if (s && t) { setEdgeInfo({ source: s, target: t, meta: e.data as EdgeMeta | undefined }); setSelectedKey(null) }
          }}
          onPaneClick={() => { setSelectedKey(null); setEdgeInfo(null) }}
          onPaneContextMenu={(e) => { e.preventDefault(); if (modeRef.current === "networks") addPromptNode({ x: e.clientX, y: e.clientY }) }}
          onNodesDelete={(del) => del.forEach((n) => removeNode(n.id))}
          onEdgesDelete={(del) => { snapshot(); const ids = new Set(del.map((x) => x.id)); commitEdges(edgesRef.current.filter((x) => !ids.has(x.id)), false) }}
          fitView
          proOptions={{ hideAttribution: true }}
          colorMode={flowProps.colorMode}
          selectionMode={flowProps.selectionMode as SelectionMode}
          selectNodesOnDrag={flowProps.selectNodesOnDrag}
          elevateNodesOnSelect={flowProps.elevateNodesOnSelect}
          elevateEdgesOnSelect={flowProps.elevateEdgesOnSelect}
          paneClickDistance={flowProps.paneClickDistance}
          preventScrolling={flowProps.preventScrolling}
          selectionOnDrag={flowProps.selectionOnDrag}
          panOnDrag={flowProps.panOnDrag}
          panOnScroll={flowProps.panOnScroll}
          panOnScrollSpeed={flowProps.panOnScrollSpeed}
          panOnScrollMode={flowProps.panOnScrollMode as PanOnScrollMode}
          zoomOnScroll={flowProps.zoomOnScroll}
          zoomOnPinch={flowProps.zoomOnPinch}
          zoomOnDoubleClick={flowProps.zoomOnDoubleClick}
          nodesDraggable={flowProps.nodesDraggable}
          nodeDragThreshold={flowProps.nodeDragThreshold}
          nodesConnectable={flowProps.nodesConnectable}
          elementsSelectable={flowProps.elementsSelectable}
          autoPanOnConnect={flowProps.autoPanOnConnect}
          autoPanOnNodeDrag={flowProps.autoPanOnNodeDrag}
          autoPanSpeed={flowProps.autoPanSpeed}
          minZoom={flowProps.minZoom}
          maxZoom={flowProps.maxZoom}
          onlyRenderVisibleElements={flowProps.onlyRenderVisibleElements}
          snapToGrid={flowProps.snapToGrid}
          snapGrid={[flowProps.snapGridX || 1, flowProps.snapGridY || 1]}
          connectionMode={flowProps.connectionMode as ConnectionMode}
          connectionRadius={flowProps.connectionRadius}
          connectionLineType={flowProps.connectionLineType as ConnectionLineType}
          connectOnClick={flowProps.connectOnClick}
          nodesFocusable={flowProps.nodesFocusable}
          edgesFocusable={flowProps.edgesFocusable}
          deleteKeyCode={flowProps.deleteKeyCode || null}
          selectionKeyCode={flowProps.selectionKeyCode || null}
          multiSelectionKeyCode={flowProps.multiSelectionKeyCode || null}
          zoomActivationKeyCode={flowProps.zoomActivationKeyCode || null}
          panActivationKeyCode={flowProps.panActivationKeyCode || null}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#94a3b8" />
          <Controls showInteractive={false} />
          <Panel position="top-left" className="pointer-events-none !right-0 flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-wrap items-start gap-2">
            <div className={cn(GROUP_BAR, "hidden lg:flex")}>
              <button className={PILL_ICON} onClick={toggleRail} aria-label={railOpen ? "Hide the rail" : "Show the rail"} title={railOpen ? "Hide the rail" : "Show the rail"}>
                {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            </div>
            {admin && (
              <div className={GROUP_BAR}>
                {(["networks", "recipes"] as const).map((m) => (
                  <button key={m} onClick={() => enterMode(m)} aria-pressed={mode === m} className={cn("h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors", mode === m ? "bg-pax2-lavender text-pax2-blue" : "text-slate-500 hover:text-pax2-blue")}>
                    {m === "networks" ? "Networks" : "Recipes"}
                  </button>
                ))}
              </div>
            )}
            {mode === "networks" && <div className="relative">
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
            </div>}
            </div>
            <div className="pointer-events-auto ml-auto flex flex-col items-end gap-2">
              <div className={cn(GROUP_BAR, "flex-wrap justify-end")}>
                {mode === "recipes" ? <>
                {canvas?.name === "Loops" && (
                  <button className={PILL} onClick={playLoop} disabled={playingLoop}>
                    {playingLoop ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Play
                  </button>
                )}
                {RECIPE_TOOLS.map(([type, label]) => (
                  <button key={type} className={PILL} onClick={() => addRecipeNode(type)}><Plus className="h-3.5 w-3.5" /> {label}</button>
                ))}
                </> : <>
                <button className={PILL} onClick={() => addPromptNode(paneCenter())}><Plus className="h-3.5 w-3.5" /> Prompt</button>
                <button className={PILL} onClick={runAll} disabled={!hasPrompts || !!running}>
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run
                </button>
                </>}
                <button className={PILL} onClick={() => { if (!email) { toast.error("Sign in to save a canvas."); return } setSaveName(canvas?.name ?? ""); setSaveOpen(true) }}><Save className="h-3.5 w-3.5" /> Save</button>
                {mode === "networks" && runs.length > 0 && (
                  <button className={PILL_ICON} aria-label="Run history" title="Run history" onClick={() => { setTraceOpen(runs[0].id); setTraceStep(null); setSelectedKey(null); setEdgeInfo(null) }}>
                    <History className="h-4 w-4" />
                  </button>
                )}
                <button className={cn(PILL_ICON, settingsOpen && "border-pax2-blue bg-slate-50")} aria-pressed={settingsOpen} aria-label="Canvas settings" title="Canvas settings" onClick={() => setSettingsOpen((v) => !v)}>
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
              {mode === "networks" && <div className={cn(GROUP_BAR, "pl-3")}>
                <span className="text-xs text-slate-500">Join on select</span>
                {(["channel", "group", "topic", "tag"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setJoinKinds((j) => ({ ...j, [k]: !j[k] }))}
                    className={cn("h-7 rounded-full px-3 text-xs font-semibold transition-colors", joinKinds[k] ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-400")}
                  >
                    {k}
                  </button>
                ))}
              </div>}
            </div>
          </Panel>
        </ReactFlow>
        <ChatDock context={canvasContext} open={dockOpen} onOpenChange={setDockOpen} attached={attached} onAttach={setAttached} />
      </div>

      {settingsOpen && (
        <FlowSettingsPanel
          value={flowProps}
          onChange={setFlowProps}
          dataset={dataset}
          onDataset={applyDataset}
          datasets={datasets.map(({ id, label }) => ({ id, label }))}
          layoutMode={layoutMode}
          onLayoutMode={changeLayoutMode}
          onClose={() => setSettingsOpen(false)}
          onReset={() => setFlowProps(DEFAULT_FLOW_PROPS)}
        />
      )}
      {!settingsOpen && sel && isRecipeType(sel.type) && (
        <div className={SIDE}>
          <SideHeader badge={RECIPE_LABEL[sel.type]} onClose={() => setSelectedKey(null)} />
          <RecipeForm
            key={keyOf(sel)}
            type={sel.type}
            values={sel.r ?? {}}
            onFocus={snapshot}
            onChange={(field, value) => editRecipe(keyOf(sel), field, value)}
            onDelete={() => { removeNode(keyOf(sel)); setSelectedKey(null) }}
          />
        </div>
      )}
      {!settingsOpen && sel && sel.type !== "more" && !isRecipeType(sel.type) && (
        <div className={SIDE}>
          <SideHeader badge={sel.type} onClose={() => setSelectedKey(null)} />
          {sel.type === "prompt" ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-900">{sel.output || sel.prompt || ""}</p>
          ) : (
            <>
              <h2 draggable onDragStart={(e) => setDragEntity(e.dataTransfer, sel)} className="cursor-grab text-sm font-semibold leading-snug text-slate-900">
                {sel.type === "video" ? <a href={`/v/yt-${sel.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-pax2-light-blue">{sel.label}</a> : sel.label}
              </h2>
              {sel.type === "file" ? (
                <>
                  <Field k="File" v={sel.sub} />
                  {sel.fileText && <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-pax2-mist p-2 text-[10px] leading-snug text-slate-700">{sel.fileText}</pre>}
                </>
              ) : (
                <DetailBody
                  g={sel}
                  R={R}
                  data={data}
                  onCanvas={(g, rel) => expand(g, rel)}
                  onWired={(from, item) => { if (store.current.has(keyOf(item))) toast.info(`${item.label} is already on the canvas`); else addNodes([item], keyOf(from)) }}
                />
              )}
            </>
          )}
        </div>
      )}
      {!settingsOpen && !sel && edgeInfo && (() => {
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
      {!settingsOpen && !sel && !edgeInfo && run && (() => {
        const step = traceStep != null ? run.steps[traceStep] : null
        return (
          <div className={SIDE}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={BADGE}>run</span>
              {runs.length > 1 && (
                <select value={run.id} onChange={(e) => { setTraceOpen(e.target.value); setTraceStep(null) }} className="h-6 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-600">
                  {runs.map((r) => <option key={r.id} value={r.id}>{new Date(r.startedAt).toLocaleTimeString()} · {r.label}</option>)}
                </select>
              )}
              <button onClick={() => setTraceOpen(null)} className="text-slate-400 hover:text-slate-900" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <h2 className="text-sm font-semibold text-slate-900">{run.label}</h2>
            <p className="tabular mt-0.5 text-[10px] text-slate-500">{new Date(run.startedAt).toLocaleString()} · {run.finishedAt ? `${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s` : "running"}</p>
            <div className="mt-3 space-y-0.5">
              {run.steps.map((s, i) => (
                <button key={`${s.key}-${i}`} onClick={() => setTraceStep(traceStep === i ? null : i)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50", traceStep === i && "bg-slate-50")}>
                  {s.status === "running" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                    : s.status === "done" ? <Check className="h-3.5 w-3.5 shrink-0 text-pax2-light-blue" />
                    : s.status === "skipped" ? <Minus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    : <X className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                  <span className={cn("truncate", s.status === "skipped" ? "text-slate-400" : "text-slate-900")}>{s.prompt || "Empty prompt"}</span>
                  {s.status === "skipped" ? <span className="ml-auto shrink-0 text-[10px] text-slate-400">skipped</span> : s.ms != null && <span className="tabular ml-auto shrink-0 text-[10px] text-slate-500">{(s.ms / 1000).toFixed(1)}s</span>}
                </button>
              ))}
            </div>
            {step && (
              <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                {step.error && <p className="text-xs text-red-600">{step.error}</p>}
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Input context</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-pax2-mist p-2 text-[10px] leading-snug text-slate-600">{step.input || "None wired"}</pre>
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Output</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-pax2-mist p-2 text-[10px] leading-snug text-slate-900">{step.output || "None"}</pre>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogTitle>{canvas?.id ? "Save a new version" : "Save the canvas"}</DialogTitle>
          <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex flex-col gap-3">
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name" autoFocus className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-pax2-light-blue" />
            <button type="submit" disabled={!saveName.trim() || saving} className={whiteButton("md")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</button>
          </form>
        </DialogContent>
      </Dialog>
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
