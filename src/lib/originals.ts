import "server-only"

import { get, now, putOnce, query, type Item } from "@/lib/ledger"

// Original content: a video a user records for PAX2, from the recording to the wild.
//
//   pk               sk               item
//   ORIGINALS        <id>             the index row, one per video
//   ORIG#<id>        META             what was recorded: owner, S3 key, script, messenger
//   ORIG#<id>        EVENT#<iso>      a stage event; the latest events decide the stage
//
// Append-only like the rest of the ledger: a decision is a new event, never an edit.
//
// The flow: recorded → scored (PAX2 evaluates it; the admins get "Original Content ready for
// review") → an admin reviews it, adds notes and picks one of three:
//   Re-Record  the owner gets the findings by email and chooses: record again, or publish as is
//   Approved   published as is
//   Enhance    the PAX2 Enrichment Engine plans the changes; the enhanced cut comes back as
//              version 2, is scored, and is reviewed again
// → published (the owner is emailed the link) → polled once it is live on YouTube.

export type OriginalInput = {
  id: string
  owner: string
  key: string
  version: number
  parent?: string
  title?: string
  text?: string
  name?: string
  role?: string
  town?: string
  seconds: number
  consent: boolean
}

export type Original = Item & OriginalInput & { at: string }

export type Trait = { key: string; label: string; quote?: string; diff: number; low: number; high: number }
export type Recommendation = { axis: "persuasion" | "virality"; change: string; why: string; diff?: number; low?: number; high?: number; source: string }
export type Evaluation = {
  model: string
  summary: string
  traits: Trait[]
  /** The sum of the present traits' leans: points of vote choice against a typical ad. */
  lean: number
  title: { key: string; label: string; has: boolean; won: number; lost: number }[]
  recommendations: Recommendation[]
  /** The best single change's lean as a share of the typical ad's effect, for the findings email. */
  upliftPct: number
}

export type EventInput = {
  kind: "recorded" | "scored" | "note" | "rerecord" | "approved" | "enhance" | "replaced" | "owner-publish" | "published" | "watching"
  by: string
  note?: string
  evaluation?: Evaluation
  child?: string
  plan?: string[]
  destinations?: { platform: string; url: string | null }[]
  youtubeId?: string
}

export type OriginalEvent = Item & EventInput & { at: string }

export type Stage = "recorded" | "scored" | "with-owner" | "enhancing" | "published" | "polled"

export const STAGE_LABEL: Record<Stage, string> = {
  recorded: "Recorded",
  scored: "Ready for review",
  "with-owner": "With the owner",
  enhancing: "Enhancing",
  published: "Published",
  polled: "Polled",
}

const pk = (id: string) => `ORIG#${id}`

export async function createOriginal(o: OriginalInput) {
  const at = now()
  await putOnce({ pk: pk(o.id), sk: "META", at, ...o })
  await putOnce({ pk: "ORIGINALS", sk: o.id, at, owner: o.owner, version: o.version, parent: o.parent })
  await addEvent(o.id, { kind: "recorded", by: o.owner })
  return at
}

export async function addEvent(id: string, ev: EventInput) {
  const at = now()
  await putOnce({ pk: pk(id), sk: `EVENT#${at}`, at, ...ev })
  return at
}

export const original = (id: string) => get<Original>(pk(id), "META")
export const events = async (id: string) => (await query<OriginalEvent>(pk(id), "EVENT#")).sort((a, b) => a.at.localeCompare(b.at))

/** The stage is the latest decisive event. */
export function stageOf(evs: OriginalEvent[]): Stage {
  let s: Stage = "recorded"
  for (const e of evs) {
    if (e.kind === "scored") s = "scored"
    else if (e.kind === "rerecord") s = "with-owner"
    else if (e.kind === "enhance") s = "enhancing"
    else if (e.kind === "published") s = "published"
    else if (e.kind === "watching") s = "polled"
  }
  return s
}

export const latestEvaluation = (evs: OriginalEvent[]) => evs.filter((e) => e.kind === "scored").at(-1)?.evaluation ?? null

/** A video that was re-recorded or enhanced points at the version that replaced it. */
export type OriginalRow = Original & { stage: Stage; events: OriginalEvent[]; evaluation: Evaluation | null; replacedBy: string | null }

const rowOf = (o: Original, evs: OriginalEvent[]): OriginalRow => ({ ...o, stage: stageOf(evs), events: evs, evaluation: latestEvaluation(evs), replacedBy: evs.filter((e) => e.kind === "replaced").at(-1)?.child ?? null })

/** Every original with its stage, newest first; owners see their own, admins see all. */
export async function originals(viewer: { email: string; admin: boolean } | null): Promise<OriginalRow[]> {
  if (!viewer) return []
  const index = await query<Item & { at: string; owner: string }>("ORIGINALS")
  const mine = index.filter((r) => viewer.admin || r.owner === viewer.email)
  const rows = await Promise.all(
    mine.map(async (r) => {
      const [o, evs] = await Promise.all([original(r.sk), events(r.sk)])
      return o ? rowOf(o, evs) : null
    }),
  )
  return rows.filter((r): r is OriginalRow => !!r).sort((a, b) => b.at.localeCompare(a.at))
}

export async function originalRow(id: string): Promise<OriginalRow | null> {
  const [o, evs] = await Promise.all([original(id), events(id)])
  return o ? rowOf(o, evs) : null
}

export const isOriginalId = (id: string) => /^(sub|orig)-[\w-]+$/.test(id)

/** An original before it is published is its owner's and the admins' only. */
export const canSee = (row: OriginalRow, viewer: { email: string; admin: boolean } | null) => !!viewer && (viewer.admin || viewer.email === row.owner)
