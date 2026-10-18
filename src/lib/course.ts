import "server-only"

import codes from "../../data/generated/model/organic-codes.json"
import patterns from "../../data/generated/swayable-patterns.json"
import { now, putOnce, query, type Item } from "@/lib/ledger"
import { conversationOf, LABEL_VIDEOS, LABELING_WS, TRAITS } from "@/lib/labeling"
import { votes } from "@/lib/review"
import { TRAIT_NAMES, TRAIT_RELIABILITY } from "@/lib/trait-definitions"

// Teach a Model, the Classifier course on /labeling/classifier. A learner gets one of the coded
// campaign shorts for the whole course and its twenty-eight trait questions in four chapters of
// seven. Answers go through recordVote exactly as /labeling's did (conversation traits-<videoId>,
// tid the trait's index in featureLabels), so scripts/consensus-agreement.mjs reads them unchanged.
//
//   pk                          sk              item
//   COURSE#classifier           <email>         { videoId, at }: the learner's video, written once
//   COURSE#classifier#<email>   EVENT#<iso>     { kind: "chapter" | "finished", chapter, at }

export const COURSE = "classifier"

export type Chapter = { n: number; title: string; keys: string[] }

export const CHAPTERS: Chapter[] = [
  { n: 1, title: "Labels", keys: ["messenger_every_people", "messenger_politician", "messenger_celebrity", "messenger_veteran", "technique_plain_folks", "technique_pos_testimonial", "technique_neg_testimonial"] },
  { n: 2, title: "Features", keys: ["narration_personal_story", "narration_explain_facts", "narration_advocate_opinions", "policy_facts", "fact_cite_yes", "fact_new_yes", "explicit_vote_for"] },
  { n: 3, title: "Agreement", keys: ["emotion_anger", "emotion_enthusiasm", "emotion_fear", "emotion_hope_pride", "emotion_humor", "emotion_somber", "tone_contrast"] },
  { n: 4, title: "Tests", keys: ["tone_positive", "tone_negative", "production_value_high", "style_amateur", "style_text_on_screen", "style_animation", "how_scripted"] },
]

export const tidOf = (key: string) => TRAITS.find((t) => t.key === key)!.tid

// Seeded order: FNV-1a over the seed string, then mulberry32 drives a Fisher-Yates shuffle. The same
// seed always gives the same order, so a learner's order never changes between visits.
function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seeded<T>(xs: readonly T[], seed: string): T[] {
  const r = rng(seed)
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A chapter's seven traits in this learner's order on this video. */
export const chapterOrder = (email: string, videoId: string, n: number) => seeded(CHAPTERS[n - 1].keys, `${email}|${videoId}|${n}`)

// Only videos the classifier coded can be revealed against, so only those are assigned.
const COURSE_VIDEOS = LABEL_VIDEOS.filter((v) => v.coded)
export const courseVideo = (id: string) => COURSE_VIDEOS.find((v) => v.id === id) ?? null

/** Distinct people who have voted on any trait of each video, by video id. */
export async function labelersByVideo() {
  const all = await Promise.all(COURSE_VIDEOS.map(async (v) => [v.id, new Set((await votes(LABELING_WS, conversationOf(v.id))).map((r) => r.voter)).size] as const))
  return new Map(all)
}

type Assignment = Item & { videoId: string; at: string }

/** The learner's video: read back if assigned, otherwise the video with the fewest distinct
 *  labelers, ties broken by an order seeded from the email, written once. `fresh` is true only on
 *  the visit that wrote it. */
export async function assignment(email: string): Promise<{ videoId: string; fresh: boolean }> {
  const held = (await query<Assignment>(`COURSE#${COURSE}`, email)).find((r) => r.sk === email)
  if (held) return { videoId: held.videoId, fresh: false }
  const counts = await labelersByVideo()
  const pick = seeded(COURSE_VIDEOS, email).sort((a, b) => counts.get(a.id)! - counts.get(b.id)!)[0]
  const wrote = await putOnce({ pk: `COURSE#${COURSE}`, sk: email, videoId: pick.id, at: now() })
  if (wrote) return { videoId: pick.id, fresh: true }
  // Another tab wrote first; that one stands.
  const again = (await query<Assignment>(`COURSE#${COURSE}`, email)).find((r) => r.sk === email)
  return { videoId: again!.videoId, fresh: false }
}

export type CourseEvent = Item & { kind: "chapter" | "finished"; chapter: number; at: string }
export const courseEvents = (email: string) => query<CourseEvent>(`COURSE#${COURSE}#${email}`, "EVENT#")

/** Write a chapter or finished event unless one is already held. True when written. */
export async function markOnce(email: string, kind: CourseEvent["kind"], chapter: number) {
  if ((await courseEvents(email)).some((e) => e.kind === kind && e.chapter === chapter)) return false
  const at = now()
  return putOnce({ pk: `COURSE#${COURSE}#${email}`, sk: `EVENT#${at}`, kind, chapter, at })
}

/** The learner's latest answer per trait key on their video. */
export async function answers(email: string, videoId: string): Promise<Record<string, 1 | -1 | 0>> {
  const mine = (await votes(LABELING_WS, conversationOf(videoId))).filter((v) => v.voter === email).sort((a, b) => a.at.localeCompare(b.at))
  const out: Record<string, 1 | -1 | 0> = {}
  for (const v of mine) {
    const t = TRAITS.find((x) => x.tid === v.tid)
    if (t) out[t.key] = v.vote
  }
  return out
}

export const chapterDone = (a: Record<string, unknown>, n: number) => CHAPTERS[n - 1].keys.every((k) => k in a)

type Lean = { key: string; diff: number; low: number; high: number }
const LEANS = (patterns as { traits: Lean[] }).traits
const CODES = (codes as { scripts: Record<string, { codes?: Record<string, number> }> }).scripts

export type RevealRow = { key: string; name: string; answer: 1 | -1 | 0; present: boolean | null; lean: { diff: number; low: number; high: number } | null; icc: { year: number; icc: number } | null }

/** The reveal for one chapter: the learner's answer beside the classifier's, the trait's measured
 *  lean in the archive's tests, and the archive raters' agreement for the latest year. */
export function revealRows(videoId: string, keys: string[], a: Record<string, 1 | -1 | 0>): RevealRow[] {
  return keys.map((key) => {
    const code = CODES[videoId]?.codes?.[key]
    const l = LEANS.find((x) => x.key === key)
    const r = TRAIT_RELIABILITY[key]?.at(-1)
    return { key, name: TRAIT_NAMES[key], answer: a[key] ?? 0, present: code == null ? null : code >= 0.5, lean: l ? { diff: l.diff, low: l.low, high: l.high } : null, icc: r ? { year: r.year, icc: r.icc } : null }
  })
}
