"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Background, Controls, Handle, Panel, Position, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react"
import dagre from "@dagrejs/dagre"
import { ArrowLeft, Boxes, Clapperboard, Hash, Loader2, Search, Tv, Users } from "lucide-react"

import { fmtCompact } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

// The connections canvas, on NSR's /graph workspace pattern: a catalog rail on the left, typed
// entity cards on a dagre-laid canvas, paged "+N more" supernodes for honest overflow, and a
// receipt for every edge saying which record joins the two. Every relation here is one we hold:
// channel-published-video, the uploader's tags, YouTube's topic annotations, channel groups.

export type GraphChannel = { id: string; name: string; group: string; subs: number | null; n: number; pushed: number }
export type GraphVideo = { id: string; title: string; channelId: string; channel: string; ratio: number | null; tier: "breakout" | "baseline" | "killed"; views: number; tags: string[]; topics: string[] }
export type GraphData = { channels: GraphChannel[]; videos: GraphVideo[] }

type GNode = { type: "channel" | "video" | "tag" | "topic" | "group" | "more"; id: string; label: string; sub?: string; tier?: GraphVideo["tier"]; parentKey?: string; rel?: string }
const keyOf = (n: { type: string; id: string }) => `${n.type}:${n.id}`
const rx = (r: number) => `${(r >= 10 ? r.toFixed(0) : r.toFixed(1)).replace(/^0\./, ".")}x`
const TIER_COLOR = { breakout: "#16a34a", baseline: "#94a3b8", killed: "#dc2626" } as const

const NODE_W: Record<GNode["type"], number> = { channel: 210, video: 240, tag: 150, topic: 160, group: 170, more: 130 }
const PAGE = 8

/* ── relations, computed from the dataset we ship ────────────────────────── */

function useRelations(data: GraphData) {
  return useMemo(() => {
    const byChannel = new Map<string, GraphVideo[]>()
    const byTag = new Map<string, GraphVideo[]>()
    const byTopic = new Map<string, GraphVideo[]>()
    const byGroup = new Map<string, GraphChannel[]>()
    for (const v of data.videos) {
      byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v])
      for (const t of v.tags) byTag.set(t.toLowerCase(), [...(byTag.get(t.toLowerCase()) ?? []), v])
      for (const t of v.topics) byTopic.set(t, [...(byTopic.get(t) ?? []), v])
    }
    for (const c of data.channels) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c])
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

/** What this node can pull onto the canvas, and the full result list for each relation. */
function relationsOf(g: GNode, R: Rels): { rel: string; label: string; items: GNode[] }[] {
  if (g.type === "channel") {
    const vs = [...(R.byChannel.get(g.id) ?? [])].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    const topics = [...(R.channelTopics.get(g.id) ?? new Map())].sort((a, b) => b[1] - a[1])
    const c = R.channel.get(g.id)
    return [
      { rel: "videos", label: "videos", items: vs.map(videoNode) },
      { rel: "topics", label: "topics", items: topics.map(([t]) => topicNode(t, R.byTopic.get(t)?.length ?? 0)) },
      ...(c ? [{ rel: "group", label: "group", items: [groupNode(c.group, R.byGroup.get(c.group)?.length ?? 0)] }] : []),
    ]
  }
  if (g.type === "video") {
    const v = R.video.get(g.id)
    if (!v) return []
    const c = R.channel.get(v.channelId)
    return [
      ...(c ? [{ rel: "channel", label: "channel", items: [channelNode(c)] }] : []),
      { rel: "tags", label: "tags", items: v.tags.map((t) => tagNode(t, R.byTag.get(t.toLowerCase())?.length ?? 0)) },
      { rel: "topics", label: "topics", items: v.topics.map((t) => topicNode(t, R.byTopic.get(t)?.length ?? 0)) },
    ]
  }
  if (g.type === "tag") return [{ rel: "videos", label: "videos", items: (R.byTag.get(g.id) ?? []).map(videoNode) }]
  if (g.type === "topic") {
    const vs = R.byTopic.get(g.id) ?? []
    const chIds = [...new Set(vs.map((v) => v.channelId))]
    return [
      { rel: "videos", label: "videos", items: [...vs].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).map(videoNode) },
      { rel: "channels", label: "channels", items: chIds.map((id) => R.channel.get(id)).filter(Boolean).map((c) => channelNode(c!)) },
    ]
  }
  if (g.type === "group") return [{ rel: "channels", label: "channels", items: (R.byGroup.get(g.id) ?? []).map(channelNode) }]
  return []
}

/** The record behind an edge — every one is data we hold, named plainly. */
function receipt(a: GNode, b: GNode): string {
  const pair = (t1: GNode["type"], t2: GNode["type"]) => (a.type === t1 && b.type === t2) || (a.type === t2 && b.type === t1)
  const of = (t: GNode["type"]) => (a.type === t ? a : b)
  if (pair("channel", "video")) return `${of("channel").label} published ${of("video").label} — the poller's own record.`
  if (pair("video", "tag")) return `The uploader tagged ${of("video").label} "${of("tag").label}" — from the video's metadata.`
  if (pair("video", "topic")) return `YouTube annotates ${of("video").label} with the topic ${of("topic").label}.`
  if (pair("channel", "topic")) return `${of("channel").label}'s tracked videos carry the topic ${of("topic").label}.`
  if (pair("channel", "group")) return `${of("channel").label} sits in the ${of("group").label} group of channels.json.`
  if (a.type === "more" || b.type === "more") return "Overflow marker — the honest remainder of a paged expansion. Click it to load the next page."
  return "Relation from the tracked dataset."
}

