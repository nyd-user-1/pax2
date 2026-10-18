// PAX2 Headline Ranker applied to a title or opening line: the probability it beats a typical rival
// headline in an Upworthy-style click test, and the three flags or tokens pulling hardest each way.
// The model (data/generated/model/headline-model.json, scripts/rig/headline_v0.py) carries its own
// pattern regexes, tokenizer and vocabulary, so this file holds no second copy of them. No imports:
// the caller passes the model, and scripts/model-check.mjs runs this file under plain Node.

export type HeadlineModel = {
  name: string
  version: string
  heldOutAccuracy: number
  flagsOnlyAccuracy: number
  patterns: Record<string, { source: string; flags: string }>
  token: { regex: string }
  vocabulary: string[]
  features: string[]
  weights: number[]
  means: number[]
  intercept: number
}

export type HeadlinePull = { feature: string; kind: "flag" | "token"; pull: number }
export type HeadlineScore = { p: number; up: HeadlinePull[]; down: HeadlinePull[]; accuracy: number }

/** The model's feature vector for a text, in the model's order: ten flags, two counts, the vocabulary. */
export function headlineFeatures(model: HeadlineModel, text: string): number[] {
  const flags = Object.entries(model.patterns).map(([, p]) => (new RegExp(p.source, p.flags).test(text) ? 1 : 0))
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const tokens = new Set(text.toLowerCase().replace(/’/g, "'").match(new RegExp(model.token.regex, "g")) ?? [])
  return [...flags, Math.log1p(words), Math.log1p(text.length), ...model.vocabulary.map((t) => (tokens.has(t) ? 1 : 0))]
}

export function scoreHeadline(model: HeadlineModel, text: string): HeadlineScore {
  const f = headlineFeatures(model, text)
  const nFlags = Object.keys(model.patterns).length
  let z = model.intercept
  const pulls: HeadlinePull[] = []
  f.forEach((v, j) => {
    const pull = model.weights[j] * (v - model.means[j])
    z += pull
    const isFlag = j < nFlags
    const isToken = j >= nFlags + 2
    if (v > 0 && (isFlag || isToken)) pulls.push({ feature: isToken ? model.features[j].replace(/^tok:/, "") : model.features[j], kind: isFlag ? "flag" : "token", pull })
  })
  pulls.sort((a, b) => b.pull - a.pull)
  return {
    p: 1 / (1 + Math.exp(-z)),
    up: pulls.filter((x) => x.pull > 0).slice(0, 3),
    down: pulls.filter((x) => x.pull < 0).reverse().slice(0, 3),
    accuracy: model.heldOutAccuracy,
  }
}
