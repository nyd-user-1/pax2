import type { GraphData } from "@/lib/graph-data"

// One drag payload for the /graph workspace: canvas cards, rail rows, search hits and the detail
// panel's title all set `application/pax2-entity`; the canvas (add at the drop point) and the chat
// dock (attach as context) both read it.

export const ENTITY_MIME = "application/pax2-entity"

export type DragEntity = {
  type: string
  id: string
  label: string
  sub?: string
  tier?: "breakout" | "baseline" | "killed"
  prompt?: string
  output?: string
  fileKey?: string
  fileText?: string
  r?: Record<string, string>
}

export function setDragEntity(dt: DataTransfer, g: DragEntity) {
  const payload: DragEntity = { type: g.type, id: g.id, label: g.label, sub: g.sub, tier: g.tier, prompt: g.prompt, fileKey: g.fileKey, fileText: g.fileText, r: g.r }
  dt.setData(ENTITY_MIME, JSON.stringify(payload))
  dt.setData("text/plain", `${g.type} ${g.label}`)
  dt.effectAllowed = "copy"
}

export function readDragEntity(dt: DataTransfer | null): DragEntity | null {
  if (!dt) return null
  try {
    const raw = dt.getData(ENTITY_MIME)
    if (!raw) return null
    const g = JSON.parse(raw)
    return g && typeof g.type === "string" && typeof g.id === "string" ? (g as DragEntity) : null
  } catch {
    return null
  }
}

const n = (x: number | null | undefined) => (x == null ? "unknown" : x.toLocaleString("en-US"))
const ratio = (r: number | null) => (r == null ? "no ratio" : `${r.toFixed(1)}x the channel's median`)

/** The record behind an entity, as a plain-text paragraph for the chat's system context. */
export function describeEntity(g: DragEntity | null, data: GraphData): string {
  if (!g) return ""
  if (g.type === "video") {
    const v = data.videos.find((x) => x.id === g.id)
    if (!v) return `VIDEO ${g.label}`
    return [
      `VIDEO "${v.title}" (link: /v/yt-${v.id})`,
      `Channel: ${v.channel}. Published ${v.published.slice(0, 10)}.${v.durationSec != null ? ` Length ${v.durationSec}s.` : ""}`,
      `Views ${n(v.views)}, likes ${n(v.likes)}, comments ${n(v.comments)}; ${ratio(v.ratio)}, tier ${v.tier}.`,
      v.tags.length ? `Tags: ${v.tags.join(", ")}.` : "No tags.",
      v.topics.length ? `Topics: ${v.topics.join(", ")}.` : "No topics.",
    ].join("\n")
  }
  if (g.type === "channel") {
    const c = data.channels.find((x) => x.id === g.id)
    if (!c) return `CHANNEL ${g.label}`
    const top = data.videos.filter((v) => v.channelId === c.id).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).slice(0, 5)
    return [
      `CHANNEL ${c.name}, group ${c.group}. Subscribers ${n(c.subs)}; median views ${n(c.median)}.`,
      `${c.n} tracked videos: ${c.pushed} above 3x the median, ${c.killed} killed.`,
      top.length ? `Top videos by ratio:\n${top.map((v) => `- "${v.title}" (/v/yt-${v.id}): ${ratio(v.ratio)}, ${n(v.views)} views`).join("\n")}` : "",
    ].filter(Boolean).join("\n")
  }
  if (g.type === "tag" || g.type === "topic") {
    const vs = data.videos.filter((v) => (g.type === "tag" ? v.tags.some((t) => t.toLowerCase() === g.id) : v.topics.includes(g.id)))
    const top = [...vs].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).slice(0, 5)
    const breakouts = vs.filter((v) => v.tier === "breakout").length
    return [
      `${g.type.toUpperCase()} "${g.label}": on ${vs.length} tracked videos, ${breakouts} of them breakouts.`,
      top.length ? `Top videos by ratio:\n${top.map((v) => `- "${v.title}" (/v/yt-${v.id}), ${v.channel}: ${ratio(v.ratio)}`).join("\n")}` : "",
    ].filter(Boolean).join("\n")
  }
  if (g.type === "group") {
    const cs = data.channels.filter((c) => c.group === g.id)
    return `GROUP ${g.label}: ${cs.length} channels: ${cs.map((c) => `${c.name} (${c.n} tracked, ${c.pushed} above 3x)`).join("; ")}.`
  }
  if (g.type === "file") return `FILE ${g.label}${g.fileText ? `:\n${g.fileText.slice(0, 4000)}` : " (binary; referenced by name)"}`
  if (g.type === "prompt") return `PROMPT STEP: ${g.prompt ?? ""}${g.output ? `\nIts last output:\n${g.output.slice(0, 3000)}` : ""}`
  if (g.r) return `${g.type.toUpperCase()} "${g.label}" in a model recipe:\n${Object.entries(g.r).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
  return `${g.type.toUpperCase()} ${g.label}${g.sub ? ` (${g.sub})` : ""}`
}
