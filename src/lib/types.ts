// The spine: claim → script (framing) → take (messenger) → flight (paid run)
// → snapshot (results as of a date) → score (formula version) → finding →
// next step (proposed / approved / made) → forecast (logged before results).

/** Where a number came from. The interface never mixes these without saying so. */
export type Provenance =
  | "platform" // recorded by the ad platform (Meta Ads Manager, YouTube)
  | "library" // a public ad library, often banded
  | "stand-in" // placeholder until the partner's own export arrives
  | "ai" // assessed by a model from the video or script
  | "coded" // hand-coded by researchers (Swayable, Wesleyan)
  | "derived" // computed here from the above

export type Claim = { id: string; text: string; ballot?: string }

export type Script = {
  id: string
  claimId: string
  title: string
  short: string
  /** The library card's own description of the framing. */
  framing: string
  text: string
  words: number
  seconds: number
  source: string
}

export type Messenger = { label: string; role?: string; town?: string }

export type Take = {
  id: string
  scriptId: string
  messenger: Messenger
  durationSec: number
  video?: { src: string; poster?: string }
  /** Script lines with the second each begins, from transcript alignment. */
  lines?: { t: number; text: string }[]
}

export type Flight = {
  id: string
  takeId: string
  platform: string
  placement: string
  objective: string
  start: string
  end: string
  geo: string
}

export const METRICS = [
  "spend",
  "impressions",
  "reach",
  "plays3s",
  "thruplays",
  "p25",
  "p50",
  "p75",
  "p100",
  "avgWatchSec",
  "shares",
  "saves",
  "comments",
  "reactions",
  "linkClicks",
] as const
export type MetricKey = (typeof METRICS)[number]

export type Measure = { value: number | null; source: Provenance }

export type Snapshot = {
  /** flight + reporting window + as-of date: loading the same file twice yields the same id. */
  id: string
  flightId: string
  asOf: string
  windowStart: string
  windowEnd: string
  dataset: string
  metrics: Record<MetricKey, Measure>
}

export type Kind = "observed" | "interpretation" | "hypothesis"

export type Evidence = { label: string; ref: string; t?: number }

export type Finding = { kind: Kind; text: string; evidence: Evidence[] }

export type NextStep = {
  id: string
  change: string
  prompted: string
  uncertain: string
  measure: string
  status: "proposed" | "approved" | "revised" | "saved" | "made" | "evaluated"
}
