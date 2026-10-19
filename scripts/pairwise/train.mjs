// The pairwise reframe of the pre-release question, v0 (Brendan, 2026-10-19: "lean into that hard").
// Instead of "will this short break out" (absolute, capped by publish-day luck), train "which of these
// two same-channel shorts does better" — the comparison the editor actually makes, where the channel,
// the family and most of the lottery cancel.
//
// Pairs: two shorts from the same channel published within 45 days of each other whose settled ratios
// (views over the channel median) differ by at least 1.5x; the higher ratio is the winner. Features:
// the same 35 pre-publish features PAX2 Classifier v1 reads (data/generated/model/var-model.json), as
// winner-minus-loser differences, standardized; a Bradley-Terry logistic with no intercept, L2, plain
// gradient descent. Held-out channels are the encoder's (data/generated/model/encoder/holdout.json),
// so every experiment tonight answers to the same unseen channels.
//
// Gate P, fixed before the first run: held-out pairwise accuracy at least 0.02 above PAX2 Classifier
// v1's ordering of the same pairs, else v0 is recorded and not shipped.
//
// Usage: node scripts/pairwise/train.mjs
// Writes data/generated/model/pairwise-v0.json
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))

const WINDOW_DAYS = 45
const GAP = 1.5
const CAP_PER_CHANNEL = 4000
const LAMBDA = 1e-3
const ITERS = 600
const LR = 0.5

const v1 = read("data/generated/model/var-model.json").metadata
const KEYS = v1.features.map((f) => f.key)
const v1score = (x) => v1.features.reduce((s, f) => s + f.coef * (((x[f.key] ?? 0) - f.mean) / f.sd), 0)

const rows = fs
  .readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.ratio != null && r.x && r.channelId && r.tier !== "paid")

const holdout = read("data/generated/model/encoder/holdout.json")
const byId = new Map(rows.map((r) => [r.id, r]))
const heldChannels = new Set(holdout.ids.map((id) => byId.get(id)?.channelId).filter(Boolean))

// ── pairs ─────────────────────────────────────────────────────────────────────
let seed = 20261019
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const byChannel = new Map()
for (const r of rows) {
  if (!byChannel.has(r.channelId)) byChannel.set(r.channelId, [])
  byChannel.get(r.channelId).push(r)
}
const trainPairs = []
const evalPairs = []
for (const [ch, vids] of byChannel) {
  vids.sort((a, b) => a.published.localeCompare(b.published))
  const pairs = []
  for (let i = 0; i < vids.length; i++) {
    const ti = new Date(vids[i].published).getTime()
    for (let j = i + 1; j < vids.length; j++) {
      if (new Date(vids[j].published).getTime() - ti > WINDOW_DAYS * 86400e3) break
      const [a, b] = [vids[i], vids[j]]
      const [hi, lo] = a.ratio >= b.ratio ? [a, b] : [b, a]
      if (hi.ratio <= 0) continue
      if (lo.ratio > 0 && hi.ratio < GAP * lo.ratio) continue
      if (hi.ratio === lo.ratio) continue
      pairs.push([hi, lo])
    }
  }
  while (pairs.length > CAP_PER_CHANNEL) pairs.splice(Math.floor(rand() * pairs.length), 1)
  for (const p of pairs) (heldChannels.has(ch) ? evalPairs : trainPairs).push(p)
}

// FAMILIES=Reform,"Voting rights" node scripts/pairwise/train.mjs — train and judge on those families
// alone; the output file carries the scope in its name and its method line (rule 24).
const FAMILIES = process.env.FAMILIES ? new Set(process.env.FAMILIES.split(",").map((s) => s.trim())) : null
const inScope = ([hi]) => !FAMILIES || FAMILIES.has(hi.family)
const trainScoped = trainPairs.filter(inScope)
const evalScoped = evalPairs.filter(inScope)

const diff = ([hi, lo]) => KEYS.map((k) => (hi.x[k] ?? 0) - (lo.x[k] ?? 0))
const Xtr = trainScoped.map(diff)
const Xev = evalScoped.map(diff)

// Standardize by the training diffs' spread.
const sd = KEYS.map((_, f) => {
  let s = 0, s2 = 0
  for (const d of Xtr) (s += d[f]), (s2 += d[f] * d[f])
  const m = s / Xtr.length
  return Math.sqrt(Math.max(s2 / Xtr.length - m * m, 1e-12))
})
for (const X of [Xtr, Xev]) for (const d of X) for (let f = 0; f < KEYS.length; f++) d[f] /= sd[f]

