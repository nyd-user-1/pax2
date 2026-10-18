import { MEMORABLE } from "@/lib/recipes/memorable"

// The schedule behind /gantt. Requirements are Brendan's thirteen from docs/SPEC.md, each with the
// day its work began (from the commit history), the day it is planned to close, how much of it
// stands, and the next step that closes the gap. Models take their name, progress and next step
// from the Memorable recipe, the one model inventory, and add here their dates and three ratings
// on a 1 to 5 scale: importance to the loop, utility of what exists today, and ease of finishing.
// Dates are absolute; finish dates are plans, not measurements. Updated 2026-10-18.

export type Bar = {
  id: string
  name: string
  start: string
  end: string
  progress: number
  next: string
  waits?: string[]
  note?: string
  importance?: number
  utility?: number
  ease?: number
}

export const REQUIREMENTS: Bar[] = [
  { id: "1", name: "1. Record a video, or have one made", start: "2026-10-03", end: "2026-10-31", progress: 60, next: "webm to mp4 in the upload path, a Lambda with an ffmpeg layer, half a day; the Studio render after." },
  { id: "2", name: "2. Scripts", start: "2026-10-03", end: "2026-10-24", progress: 80, next: "Feed the organic lifts and the 40 coded shorts into the writer's and editor's prompts, 2 hours." },
  { id: "3", name: "3. A pre-release prediction", start: "2026-10-17", end: "2026-11-07", progress: 60, next: "PAX2 Classifier v2 with transcripts once the caption run merges, 1 hour and a 17-cent box." },
  { id: "4", name: "4. Every available factor", start: "2026-10-06", end: "2026-11-30", progress: 50, next: "The worker's replacement on the S3 upload event; velocity curves joined; audio and frames through the proxy." },
  { id: "5", name: "5. Automatic on save", start: "2026-10-10", end: "2026-11-14", progress: 50, next: "The S3 upload event starts the analysis; the same Lambda as 4.", waits: ["4"] },
  { id: "6", name: "6. Specific recommendations", start: "2026-10-17", end: "2026-10-24", progress: 85, next: "Confirm the uplift line carries a range, 30 minutes." },
  { id: "7", name: "7. Publish", start: "2026-10-08", end: "2026-11-07", progress: 10, next: "Brendan creates the YouTube channel and OAuth client; then the upload wiring, half a day." },
  { id: "8", name: "8. Versions and A/B", start: "2026-10-17", end: "2026-10-31", progress: 70, next: "Both versions publishable and the queues showing the chain, 2 hours." },
  { id: "9", name: "9. Tracked on publish", start: "2026-10-15", end: "2026-11-07", progress: 90, next: "Nothing to build; closes with the first publish.", waits: ["7"] },
  { id: "10", name: "10. The Model Training Library and the model", start: "2026-10-17", end: "2026-11-30", progress: 55, next: "Transcripts and velocity joined to the training set; Hugging Face once a new token is in SSM." },
  { id: "11", name: "11. Platform usage", start: "2026-10-17", end: "2026-10-31", progress: 70, next: "Confirm one event lands end to end, 15 minutes; then readers." },
  { id: "12", name: "12. Platform data trains the model", start: "2026-11-01", end: "2026-12-15", progress: 0, next: "Usage events accumulate first.", waits: ["11"] },
  { id: "13", name: "13. Per-user recommendations", start: "2026-11-15", end: "2026-12-31", progress: 0, next: "PAX2 Feed Ranker over usage events.", waits: ["11", "12"] },
]

// importance: how much the loop depends on it. utility: what it delivers today, at its measured
// strength. ease: how little stands between today and a finished version (data, compute, approvals).
const MODEL_PLAN: Record<string, { start: string; end: string; importance: number; utility: number; ease: number }> = {
  "m-writer": { start: "2026-10-03", end: "2026-10-17", importance: 5, utility: 5, ease: 5 },
  "m-velocity": { start: "2026-10-17", end: "2026-11-30", importance: 4, utility: 5, ease: 5 },
  "m-classifier": { start: "2026-10-17", end: "2026-11-07", importance: 5, utility: 3, ease: 4 },
  "m-headline": { start: "2026-10-17", end: "2026-11-07", importance: 3, utility: 3, ease: 4 },
  "m-labeler": { start: "2026-10-10", end: "2026-12-15", importance: 4, utility: 3, ease: 3 },
  "m-encoder": { start: "2026-10-17", end: "2026-11-21", importance: 4, utility: 2, ease: 2 },
  "m-vision": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 2, ease: 3 },
  "m-retention": { start: "2026-10-17", end: "2026-12-31", importance: 3, utility: 2, ease: 2 },
  "m-reranker": { start: "2026-10-17", end: "2026-11-21", importance: 2, utility: 1, ease: 2 },
  "m-simulator": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 1, ease: 2 },
  "m-cpc": { start: "2026-11-01", end: "2026-12-15", importance: 3, utility: 1, ease: 1 },
  "m-ranker": { start: "2026-11-15", end: "2026-12-31", importance: 3, utility: 1, ease: 2 },
}

export const MODELS: Bar[] = Object.entries(MODEL_PLAN).map(([id, d]) => {
  const node = MEMORABLE.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`gantt: no model ${id} in the Memorable recipe`)
  const f = node.fields
  return { id, name: f.name, start: d.start, end: d.end, progress: Number(f.progress ?? 0), next: f.next ?? "", note: f.metrics, importance: d.importance, utility: d.utility, ease: d.ease }
})
