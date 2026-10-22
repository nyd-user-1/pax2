import "server-only"

import fs from "node:fs"
import path from "node:path"

// The video page's measured reads, each from its own artifact, read from disk once:
//   data/generated/video-reads.json            craft templates and topic clusters (scripts/video-reads.mjs)
//   data/generated/model/winning-modes.json    the winning modes and each short's mode-match score
//   data/generated/model/resonance-formula.json the fitted Resonance stack, absent until it is fitted
// A missing artifact reads as null, and the block that needs it renders its empty state.

type Reads = { builtAt: string; axes: string[]; templates: Record<string, number[]>; topic: Record<string, number> }
export type Mode = { id: number; name: string; center: Record<string, number>; survived: boolean; heldOut: { lift: number; base: number } }
type Modes = { builtAt: string; definition: string; axes: Record<string, { label: string; group: string }>; full: { axes: string[]; modes: Mode[] }; scores: Record<string, number> }
/** The shape the fitted stack is expected to write: each short's pre-release score, and the measured
 *  post-release score once its 72-hour window completes. */
export type Formula = { builtAt: string; scores: Record<string, { pre: number; post?: number }> }

const at = (p: string) => path.join(process.cwd(), p)
const load = <T,>(p: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(at(p), "utf8")) as T
  } catch {
    return null
  }
}

let _reads: Reads | null | undefined
let _modes: Modes | null | undefined
let _formula: Formula | null | undefined
const reads = () => (_reads === undefined ? (_reads = load<Reads>("data/generated/video-reads.json")) : _reads)
const modes = () => (_modes === undefined ? (_modes = load<Modes>("data/generated/model/winning-modes.json")) : _modes)
// Not cached when absent, so the gauge appears the moment the file lands.
const formula = () => (_formula ? _formula : (_formula = load<Formula>("data/generated/model/resonance-formula.json")))

/** The short's craft template: axis key to within-channel percentile, 0 to 100. */
export function craftTemplate(ytId: string): Record<string, number> | null {
  const r = reads()
  const t = r?.templates[ytId]
  return r && t ? Object.fromEntries(r.axes.map((a, i) => [a, t[i]])) : null
}

export function topicOf(ytId: string): number | null {
  return reads()?.topic[ytId] ?? null
}

export function axisLabel(key: string): string {
  return modes()?.axes[key]?.label ?? key
}

/** The mode-match read: the short's score against the surviving mode, from the artifact. */
export function modeMatch(ytId: string): { score: number; mode: Mode; axes: string[] } | null {
  const m = modes()
  const score = m?.scores[ytId]
  const mode = m?.full.modes.find((x) => x.survived)
  return m && score != null && mode ? { score, mode, axes: m.full.axes } : null
}

export function resonanceScore(ytId: string): { pre: number; post?: number } | null {
  return formula()?.scores?.[ytId] ?? null
}

type Stages = { order: string[]; ids: Record<string, string> }
let _stages: Stages | null | undefined
const stages = () => (_stages === undefined ? (_stages = load<Stages>("data/generated/lab-stages.json")) : _stages)

/** Which of the Lab's file-measured stages exist for the short (lab-stages.json, scripts/accounting.mjs). */
export function measured(ytId: string): Record<"cuts" | "loudness" | "text" | "transcript" | "index", boolean> {
  const s = stages()
  const bits = s?.ids[ytId] ?? ""
  const has = (k: string) => bits[s?.order.indexOf(k) ?? -1] === "1"
  return { cuts: has("cuts"), loudness: has("loudness"), text: has("text"), transcript: has("transcript"), index: has("index") }
}

/** The actions that unlock a fuller Resonance read, one per missing component (docs/RESONANCE.md). */
export function unlockActions(ytId: string): { what: string; href?: string }[] {
  const m = measured(ytId)
  const out: { what: string; href?: string }[] = []
  if (!m.cuts) out.push({ what: "Run the flask: the craft rank needs the file measured", href: `/lab/${ytId}` })
  if (!m.transcript) out.push({ what: "Add captions: the outlier classifier's fuller arm reads the transcript" })
  if (!m.index) out.push({ what: "Embed the transcript: the fuller arm also needs the serving-index embedding" })
  return out
}
