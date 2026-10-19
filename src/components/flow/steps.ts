import dagre from "@dagrejs/dagre"
import { AudioLines, Captions, Clapperboard, Gauge, LayoutTemplate, Music, NotebookPen, Radio, Rocket, Send, Video, type LucideIcon } from "lucide-react"

// The flow's vocabulary: PAX2's production steps, each naming the page that runs it today.
// Keys are stored in saved flows (localStorage "pax2:flows"), so they never change meaning.

export type StepKey = "outliers" | "script" | "record" | "voice" | "sound" | "captions" | "endcard" | "render" | "score" | "publish" | "track"
export type Category = "Source" | "Produce" | "Measure" | "Publish"

export const CATEGORIES: Category[] = ["Source", "Produce", "Measure", "Publish"]

export const STEP: Record<StepKey, { name: string; makes: string; href: string; page: string; category: Category; icon: LucideIcon }> = {
  outliers: { name: "Outliers", makes: "The catalog's Hits to model a short on", href: "/tracking?tab=settled", page: "Tracking", category: "Source", icon: Rocket },
  script: { name: "Script", makes: "A draft on one of the library's structures", href: "/scripts", page: "Scripts", category: "Source", icon: NotebookPen },
  record: { name: "Record", makes: "A camera take, paced by the teleprompter", href: "/recording", page: "Recording", category: "Source", icon: Video },
  voice: { name: "Voice", makes: "A read with word timings, ElevenLabs or Amazon Polly", href: "/recording", page: "Recording", category: "Produce", icon: AudioLines },
  sound: { name: "Sound bed", makes: "A music bed under the read", href: "/recording", page: "Recording", category: "Produce", icon: Music },
  captions: { name: "Captions", makes: "Word-timed captions from the transcript", href: "/recording", page: "Recording", category: "Produce", icon: Captions },
  endcard: { name: "End card", makes: "The hook and end cards over the take", href: "/recording", page: "Recording", category: "Produce", icon: LayoutTemplate },
  render: { name: "Render", makes: "The finished short, rendered in the browser", href: "/recording", page: "Recording", category: "Produce", icon: Clapperboard },
  score: { name: "Score", makes: "The pre-publish forecast and its recommendations", href: "/my-videos?q=scoring", page: "My videos", category: "Measure", icon: Gauge },
  publish: { name: "Publish", makes: "The upload to the connected channel on approval", href: "/my-videos?q=publishing", page: "My videos", category: "Publish", icon: Send },
  track: { name: "Track", makes: "The poller's watch and the live Hit call", href: "/tracking", page: "Tracking", category: "Measure", icon: Radio },
}

export const STEP_KEYS = Object.keys(STEP) as StepKey[]

export const TEMPLATES: { name: string; steps: StepKey[] }[] = [
  { name: "Script to published short", steps: ["script", "voice", "sound", "captions", "endcard", "render", "score", "publish", "track"] },
  { name: "Camera take to published short", steps: ["record", "captions", "score", "publish", "track"] },
  { name: "Outlier to new script", steps: ["outliers", "script", "score"] },
]

export type SavedNode = { id: string; step: StepKey; x: number; y: number }
export type SavedEdge = { s: string; t: string }
export type SavedFlow = { id: string; name: string; nodes: SavedNode[]; edges: SavedEdge[]; updatedAt: string }

const KEY = "pax2:flows"

export const readFlows = (): SavedFlow[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(v) ? (v as SavedFlow[]).filter((f) => f && f.id && Array.isArray(f.nodes)) : []
  } catch {
    return []
  }
}

export const writeFlows = (flows: SavedFlow[]) => window.localStorage.setItem(KEY, JSON.stringify(flows))

export const saveFlow = (flow: SavedFlow) => writeFlows([flow, ...readFlows().filter((f) => f.id !== flow.id)])

export const deleteFlow = (id: string) => writeFlows(readFlows().filter((f) => f.id !== id))

export const NODE_W = 230
export const NODE_H = 112

/** A left-to-right dagre pass over any node and edge set; returns new positions by node id. */
export function tidy(nodes: { id: string }[], edges: SavedEdge[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 72 })
  g.setDefaultEdgeLabel(() => ({}))
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => {
    if (g.hasNode(e.s) && g.hasNode(e.t)) g.setEdge(e.s, e.t)
  })
  dagre.layout(g)
  return new Map(nodes.map((n) => [n.id, { x: g.node(n.id).x - NODE_W / 2, y: g.node(n.id).y - NODE_H / 2 }]))
}

/** A fresh flow from a template's linear chain, laid out and ready to save. */
export function fromTemplate(name: string, steps: StepKey[]): SavedFlow {
  const nodes = steps.map((step, i) => ({ id: `n${i}`, step, x: 0, y: 0 }))
  const edges = steps.slice(1).map((_, i) => ({ s: `n${i}`, t: `n${i + 1}` }))
  const pos = tidy(nodes, edges)
  return {
    id: `f${Date.now()}`,
    name,
    nodes: nodes.map((n) => ({ ...n, ...pos.get(n.id)! })),
    edges,
    updatedAt: new Date().toISOString(),
  }
}
