import "server-only"

// The partner's own paid videos as pieces of the review loop: each one shaped like a take so the loop's
// reading, decisions and forecasts run on it unchanged, kept under its own key (paid-<YouTube id>) in the
// workspace's ledger. Its results are the partner's export (data/generated/voter-freedom-paid.json),
// scored as Paid Resonance 1 against the whole batch.
import type { TakeInfo } from "@/lib/catalog"
import { linesFor, pieces, type PaidPiece } from "@/lib/paid-analysis"
import { reference, snapshotFor } from "@/lib/paid-resonance"
import type { TakeState } from "@/lib/review"

export const pieceKey = (ytId: string) => `paid-${ytId}`

export function pieceTake(p: PaidPiece): TakeInfo {
  const s = snapshotFor(p.id)!
  return {
    id: pieceKey(p.id),
    scriptId: "",
    messenger: { label: "Voter Freedom" },
    durationSec: s.take.durationSec,
    lines: linesFor(p.id).lines,
    words: [],
    voice: "",
    captions: true,
    cut: false,
    synthetic: true,
    title: p.title,
  } as unknown as TakeInfo
}

export function pieceState(p: PaidPiece): TakeState {
  const s = snapshotFor(p.id)!
  const at = { snapshot: s.s, score: p.v1 }
  return { take: pieceTake(p), history: [at], latest: at }
}

/** What the reading should know that a synthetic take's context does not say. */
export function pieceAbout(p: PaidPiece) {
  return {
    what: `The partner's own published video "${p.title}", run as a paid ad. This is real delivery, not a synthetic take: the rule about stand-in voices does not apply.`,
    source: "The partner's paid export (voter-freedom-paid.csv): spend, impressions, video starts, 15- and 30-second views, 25/50/75% depth, completions and clicks, by audience group and age band.",
    measuredAs: "Engage uses video starts in place of 3-second plays, which the export does not record. Average watch time is estimated from the reported depth points. The export records no reach, shares, saves or comments, so Act is missing and its weight is shared by Engage and Interest.",
    counted: p.counted.map((c) => `${c.id} ${c.name} (${c.cut} cut, ${c.seconds}s, reported ${c.date})`),
    notCounted: p.excluded.map((c) => `${c.id} ${c.name} (${c.cut})`),
    reportingWindow: `${p.window}; ${p.cohort} of the batch's 16 videos share it`,
    paidResonance2: `${Math.round(p.v2.value ?? 0)}: version 2 scores the same video against the videos reported the same date, with starts restated at the batch's delivery mix (expected ${Math.round(p.expectedStarts).toLocaleString()} starts at the batch's segment rates, observed ${p.observedStarts.toLocaleString()}).`,
    transcript: linesFor(p.id).lines.length ? "the caption lines carry their start times" : `no transcript (${linesFor(p.id).error ?? "captions unavailable"})`,
  }
}

export const allStates = () => pieces().map(pieceState)
export const paidReference = () => reference()