/* ── layout ──────────────────────────────────────────────────────────────── */

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { width: NODE_W[(n.data as GNode).type] ?? 160, height: (n.data as GNode).type === "video" ? 78 : 64 })
  for (const e of edges) g.setEdge(e.source, e.target)
  dagre.layout(g)
  return nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } }
  })
}

/* ── node card ───────────────────────────────────────────────────────────── */

type EntityData = GNode & {
  onExpand: (node: GNode, rel: string) => void
  onMore: (parentKey: string, rel: string) => void
  expanded: Record<string, { loaded: number; total: number }>
  expanding: string | null
} & Record<string, unknown>

const CARD = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-e1"
const ICON: Record<string, React.ElementType> = { channel: Tv, video: Clapperboard, tag: Hash, topic: Boxes, group: Users }

function EntityNode({ data, selected }: NodeProps<Node<EntityData>>) {
  const d = data
  if (d.type === "more")
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (d.parentKey && d.rel) d.onMore(d.parentKey, d.rel) }}
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        style={{ width: NODE_W.more, height: 40 }}
        title="Load the next page"
      >
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-300" />
        {d.expanding ? <Loader2 className="h-3 w-3 animate-spin" /> : d.label}
      </button>
    )
  const Icon = ICON[d.type]
  return (
    <div className={cn(CARD, selected && "border-hermes-plum ring-1 ring-hermes-plum")} style={{ width: NODE_W[d.type], borderLeftWidth: d.type === "video" ? 3 : undefined, borderLeftColor: d.type === "video" && d.tier ? TIER_COLOR[d.tier] : undefined }}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      <p className="flex items-start gap-1.5">
        <Icon className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
        {d.type === "video" ? (
          <Link href={`/v/yt-${d.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 font-semibold leading-snug text-slate-900 hover:text-hermes-plum">{d.label}</Link>
        ) : (
          <span className="line-clamp-2 font-semibold leading-snug text-slate-900">{d.label}</span>
        )}
      </p>
      {d.sub && <p className="tabular mt-0.5 truncate text-[10px] text-slate-500">{d.sub}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(d.rels as { rel: string; label: string; total: number }[]).map(({ rel, label, total }) => {
          const st = d.expanded[`${keyOf(d)}|${rel}`]
          const busy = d.expanding === `${keyOf(d)}|${rel}`
          return (
            <button
              key={rel}
              onClick={(e) => { e.stopPropagation(); d.onExpand(d, rel) }}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              title={st ? `${st.loaded} of ${st.total} on canvas` : `expand ${label}`}
            >
              {busy ? <Loader2 className="inline h-2.5 w-2.5 animate-spin" /> : st ? `${label} ${st.loaded}/${st.total}` : `+ ${label} ${total}`}
            </button>
          )
        })}
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
  if (key === "tags") return [...R.byTag.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, vs]) => tagNode(t, vs.length))
  if (key === "topics") return [...R.byTopic.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, vs]) => topicNode(t, vs.length))
  return [...R.byGroup.entries()].sort((a, b) => b[1].length - a[1].length).map(([g, cs]) => groupNode(g, cs.length))
}

/* ── the canvas ──────────────────────────────────────────────────────────── */

function VideoGraphInner({ data }: { data: GraphData }) {
  const R = useRelations(data)
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])
  const store = useRef(new Map<string, GNode>())
  const expandState = useRef(new Map<string, { loaded: number; total: number }>())
  const [expanding] = useState<string | null>(null)
  const [edgeInfo, setEdgeInfo] = useState<string | null>(null)
  const [browse, setBrowse] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [q, setQ] = useState("")

  const dataFor = useCallback((g: GNode): EntityData => ({
    ...g,
    rels: relationsOf(g, R).map((r) => ({ rel: r.rel, label: r.label, total: r.items.length })),
    onExpand: (node: GNode, rel: string) => expand(node, rel),
    onMore: (parentKey: string, rel: string) => {
      const parent = store.current.get(parentKey)
      if (parent) expand(parent, rel)
    },
    expanded: Object.fromEntries(expandState.current),
    expanding,
  }) as EntityData, [R, expanding]) // eslint-disable-line react-hooks/exhaustive-deps

  const sync = useCallback((allEdges: Edge[]) => {
    setNodes((prev) => {
      const next: Node[] = [...store.current.values()].map((g) => ({
        id: keyOf(g), type: "entity", position: prev.find((n) => n.id === keyOf(g))?.position ?? { x: 0, y: 0 }, data: dataFor(g),
      }))
      return layout(next, allEdges)
    })
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60)
  }, [setNodes, dataFor, fitView])

  const addNodes = useCallback((items: GNode[], from?: string) => {
    for (const it of items) store.current.set(keyOf(it), it)
    setEdges((prev) => {
      const have = new Set(prev.map((e) => e.id))
      const added: Edge[] = from
        ? items.filter((it) => !have.has(`${from}->${keyOf(it)}`) && !have.has(`${keyOf(it)}->${from}`)).map((it) => ({ id: `${from}->${keyOf(it)}`, source: from, target: keyOf(it) }))
        : []
      const all = [...prev, ...added]
      sync(all)
      return all
    })
  }, [setEdges, sync])

  const removeNode = useCallback((key: string) => {
    if (!store.current.delete(key)) return
    setEdges((prev) => {
      const all = prev.filter((e) => e.source !== key && e.target !== key)
      sync(all)
      return all
    })
  }, [setEdges, sync])

  const expand = useCallback((node: GNode, rel: string) => {
    const r = relationsOf(node, R).find((x) => x.rel === rel)
    if (!r) return
    const k = `${keyOf(node)}|${rel}`
    const st = expandState.current.get(k)
    const offset = st?.loaded ?? 0
    if (st && st.loaded >= st.total) return
    const page = r.items.slice(offset, offset + PAGE)
    const loaded = offset + page.length
    expandState.current.set(k, { loaded, total: r.items.length })
    addNodes(page, keyOf(node))
    const moreKey = `more:${k}`
    if (loaded < r.items.length) addNodes([{ type: "more", id: k, label: `+${(r.items.length - loaded).toLocaleString()} more`, parentKey: keyOf(node), rel }], keyOf(node))
    else if (store.current.has(moreKey)) removeNode(moreKey)
  }, [R, addNodes, removeNode]) // eslint-disable-line react-hooks/exhaustive-deps

  const seed = useCallback((g: GNode) => {
    addNodes([g])
    setBrowse(null)
    setQ("")
  }, [addNodes])

  const everything = useMemo(() => [...railItems("channels", R), ...railItems("videos", R), ...railItems("tags", R), ...railItems("topics", R)], [R])
  const results = q.trim().length >= 2 ? everything.filter((g) => `${g.label} ${g.sub ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12) : []

  return (
    <div className="flex min-h-0 flex-1">
      {/* rail */}
      <div className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        {browse == null ? (
          <>
            <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-wide text-slate-400">Tracked</p>
            {RAIL_TYPES.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setBrowse(key)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-900 transition-colors hover:bg-slate-50">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span>{label}</span>
                <span className="tabular ml-auto text-xs text-slate-400">{railItems(key, R).length.toLocaleString()}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 p-3">
              <button onClick={() => { setBrowse(null); setFilter("") }} className="text-slate-400 hover:text-slate-900" title="back">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-900">{RAIL_TYPES.find((t) => t.key === browse)?.label}</span>
            </div>
            <div className="border-b border-slate-200 p-2">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-hermes-plum" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {railItems(browse, R)
                .filter((g) => !filter.trim() || `${g.label} ${g.sub ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()))
                .slice(0, 200)
                .map((g) => (
                  <button key={keyOf(g)} onClick={() => seed(g)} className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50" title="add to the canvas">
                    <span className="line-clamp-2 text-xs font-semibold text-slate-900">{g.label}</span>
                    {g.sub && <span className="tabular text-[10px] text-slate-500">{g.sub}</span>}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {/* canvas */}
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgeClick={(_, e) => {
            const a = store.current.get(e.source)
            const b = store.current.get(e.target)
            if (a && b) setEdgeInfo(receipt(a, b))
          }}
          onPaneClick={() => setEdgeInfo(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { stroke: "#cbd5e1" } }}
        >
          <Background gap={18} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <Panel position="top-left">
            <div className="relative">
              <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-4 shadow-e1 ring-1 ring-slate-200">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a channel, video, tag or topic…" className="w-72 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              {results.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-1.5 max-h-80 w-96 overflow-y-auto rounded-xl bg-white py-1 shadow-e2 ring-1 ring-slate-200">
                  {results.map((g) => (
                    <button key={keyOf(g)} onClick={() => seed(g)} className="flex w-full flex-col px-3 py-1.5 text-left transition-colors hover:bg-slate-50">
                      <span className="line-clamp-1 text-xs font-semibold text-slate-900">{g.label}</span>
                      <span className="tabular text-[10px] text-slate-500">{g.type}{g.sub ? ` · ${g.sub}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          {edgeInfo && (
            <Panel position="bottom-center">
              <div className="max-w-xl rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-e2 ring-1 ring-slate-200">{edgeInfo}</div>
            </Panel>
          )}
          {nodes.length === 0 && (
            <Panel position="top-center" className="!top-1/3">
              <p className="text-sm text-slate-500">Pick a channel, tag or topic from the rail, or search, then expand its connections.</p>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  )
}

export function VideoGraph({ data }: { data: GraphData }) {
  return (
    <ReactFlowProvider>
      <VideoGraphInner data={data} />
    </ReactFlowProvider>
  )
}
