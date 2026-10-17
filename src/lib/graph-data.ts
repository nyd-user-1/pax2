// The /graph dataset as the client holds it: channels and videos from patternsData(), shaped by
// src/app/graph/page.tsx. Everything the canvas computes (relations, joins, similarity, the chat's
// context) is computed from this, in the browser.

export type GraphChannel = { id: string; name: string; group: string; subs: number | null; median: number | null; n: number; pushed: number; killed: number }
export type GraphVideo = {
  id: string
  title: string
  channelId: string
  channel: string
  published: string
  ratio: number | null
  tier: "breakout" | "baseline" | "killed"
  views: number
  likes: number | null
  comments: number | null
  durationSec: number | null
  tags: string[]
  topics: string[]
}
export type GraphData = { channels: GraphChannel[]; videos: GraphVideo[]; start: string; readings: number }

/* ── similarity ──────────────────────────────────────────────────────────────
 * Jaccard overlap of each video's lowercased tags and topics. An inference, never a record.
 * The canvas only calls similarTo(), so an encoder's cosine can replace the body later. */

const tokenCache = new WeakMap<GraphVideo, Set<string>>()
const tokens = (v: GraphVideo) => {
  let s = tokenCache.get(v)
  if (!s) tokenCache.set(v, (s = new Set([...v.tags, ...v.topics].map((t) => t.toLowerCase()))))
  return s
}

export function similarTo(video: GraphVideo, pool: GraphVideo[], k = 6): { id: string; score: number }[] {
  const a = tokens(video)
  if (!a.size) return []
  const out: { id: string; score: number }[] = []
  for (const v of pool) {
    if (v.id === video.id) continue
    const b = tokens(v)
    let both = 0
    for (const t of b) if (a.has(t)) both += 1
    if (!both) continue
    out.push({ id: v.id, score: both / (a.size + b.size - both) })
  }
  return out.sort((x, y) => y.score - x.score).slice(0, k)
}

/* ── saved canvases ──────────────────────────────────────────────────────────
 * A view or recipe as the ledger keeps it. A state holding any recipe node is a recipe. */

export const RECIPE_TYPES = ["ingredient", "step", "model", "output"] as const
export type RecipeType = (typeof RECIPE_TYPES)[number]
export const isRecipeType = (t: string): t is RecipeType => (RECIPE_TYPES as readonly string[]).includes(t)

export type SavedNode = {
  type: string
  id: string
  label: string
  sub?: string
  tier?: GraphVideo["tier"]
  prompt?: string
  output?: string
  fileKey?: string
  fileText?: string
  openGroups?: string[]
  /** Recipe nodes: their fields. */
  r?: Record<string, string>
  x: number
  y: number
}
export type SavedEdge = { s: string; t: string; k?: "similar" | "wired" | "drawn"; score?: number; by?: string; at?: string }
export type CanvasState = { nodes: SavedNode[]; edges: SavedEdge[] }
export type CanvasKind = "view" | "recipe"
export type CanvasRow = { id: string; name: string; by: string; kind: CanvasKind; at: string; nodes: number }
export const canvasKind = (s: CanvasState): CanvasKind => (s.nodes.some((n) => isRecipeType(n.type)) ? "recipe" : "view")
