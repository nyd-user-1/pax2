// PAX2 Composition Ranker (window C, Part 4, added at Brendan's word 2026-10-20 03:10 Eastern, raised
// to two variants at ~03:25): which of a same-channel breakout/control pair (scripts/composition/
// pairs.mjs) is the breakout.
//   VARIANT=composition  the measured compositional features alone (data/generated/model/composition.json)
//   VARIANT=combined     the same plus the embedding evidence (data/generated/model/composition-embed.json,
//                        scripts/composition/embed.mjs: kNN outlier share and outlier cosine margin from
//                        training-channel neighbors) — semantic meaning, corrected by behavior, filtered
//                        by composition, in one scorer.
//
// Fixed before the first run:
// - Model: Bradley-Terry logistic, no intercept, on standardized breakout-minus-control differences,
//   L2 1e-3, 600 steps of plain gradient descent at 0.5 (the shipped pairwise fit's settings).
// - Features: every feature in composition.json, log1p on the counts and durations (LOG below), each
//   standardized by its mean and spread over the training pairs' shorts. A difference enters only
//   when both sides are measured; otherwise it is 0, so missing media never votes.
// - Held out by channel: the encoder's held-out channels (data/generated/model/encoder/holdout.json),
//   the same unseen channels every pairwise fit answers to.
// - Gate X: held-out pair accuracy at least 0.55 over every held-out pair. Pass publishes private
//   under NYSgpt; fail records the number and ships nothing.
// Reported beside it, not gating: accuracy on held-out pairs where both sides have media extracted;
// leave-one-channel-out accuracy; PAX2 Classifier v1's ordering of the same held-out pairs.
// ATTEMPT=2, the one further attempt a failed gate gets, fixed here before either variant's first run:
//   composition: L2 0.05, and the headline traits dropped (Part 2 found no headline split anywhere).
//   combined:    L2 0.05, and PAX2 Classifier v1's 35 pre-publish features (the shipped pairwise fit's
//                inputs, from training-set.jsonl) join the composition and embedding features.
//
// Usage: VARIANT=composition|combined [ATTEMPT=2] node scripts/composition/fit.mjs
//   -> data/generated/model/composition-ranker[-combined][-a2].json
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "./pairs.mjs"

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))
const VARIANT = process.env.VARIANT ?? "composition"
const ATTEMPT = Number(process.env.ATTEMPT ?? 1)
if (!["composition", "combined"].includes(VARIANT)) throw new Error("VARIANT is composition or combined")
const LAMBDA = ATTEMPT === 2 ? 0.05 : 1e-3
const ITERS = 600
const LR = 0.5
const GATE = 0.55
const LOG = new Set(["durationSec", "cutsPerSec", "firstCutSec", "cutsHook", "textWordsPerFrame", "textHook", "firstWordSec", "wordsHook", "titleChars", "titleWords", "loudnessRange", "visualActivity"])
const MEDIA = ["cutsPerSec", "loudnessLufs", "textWordsPerFrame"]

const comp = read("data/generated/model/composition.json")
const embed = VARIANT === "combined" ? read("data/generated/model/composition-embed.json") : null
const v1 = read("data/generated/model/var-model.json").metadata
const tsRows = new Map(
  fs.readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => {
    const r = JSON.parse(l)
    return [r.id, r]
  }),
)
const COMP_KEYS = Object.keys(comp.features).filter((k) => !(VARIANT === "composition" && ATTEMPT === 2 && k.startsWith("title")))
const EMBED_KEYS = embed ? ["knnShare", "outlierMargin"] : []
const V1_KEYS = VARIANT === "combined" && ATTEMPT === 2 ? v1.features.map((f) => f.key) : []
const KEYS = [...COMP_KEYS, ...EMBED_KEYS, ...V1_KEYS.map((k) => `v1:${k}`)]
const DESC = (k) => comp.features[k] ?? (k === "knnShare" ? "outlier share of the 20 nearest training-channel shorts by encoder cosine" : k === "outlierMargin" ? "mean cosine to the 20 nearest training-channel outliers minus to the 20 nearest non-outliers" : `PAX2 Classifier v1 pre-publish feature ${k.slice(3)}`)
const holdout = read("data/generated/model/encoder/holdout.json")
const heldChannels = new Set(Object.values(holdout.families).flatMap((f) => f.heldOut.map((h) => h.channelId)))
const { pairs: ps } = pairs()

const tf = (k, v) => (v == null ? null : LOG.has(k) ? Math.log1p(Math.max(v, 0)) : v)
const raw = (id, k) => (k.startsWith("v1:") ? tsRows.get(id)?.x?.[k.slice(3)] : EMBED_KEYS.includes(k) ? embed.shorts[id]?.[k] : comp.shorts[id]?.[k])
const vecCache = new Map()
const vec = (id) => {
  if (!vecCache.has(id)) vecCache.set(id, KEYS.map((k) => tf(k, raw(id, k))))
  return vecCache.get(id)
}

