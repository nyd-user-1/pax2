import model from "../../data/generated/model/pairwise-v0-reform-votingrights.json"
import { extract, familyOf, FEATURE_DEFS, type VideoInput } from "@/lib/video-features"

// PAX2 Classifier's pairwise fit (Bradley-Terry on same-channel pairs): within one channel, which of
// two shorts outruns the other. Gate P passed on Reform and Voting rights only
// (data/generated/model/pairwise-v0-reform-votingrights.json, scripts/pairwise/train.mjs), so this
// answers only when both videos sit in those families; everywhere else it returns null and the
// Versions comparison stands on measured outcomes alone. The edge is thin — held-out pair accuracy
// 0.550 against PAX2 Classifier v1's 0.512 on the same pairs — and travels with every answer so no
// surface can overstate it.

type PairwiseModel = { builtAt: string; version: string; scope: string[]; pairs: number; accuracy: { heldOut: number; v1OnSamePairs: number }; features: { key: string; w: number; sd: number }[] }
const M = model as unknown as PairwiseModel
const LABEL = new Map(FEATURE_DEFS.map((f) => [f.key, f.label]))

export type Versus = {
  /** Which version the pairwise fit favors; "even" when the margin is zero. */
  winner: "this" | "parent" | "even"
  margin: number
  /** The feature differences that carry the margin, strongest first. */
  drivers: { label: string; pull: number }[]
  scope: string
  version: string
  /** Held-out pair accuracy, and PAX2 Classifier v1's on the same pairs, for "against what". */
  accuracy: number
  v1OnSamePairs: number
  builtAt: string
}

/** The pairwise call on a version against its parent; null outside the families Gate P passed on. */
export function pairwiseVersus(current: VideoInput, parent: VideoInput): Versus | null {
  const fam = familyOf(current.group)
  if (!fam || !M.scope.includes(fam) || familyOf(parent.group) !== fam) return null
  const xa = extract(current)
  const xb = extract(parent)
  const terms = M.features.map((f) => ({ label: LABEL.get(f.key) ?? f.key, pull: (f.w * ((xa[f.key] ?? 0) - (xb[f.key] ?? 0))) / f.sd }))
  const margin = terms.reduce((t, c) => t + c.pull, 0)
  const drivers = terms.filter((t) => Math.abs(t.pull) > 1e-9).sort((a, b) => Math.abs(b.pull) - Math.abs(a.pull)).slice(0, 5)
  return {
    winner: Math.abs(margin) < 1e-6 ? "even" : margin > 0 ? "this" : "parent",
    margin,
    drivers,
    scope: M.scope.join(" and "),
    version: M.version,
    accuracy: M.accuracy.heldOut,
    v1OnSamePairs: M.accuracy.v1OnSamePairs,
    builtAt: M.builtAt,
  }
}
