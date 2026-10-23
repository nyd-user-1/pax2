"use server"

import { revalidatePath } from "next/cache"

import type { SavedReading } from "@/app/actions"
import { pieceById } from "@/lib/paid-analysis"
import { allStates, paidReference, pieceAbout, pieceKey, pieceState } from "@/lib/paid-pieces"
import { read, type Reading } from "@/lib/pax2"
import { FORMULA_V1 } from "@/lib/resonance"
import { now, putOnce, query } from "@/lib/ledger"
import { findings, saveFinding, steps, workspace } from "@/lib/review"

/** PAX's reading of one of the partner's paid videos, saved with the score version and evidence it used,
 *  as the take loop saves a take's (src/app/actions.ts requestReading). `key` is paid-<YouTube id>. */
export async function requestPaidReading(key: string): Promise<SavedReading> {
  const ws = await workspace()
  const p = pieceById(key.replace(/^paid-/, ""))
  if (!p) throw new Error("Unknown video")
  const state = pieceState(p)
  const ref = paidReference()
  const earlier = await findings(ws, pieceKey(p.id))
  const decisions = await steps(ws, pieceKey(p.id))
  const prior = earlier.slice(-1).flatMap((f) =>
    ((f.finding as Reading).findings ?? [])
      .filter((x) => x.kind !== "observed")
      .map((x) => ({ finding: `${x.kind}: ${x.text} (said ${f.at.slice(0, 10)}, score ${f.score.value?.toFixed(0) ?? "—"} on ${f.snapshotId.split("~").pop()})`, decided: decisions.filter((d) => d.findingAt === f.at).map((d) => `${d.status}: ${d.change}`).join("; ") || undefined })),
  )
  const { reading, model, raw } = await read(state.take, state, ref, allStates(), prior, pieceAbout(p))
  const at = await saveFinding(ws, pieceKey(p.id), { snapshotId: state.latest!.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, score: state.latest!.score, finding: reading, model, rawOutput: JSON.stringify(raw).slice(0, 20000) })
  revalidatePath(`/paid/${p.id}`)
  return { at, reading, model, snapshotId: state.latest!.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, scoreValue: state.latest!.score.value }
}

/** A forecast for one of the partner's paid videos, locked before the next export arrives: stored as the
 *  take loop stores its forecasts (the workspace's TAKE#<key>, CALL#<time>), refused once a later export
 *  for this batch has been loaded. */
export async function callPaid(input: { takeId: string; by: string; target: string; predicted: "higher" | "lower" | "same"; component: string; reason: string; baseline: number | null; baselineSnapshot: string }): Promise<{ ok: true; at: string } | { ok: false; reason: string }> {
  const ws = await workspace()
  if ((await query(`${ws}#LOAD#paid-next`)).length) return { ok: false, reason: "The next export is already loaded, so a forecast now would not be a forecast." }
  const at = now()
  await putOnce({ pk: `${ws}#TAKE#${input.takeId}`, sk: `CALL#${at}`, at, ...input })
  revalidatePath(`/paid/${input.takeId.replace(/^paid-/, "")}`)
  return { ok: true, at }
}
