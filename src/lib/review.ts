import "server-only"

import { cookies } from "next/headers"

import { parseExport, takeById, takeOfFlight, TAKES, type TakeInfo } from "@/lib/catalog"
import { get, now, putOnce, query, type Item } from "@/lib/ledger"
import { buildReference, FORMULA_V1, score, type Reference, type Score } from "@/lib/resonance"
import type { Snapshot } from "@/lib/types"
import { ROUND_1, ROUND_2 } from "@/data/standin"

// A review workspace: every ledger key is prefixed with it, so a fresh walk-through can start
// without erasing the last one. The cookie only chooses which history is shown.

export const DATASETS = [
  { id: "round-1", label: "Round 1 · reported Oct 3", asOf: "2026-10-03", text: ROUND_1, source: "stand-in" as const },
  { id: "round-2", label: "Round 2 · reported Oct 17", asOf: "2026-10-17", text: ROUND_2, source: "stand-in" as const },
]

export async function workspace() {
  return (await cookies()).get("pax2-ws")?.value || "demo-2"
}

const k = (ws: string, s: string) => `${ws}#${s}`

export type LoadResult = { dataset: string; fileHash: string; alreadyLoaded: boolean; added: number; duplicates: number; unmatched: string[]; missingColumns: string[]; referenceCreated: boolean }

/** Load an export. A file already loaded is refused whole; a row already held is skipped. Nothing is counted twice. */
export async function loadExport(ws: string, dataset: string, text: string, asOf: string, source: "stand-in" | "platform"): Promise<LoadResult> {
  const parsed = parseExport(text, dataset, asOf, source)
  const fresh = await putOnce({ pk: k(ws, `LOAD#${dataset}`), sk: parsed.fileHash, at: now(), rows: parsed.snapshots.length, asOf })
  let added = 0
  let duplicates = 0
  if (fresh) {
    for (const s of parsed.snapshots) {
      const ok = await putOnce({ pk: k(ws, `SNAP#${s.flightId}`), sk: `${s.asOf}#${s.windowEnd}`, at: now(), fileHash: parsed.fileHash, snapshot: s })
      if (ok) added++
      else duplicates++
    }
  } else duplicates = parsed.snapshots.length
  // The reference scale is built from the first dataset loaded, then frozen.
  let referenceCreated = false
  if (!(await get(k(ws, "REF#ref-1"), "META"))) {
    const rows = parsed.snapshots.map((s) => ({ s, take: takeById(takeOfFlight(s.flightId))! }))
    const ref = buildReference("ref-1", dataset, rows)
    referenceCreated = await putOnce({ pk: k(ws, "REF#ref-1"), sk: "META", reference: ref })
  }
  // Save each new score with its formula and reference, so the record shows what was said at the time.
  const ref = await reference(ws)
  if (ref && fresh) {
    for (const s of parsed.snapshots) {
      const take = takeById(takeOfFlight(s.flightId))!
      await putOnce({ pk: k(ws, `SCORE#${s.id}`), sk: `${FORMULA_V1.version}#${ref.id}`, at: now(), score: score(s, take, ref) })
    }
  }
  return { dataset, fileHash: parsed.fileHash, alreadyLoaded: !fresh, added, duplicates, unmatched: parsed.unmatched, missingColumns: parsed.missingColumns, referenceCreated }
}

export async function reference(ws: string): Promise<Reference | null> {
  const r = await get<Item & { reference: Reference }>(k(ws, "REF#ref-1"), "META")
  return r?.reference ?? null
}

