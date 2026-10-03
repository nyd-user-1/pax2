"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { takeById } from "@/lib/catalog"
import { read, type Reading } from "@/lib/pax"
import { FORMULA_V1 } from "@/lib/resonance"
import { board, DATASETS, findings, loadExport, recordForecast, recordPick, recordStep, recordVote, saveFinding, steps, workspace, type LoadResult } from "@/lib/review"

export async function loadDataset(id: string): Promise<LoadResult> {
  const ws = await workspace()
  const d = DATASETS.find((x) => x.id === id)
  if (!d) throw new Error("Unknown dataset")
  const r = await loadExport(ws, d.id, d.text, d.asOf, d.source)
  revalidatePath("/", "layout")
  return r
}

export async function uploadExport(form: FormData): Promise<LoadResult> {
  const ws = await workspace()
  const file = form.get("file") as File | null
  const asOf = String(form.get("asOf") || new Date().toISOString().slice(0, 10))
  if (!file) throw new Error("No file")
  const r = await loadExport(ws, "upload", await file.text(), asOf, "platform")
  revalidatePath("/", "layout")
  return r
}

export type SavedReading = { at: string; reading: Reading; model: string; snapshotId: string; formula: string; reference: string; scoreValue: number | null }

/** Ask PAX for a reading of the latest results, and save it with the score version and evidence it used. */
export async function requestReading(takeId: string): Promise<SavedReading> {
  const ws = await workspace()
  const take = takeById(takeId)
  if (!take) throw new Error("Unknown take")
  const { ref, takes } = await board(ws)
  const state = takes.find((t) => t.take.id === takeId)!
  if (!state.latest || !ref) throw new Error("Load results first")
  const earlier = await findings(ws, takeId)
  const decisions = await steps(ws, takeId)
  const prior = earlier.slice(-1).flatMap((f) =>
    ((f.finding as Reading).findings ?? [])
      .filter((x) => x.kind !== "observed")
      .map((x) => ({ finding: `${x.kind}: ${x.text} (said ${f.at.slice(0, 10)}, score ${f.score.value?.toFixed(0) ?? "—"} on ${f.snapshotId.split("~").pop()})`, decided: decisions.filter((d) => d.findingAt === f.at).map((d) => `${d.status}: ${d.change}`).join("; ") || undefined })),
  )
  const { reading, model, raw } = await read(take, state, ref, takes, prior)
  const at = await saveFinding(ws, takeId, { snapshotId: state.latest.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, score: state.latest.score, finding: reading, model, rawOutput: JSON.stringify(raw).slice(0, 20000) })
  revalidatePath(`/v/${takeId}`)
  return { at, reading, model, snapshotId: state.latest.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, scoreValue: state.latest.score.value }
}

export async function decide(input: { takeId: string; stepId: string; status: "approved" | "revised" | "saved" | "made"; change: string; note?: string; prompted?: string; uncertain?: string; measure?: string; snapshotId: string; reference: string; findingAt: string }) {
  const ws = await workspace()
  await recordStep(ws, input.takeId, { stepId: input.stepId, status: input.status, change: input.change, note: input.note, prompted: input.prompted, uncertain: input.uncertain, measure: input.measure, snapshotId: input.snapshotId, formula: FORMULA_V1.version, reference: input.reference, findingAt: input.findingAt })
  revalidatePath(`/v/${input.takeId}`)
  revalidatePath("/reviews")
}

export async function callIt(input: { takeId: string; by: string; target: string; predicted: "higher" | "lower" | "same"; component: string; reason: string; baseline: number | null; baselineSnapshot: string }) {
  const ws = await workspace()
  const r = await recordForecast(ws, input.takeId, input)
  revalidatePath(`/v/${input.takeId}`)
  revalidatePath("/reviews")
  return r
}

export async function pickScript(scriptId: string, reason: string) {
  const ws = await workspace()
  await recordPick(ws, scriptId, reason, "partner")
  revalidatePath("/scripts")
}

export async function castVote(conversation: string, voter: string, tid: number, vote: 1 | -1 | 0) {
  const ws = await workspace()
  await recordVote(ws, conversation, voter, tid, vote)
  revalidatePath("/scripts")
}

/** Start a fresh review: a new workspace, the old one left intact. */
export async function freshReview() {
  const id = `ws-${Date.now().toString(36)}`
  ;(await cookies()).set("pax-ws", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 60, path: "/" })
  revalidatePath("/", "layout")
  return id
}