function fit(train) {
  // per-feature mean and spread over the training pairs' shorts, measured values only
  const mu = KEYS.map(() => 0)
  const sd = KEYS.map(() => 1)
  KEYS.forEach((_, f) => {
    const xs = train.flatMap((p) => [vec(p.breakout.id)[f], vec(p.control.id)[f]]).filter((x) => x != null)
    if (!xs.length) return
    const m = xs.reduce((a, b) => a + b, 0) / xs.length
    mu[f] = m
    sd[f] = Math.sqrt(Math.max(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length, 1e-12))
  })
  const diff = (p) => {
    const a = vec(p.breakout.id)
    const b = vec(p.control.id)
    return KEYS.map((_, f) => (a[f] == null || b[f] == null ? 0 : (a[f] - b[f]) / sd[f]))
  }
  const X = train.map(diff)
  const w = KEYS.map(() => 0)
  for (let it = 0; it < ITERS; it++) {
    const g = KEYS.map(() => 0)
    for (const d of X) {
      let z = 0
      for (let f = 0; f < KEYS.length; f++) z += w[f] * d[f]
      const p = 1 / (1 + Math.exp(-z))
      for (let f = 0; f < KEYS.length; f++) g[f] += (p - 1) * d[f]
    }
    for (let f = 0; f < KEYS.length; f++) w[f] -= LR * (g[f] / X.length + 2 * LAMBDA * w[f])
  }
  const acc = (P) => {
    if (!P.length) return null
    let right = 0
    for (const p of P) {
      const z = diff(p).reduce((s, d, f) => s + w[f] * d, 0)
      right += z > 0 ? 1 : z === 0 ? 0.5 : 0
    }
    return right / P.length
  }
  return { w, mu, sd, acc }
}

const hasMedia = (p) => MEDIA.some((k) => comp.shorts[p.breakout.id]?.[k] != null) && MEDIA.some((k) => comp.shorts[p.control.id]?.[k] != null)
const train = ps.filter((p) => !heldChannels.has(p.breakout.channelId))
const evalP = ps.filter((p) => heldChannels.has(p.breakout.channelId))
const model = fit(train)
const heldOut = model.acc(evalP)
const heldOutMedia = model.acc(evalP.filter(hasMedia))

// PAX2 Classifier v1 (metadata arm) ordering the same held-out pairs, from the training set's features
const v1score = (id) => {
  const x = tsRows.get(id)?.x
  return x ? v1.features.reduce((s, f) => s + f.coef * (((x[f.key] ?? 0) - f.mean) / f.sd), 0) : null
}
const v1On = evalP.filter((p) => v1score(p.breakout.id) != null && v1score(p.control.id) != null)
const v1acc = v1On.length ? v1On.reduce((s, p) => { const d = v1score(p.breakout.id) - v1score(p.control.id); return s + (d > 0 ? 1 : d === 0 ? 0.5 : 0) }, 0) / v1On.length : null

// leave-one-channel-out, every channel with pairs, pooled over all its pairs
const channels = [...new Set(ps.map((p) => p.breakout.channelId))]
let locoRight = 0
let locoN = 0
let locoMediaRight = 0
let locoMediaN = 0
for (const ch of channels) {
  const test = ps.filter((p) => p.breakout.channelId === ch)
  const m = fit(ps.filter((p) => p.breakout.channelId !== ch))
  locoRight += m.acc(test) * test.length
  locoN += test.length
  const tm = test.filter(hasMedia)
  if (tm.length) {
    locoMediaRight += m.acc(tm) * tm.length
    locoMediaN += tm.length
  }
}

const out = {
  builtAt: new Date().toISOString(),
  name: "PAX2 Composition Ranker",
  version: `composition-ranker-0-${VARIANT}${ATTEMPT === 2 ? "-a2" : ""}`,
  variant: VARIANT,
  attempt: ATTEMPT,
  embedding: embed ? { run: embed.run, builtAt: embed.builtAt, k: embed.k, pool: embed.pool, rule: embed.rule } : null,
  method: `Bradley-Terry logistic, no intercept, L2 ${LAMBDA}, ${ITERS} steps at ${LR}, on standardized breakout-minus-control differences of ${KEYS.length} features (${COMP_KEYS.length} measured compositional${EMBED_KEYS.length ? `, ${EMBED_KEYS.length} embedding evidence` : ""}${V1_KEYS.length ? `, ${V1_KEYS.length} PAX2 Classifier v1 pre-publish` : ""}) (log1p on counts and durations; a difference is 0 unless both sides are measured). Pairs: every settled breakout with its nearest-in-time same-channel non-breakout control. Held-out channels are the encoder's.`,
  composition: comp.builtAt,
  pairs: { all: ps.length, train: train.length, heldOut: evalP.length, heldOutWithMedia: evalP.filter(hasMedia).length, trainWithMedia: train.filter(hasMedia).length, heldOutChannels: [...heldChannels] },
  accuracy: {
    train: model.acc(train),
    heldOut,
    heldOutWithMedia: heldOutMedia,
    leaveOneChannelOut: locoRight / locoN,
    leaveOneChannelOutWithMedia: locoMediaN ? locoMediaRight / locoMediaN : null,
    v1OnSameHeldOutPairs: v1acc,
    v1Pairs: v1On.length,
  },
  gateX: { rule: `held-out pair accuracy at least ${GATE} over every held-out pair`, threshold: GATE, value: heldOut, pass: heldOut >= GATE },
  features: KEYS.map((k, f) => ({ key: k, log1p: LOG.has(k), mean: model.mu[f], sd: model.sd[f], weight: model.w[f], description: DESC(k) })),
  score: "score(short) = sum_f weight_f * (x_f - mean_f) / sd_f over measured features (x log1p where marked); the higher-scoring short of a same-channel pair is the predicted breakout",
}
const file = `data/generated/model/composition-ranker${VARIANT === "combined" ? "-combined" : ""}${ATTEMPT === 2 ? "-a2" : ""}.json`
fs.writeFileSync(path.join(ROOT, file), JSON.stringify(out, null, 1))
console.log(file)
console.log(JSON.stringify({ pairs: out.pairs, accuracy: out.accuracy, gateX: out.gateX }, null, 1))
console.log(out.features.slice().sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 10).map((f) => `${f.key} ${f.weight.toFixed(3)}`).join("\n"))