export async function loads(ws: string) {
  // One query per dataset, all at once.
  const ids = [...DATASETS.map((d) => d.id), "upload"]
  const lists = await Promise.all(ids.map((id) => query<Item & { at: string; rows: number; asOf: string }>(k(ws, `LOAD#${id}`))))
  const out = lists.flatMap((items, n) => items.map((i) => ({ dataset: ids[n], fileHash: i.sk, at: i.at, rows: i.rows, asOf: i.asOf })))
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** Every snapshot for a take, oldest first. */
export async function snapshots(ws: string, takeId: string): Promise<Snapshot[]> {
  const items = await query<Item & { snapshot: Snapshot }>(k(ws, `SNAP#fl-${takeId}`))
  return items.map((i) => i.snapshot).sort((a, b) => a.asOf.localeCompare(b.asOf))
}

export type TakeState = { take: TakeInfo; history: { snapshot: Snapshot; score: Score }[]; latest?: { snapshot: Snapshot; score: Score } }

/** The board's state: every take with its scored history under the frozen reference. */
export async function board(ws: string): Promise<{ ref: Reference | null; takes: TakeState[] }> {
  let ref = await reference(ws)
  // No page is ever empty: a workspace with no results starts from the stand-in rounds.
  if (!ref) {
    for (const d of DATASETS) await loadExport(ws, d.id, d.text, d.asOf, d.source)
    ref = await reference(ws)
  }
  const takes = await Promise.all(
    TAKES.map(async (take) => {
      const snaps = ref ? await snapshots(ws, take.id) : []
      const history = ref ? snaps.map((snapshot) => ({ snapshot, score: score(snapshot, take, ref) })) : []
      return { take, history, latest: history.at(-1) }
    }),
  )
  return { ref, takes }
}

// ---------- Findings, decisions, forecasts, script choices ----------

export type FindingRecord = Item & { at: string; snapshotId: string; formula: string; reference: string; score: Score; finding: unknown; model: string; rawOutput?: string }
export type StepEvent = Item & { at: string; stepId: string; status: string; change: string; note?: string; prompted?: string; uncertain?: string; measure?: string; snapshotId: string; formula: string; reference: string; findingAt: string }
export type Forecast = Item & { at: string; by: string; target: string; predicted: "higher" | "lower" | "same"; component: string; reason: string; baseline: number | null; baselineSnapshot: string }

export const findings = (ws: string, takeId: string) => query<FindingRecord>(k(ws, `TAKE#${takeId}`), "FINDING#")
export const steps = (ws: string, takeId: string) => query<StepEvent>(k(ws, `TAKE#${takeId}`), "STEP#")
export const forecasts = (ws: string, takeId: string) => query<Forecast>(k(ws, `TAKE#${takeId}`), "CALL#")

export async function saveFinding(ws: string, takeId: string, rec: Omit<FindingRecord, "pk" | "sk" | "at">) {
  const at = now()
  await putOnce({ pk: k(ws, `TAKE#${takeId}`), sk: `FINDING#${at}`, at, ...rec })
  return at
}

export async function recordStep(ws: string, takeId: string, ev: Omit<StepEvent, "pk" | "sk" | "at">) {
  const at = now()
  await putOnce({ pk: k(ws, `TAKE#${takeId}`), sk: `STEP#${ev.stepId}#${at}`, at, ...ev })
  return at
}

/** A forecast is accepted only while the results it predicts are not yet in the ledger. */
export async function recordForecast(ws: string, takeId: string, f: Omit<Forecast, "pk" | "sk" | "at">) {
  const target = DATASETS.find((d) => d.id === f.target)
  const already = await query(k(ws, `LOAD#${f.target}`))
  if (!target || already.length) return { ok: false as const, reason: "Those results are already loaded, so a forecast now would not be a forecast." }
  const at = now()
  await putOnce({ pk: k(ws, `TAKE#${takeId}`), sk: `CALL#${at}`, at, ...f })
  return { ok: true as const, at }
}

export type Pick = Item & { at: string; scriptId: string; reason: string; by: string }
export const picks = (ws: string) => query<Pick>(k(ws, "PICK#uncontested"))
export async function recordPick(ws: string, scriptId: string, reason: string, by: string) {
  const at = now()
  await putOnce({ pk: k(ws, "PICK#uncontested"), sk: at, at, scriptId, reason, by })
  return at
}

export type Vote = Item & { at: string; voter: string; tid: number; vote: 1 | -1 | 0 }
export const votes = (ws: string, conversation: string) => query<Vote>(k(ws, `VOTE#${conversation}`))
export async function recordVote(ws: string, conversation: string, voter: string, tid: number, vote: 1 | -1 | 0) {
  const at = now()
  // One vote per person per statement; a changed mind is a new item, the latest counts.
  await putOnce({ pk: k(ws, `VOTE#${conversation}`), sk: `${voter}#${String(tid).padStart(3, "0")}#${at}`, at, voter, tid, vote })
}

export type Submission = Item & { at: string; status: string; key: string; style?: string; title?: string; text?: string; name?: string; role?: string; town?: string; seconds: number; consent: boolean }
/** Videos volunteers sent through the recording flow, newest first. */
export const submissions = async (ws: string) => (await query<Submission>(k(ws, "SUBMIT"))).sort((a, b) => b.at.localeCompare(a.at))