// ── Bradley-Terry logistic, no intercept: every training diff should score positive ──
const w = new Array(KEYS.length).fill(0)
for (let it = 0; it < ITERS; it++) {
  const g = new Array(KEYS.length).fill(0)
  for (const d of Xtr) {
    let z = 0
    for (let f = 0; f < KEYS.length; f++) z += w[f] * d[f]
    const p = 1 / (1 + Math.exp(-z))
    for (let f = 0; f < KEYS.length; f++) g[f] += (p - 1) * d[f]
  }
  for (let f = 0; f < KEYS.length; f++) w[f] -= LR * (g[f] / Xtr.length + 2 * LAMBDA * w[f])
}

const acc = (X) => {
  let right = 0
  for (const d of X) {
    let z = 0
    for (let f = 0; f < KEYS.length; f++) z += w[f] * d[f]
    right += z > 0 ? 1 : z === 0 ? 0.5 : 0
  }
  return right / X.length
}
const v1acc = (P) => {
  let right = 0
  for (const [hi, lo] of P) {
    const d = v1score(hi.x) - v1score(lo.x)
    right += d > 0 ? 1 : d === 0 ? 0.5 : 0
  }
  return right / P.length
}

const accTrain = acc(Xtr)
const accEval = acc(Xev)
const base = v1acc(evalScoped)
const perFamily = {}
for (const fam of new Set(evalScoped.map(([hi]) => hi.family))) {
  const P = evalScoped.filter(([hi]) => hi.family === fam)
  const idx = evalScoped.map((p, i) => (p[0].family === fam ? i : -1)).filter((i) => i >= 0)
  perFamily[fam] = { pairs: P.length, accuracy: acc(idx.map((i) => Xev[i])), v1: v1acc(P) }
}

const gate = { rule: `held-out pairwise accuracy at least 0.02 above PAX2 Classifier v1's ordering of the same pairs`, v0: accEval, v1: base, pass: accEval >= base + 0.02 }
const top = KEYS.map((k, f) => ({ key: k, w: w[f] })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 12)
const scopeSlug = FAMILIES ? "-" + [...FAMILIES].join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "") : ""
const out = {
  builtAt: new Date().toISOString(),
  name: "PAX2 Classifier",
  version: `pairwise-0${scopeSlug}`,
  scope: FAMILIES ? [...FAMILIES] : "all families",
  method: `Bradley-Terry logistic (no intercept, L2 ${LAMBDA}, standardized winner-minus-loser differences of PAX2 Classifier v1's ${KEYS.length} pre-publish features) on same-channel pairs published within ${WINDOW_DAYS} days whose settled ratios differ by at least ${GAP}x${FAMILIES ? `, trained and judged on ${[...FAMILIES].join(" and ")} pairs only` : ""}; held-out channels are the encoder run's.`,
  pairs: { train: trainScoped.length, eval: evalScoped.length, channels: byChannel.size, heldOutChannels: heldChannels.size, capPerChannel: CAP_PER_CHANNEL },
  accuracy: { train: accTrain, heldOut: accEval, v1OnSamePairs: base },
  gateP: gate,
  perFamily,
  topWeights: top,
  // Every weight and the diff spread it divides by: score(short) = sum_f weights[f] * x[f] / sd[f]; the
  // winner of a pair is the higher score. Without these the file could not be served or published.
  features: KEYS.map((k, f) => ({ key: k, w: w[f], sd: sd[f] })),
}
fs.writeFileSync(path.join(ROOT, `data/generated/model/pairwise-v0${scopeSlug}.json`), JSON.stringify(out, null, 1) + "\n")
console.log(`pairs: train ${trainScoped.length}, eval ${evalScoped.length} (held-out channels ${heldChannels.size}${FAMILIES ? `, scope ${[...FAMILIES].join(", ")}` : ""})`)
console.log(`accuracy: train ${accTrain.toFixed(4)}, held out ${accEval.toFixed(4)}, v1 on the same pairs ${base.toFixed(4)}`)
console.log(`Gate P (${gate.rule}): ${gate.pass ? "PASS" : "FAIL"}`)
for (const [fam, v] of Object.entries(perFamily)) console.log(`  ${fam}: ${v.pairs} pairs, v0 ${v.accuracy.toFixed(3)}, v1 ${v.v1.toFixed(3)}`)
