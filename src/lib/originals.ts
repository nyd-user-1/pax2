import "server-only"

import type { Contribution, ModelKind, Recommendation as Distribution } from "@/lib/forecast"
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
  /** A Studio take's design choices as JSON (src/lib/studio-style.ts StyleRecord) and their one-line label. */
  style?: string
  styleLabel?: string
  /** When the owner means it to go out, ISO; the forecast reads its day and hour. */
  publishAt?: string
  /** Made off the platform and entered after the fact (scripts/backfill-voter-freedom.mjs). */
  provenance?: "backfilled"
  /** A backfilled video's YouTube upload: the video itself for version 1, the source a paid edit was cut from. */
  sourceYoutubeId?: string
  /** A backfilled cut's paid runs, one per creative, from data/generated/voter-freedom-paid.json. */
  paid?: PaidRun[]
}

export type PaidRun = { creativeId: string; creativeSet: string; name: string; seconds: number; reportDate: string; spend_usd: number; impressions: number; video_starts: number; views_15s_thruplays_reported: number; video_completions_reported: number; clicks: number }

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
  /** PAX2 Classifier: the chance of a Hit from what the video will carry at publish, with its measured strength. */
  forecast?: {
    p: number
    /** Which of PAX2 Classifier's models answered; absent on evaluations scored before v2. */
    model?: ModelKind
    base: { all: number; family: number | null; familyName: string | null }
    anchor: { median: number | null; breakoutViews: number | null }
    /** Views to expect and where the median came from; absent on evaluations scored before v2. */
    expected?: { views: number; hitRatio: number; restRatio: number; medianSource: string | null } | null
    strength: { auc: number; withinChannelAuc: number | null; topDecileLift: number; familyAuc: number | null; n: number; channels: number | null; version: string; builtAt: string }
    contributions: Contribution[]
  }
  /** The measured within-channel lifts read against this video: changes to make and traits already in place. */
  distribution?: { changes: Distribution[]; keeps: Distribution[] }
}

export type EventInput = {
  kind: "recorded" | "transcoded" | "analyzed" | "scored" | "note" | "rerecord" | "approved" | "enhance" | "replaced" | "owner-publish" | "published" | "watching"
  by: string
  /** On a transcoded event, written by the pax2-transcode Lambda: the mp4's S3 key, ffmpeg's run
   *  time in seconds, and the mp4's size in bytes. */
  key?: string
  seconds?: number
  bytes?: number
  /** On an analyzed event, written by the box the pax2-analyze Lambda starts (scripts/rig/analyze_upload.py):
   *  the content summary as JSON, the Whisper transcript, its words with their seconds as JSON, and which
   *  measurements failed, if any. */
  summary?: string
  transcript?: string
  transcriptWords?: string
  errors?: string
  note?: string
  evaluation?: Evaluation
  child?: string
  plan?: string[]
  destinations?: { platform: string; url: string | null }[]
  youtubeId?: string
  /** On a watching event: when the video went live on YouTube, when PAX2 knows it. */
  published?: string
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

/** The mp4 the pax2-transcode Lambda made from a webm upload, once it exists. */
export const playableKey = (o: { key: string }, evs: OriginalEvent[]) => evs.filter((e) => e.kind === "transcoded" && e.key).at(-1)?.key ?? o.key

export const latestEvaluation = (evs: OriginalEvent[]) => evs.filter((e) => e.kind === "scored").at(-1)?.evaluation ?? null

/** What the content pipeline measured on the upload: the numbers the Scored tab shows and the transcript the next score reads. */
export type Analysis = {
  at: string
  key: string | null
  summary: { durationSec: number | null; words: number | null; wpm: number | null; firstWordSec: number | null; language: string | null; pauses: number | null; longestPauseSec: number | null; loudnessRangeDb: number | null; pitchMedianHz: number | null; pitchRangeHz: [number, number] | null; memorability: number | null; frames: number | null; delivery?: { energy: string | null; vocalTone: string[] | null; directAddress: boolean | null; frame: string | null; firstPerson: boolean | null; questionLed: boolean | null; coreClaim: string | null; hook: string | null; hookAt: number | null; pace: string | null; captions: string | null; callToAction: string | null; visualVariety: string | null; summary: string | null } }
  transcript: string | null
  words: { t: number; w: string }[]
  errors: string[]
}

export function latestAnalysis(evs: OriginalEvent[]): Analysis | null {
  const e = evs.filter((x) => x.kind === "analyzed").at(-1)
  if (!e) return null
  const parse = <T,>(s: string | undefined, fallback: T): T => {
    try {
      return s ? (JSON.parse(s) as T) : fallback
    } catch {
      return fallback
    }
  }
  return { at: e.at, key: e.key ?? null, summary: parse(e.summary, {} as Analysis["summary"]), transcript: e.transcript?.trim() || null, words: parse(e.transcriptWords, []), errors: e.errors ? e.errors.split(",") : [] }
}

/** A video that was re-recorded or enhanced points at the version that replaced it. */
export type OriginalRow = Original & { stage: Stage; events: OriginalEvent[]; evaluation: Evaluation | null; analysis: Analysis | null; replacedBy: string | null }

const rowOf = (o: Original, evs: OriginalEvent[]): OriginalRow => ({ ...o, stage: stageOf(evs), events: evs, evaluation: latestEvaluation(evs), analysis: latestAnalysis(evs), replacedBy: evs.filter((e) => e.kind === "replaced").at(-1)?.child ?? null })

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

/** A distribution change's measured gain, signed for the change: dropping a trait that costs
 *  points gains them. Percentage points of breakout rate with the 90% range. */
export function gainOf(r: Distribution): { points: number; low: number; high: number } {
  const flip = r.points < 0
  return flip ? { points: -r.points, low: -r.high, high: -r.low } : { points: r.points, low: r.low, high: r.high }
}

/** Every version of a video, root first: back along `parent`, then forward along `replacedBy`. */
export async function chainOf(id: string): Promise<OriginalRow[]> {
  let root = await originalRow(id)
  if (!root) return []
  const seen = new Set([root.id])
  while (root.parent && !seen.has(root.parent)) {
    const up = await originalRow(root.parent)
    if (!up) break
    seen.add(up.id)
    root = up
  }
  const chain = [root]
  let at = root
  while (at.replacedBy && !chain.some((r) => r.id === at.replacedBy)) {
    const next = await originalRow(at.replacedBy)
    if (!next) break
    chain.push(next)
    at = next
  }
  return chain
}
