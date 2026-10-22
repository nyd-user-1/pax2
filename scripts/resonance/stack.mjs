// Resonance, the Gen 1 stack (docs/RESONANCE.md), fitted and validated as registered (Window Q step 5).
// Over the uniform baseline (data/raw/vqa/set.tsv, scripts/vqa/set.mjs):
//   q_c  PAX2 Classifier v3's calibrated probability ("full" arm, predictions-v3.jsonl)
//   q_x  the craft rank: the share of the short's own channel's measured baseline shorts it outscores under
//        the composition pair picker, combined variant (composition-ranker-combined.json; ties count half)
//   q_h  the headline percentile: the title's pax2-headline score read against headline-v1-reference.json
// The stack: P = sigma(b0 + sum_i b_i * logit(q_i)), with a missing indicator per absent q_i, q clamped to
// [0.01, 0.99]. Rows: the baseline shorts on the encoder's 10 held-out channels — the only rows neither
// v3 nor the pair picker trained on. Validation held out by channel: leave one channel out over those
// channels, pooled AUC of the out-of-channel predictions, beside each single component's AUC on the same
// rows. Acceptance (pre-registered): stack AUC >= best single component's, else that component serves.
// Writes data/generated/model/resonance-formula.json; caches headline scores in
// data/raw/vqa/headline-scores.json (the Lambda, ~22 calls, cents).
//
// Usage: node scripts/resonance/stack.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const ids = fs.readFileSync(path.join(root, "data/raw/vqa/set.tsv"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0])

const pred = new Map(fs.readFileSync(path.join(root, "data/generated/model/predictions-v3.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.id, r] }))
const catalog = new Map(read("data/velocity/catalog.json").videos.map((v) => [v.id, v]))
const comp = read("data/generated/model/composition.json").shorts
const embed = read("data/generated/model/composition-embed.json").shorts
const ranker = read("data/generated/model/composition-ranker-combined.json")
const ref = read("data/generated/model/headline-v1-reference.json")

// q_h: headline scores, cached
const HL = path.join(root, "data/raw/vqa/headline-scores.json")
const hl = fs.existsSync(HL) ? read("data/raw/vqa/headline-scores.json") : {}
const need = ids.filter((id) => hl[id] == null && catalog.get(id)?.title?.trim())
if (need.length) {
  const lambda = new LambdaClient({ region: "us-east-1" })
  for (let i = 0; i < need.length; i += 256) {
    const part = need.slice(i, i + 256)
    const r = await lambda.send(new InvokeCommand({ FunctionName: "pax2-headline", Payload: Buffer.from(JSON.stringify({ texts: part.map((id) => catalog.get(id).title.trim().slice(0, 400)) })) }))
    if (r.FunctionError) throw new Error(Buffer.from(r.Payload).toString().slice(0, 300))
    JSON.parse(Buffer.from(r.Payload).toString()).scores.forEach((s, k) => (hl[part[k]] = s))
    process.stdout.write(`\rheadlines ${Math.min(i + 256, need.length)}/${need.length}`)
  }
  console.log()
  fs.writeFileSync(HL, JSON.stringify(hl))
}
const pct = (score) => { let lo = 0; while (lo < ref.percentiles.length && ref.percentiles[lo] <= score) lo++; return lo / ref.percentiles.length }

// q_x: the pair picker's score per short, then the within-channel share it outscores
const LOG = new Set(ranker.features.filter((f) => f.log1p).map((f) => f.key))
const rawF = (id, k) => (k === "knnShare" || k === "outlierMargin" ? embed[id]?.[k] : comp[id]?.[k])
const craft = (id) => ranker.features.reduce((s, f) => {
  let x = rawF(id, f.key)
  if (x == null) return s
  if (LOG.has(f.key)) x = Math.log1p(Math.max(x, 0))
  return s + f.weight * (x - f.mean) / f.sd
}, 0)
const byCh = new Map()
for (const id of ids) {
  const ch = catalog.get(id)?.channelId
  if (!ch || comp[id]?.cutsPerSec == null) continue
  byCh.set(ch, [...(byCh.get(ch) ?? []), [id, craft(id)]])
}
const qx = new Map()
for (const rows of byCh.values()) {
  if (rows.length < 2) continue
  for (const [id, s] of rows) {
    let beat = 0
    for (const [o, t] of rows) if (o !== id) beat += s > t ? 1 : s === t ? 0.5 : 0
    qx.set(id, beat / (rows.length - 1))
  }
}

const clamp = (q) => Math.min(0.99, Math.max(0.01, q))
const logit = (q) => Math.log(clamp(q) / (1 - clamp(q)))
const NAMES = ["q_c", "q_x", "q_h"]
const rows = []
for (const id of ids) {
  const v = catalog.get(id), p = pred.get(id)
  if (!v || v.tier === "unsettled" || !p) continue
  const q = [p.full, qx.get(id), hl[id] != null ? pct(hl[id]) : undefined]
  rows.push({ id, ch: v.channelId, y: v.tier === "breakout" ? 1 : 0, heldOut: p.heldOut === 1, q })
}
const X = (r) => [...r.q.map((q) => (q == null ? 0 : logit(q))), ...r.q.map((q) => (q == null ? 1 : 0))]

function fitLogit(R, l2 = 1e-3, iters = 3000, lr = 0.5) {
  const d = X(R[0]).length + 1
  const w = new Array(d).fill(0)
  const Z = R.map((r) => [1, ...X(r)])
  const keep = Array.from({ length: d }, (_, j) => j === 0 || Z.some((z) => z[j] !== Z[0][j]))  // a constant column stays 0
  for (let it = 0; it < iters; it++) {
    const g = new Array(d).fill(0)
    for (let i = 0; i < R.length; i++) {
      const z = Z[i].reduce((s, x, j) => s + w[j] * x, 0)
      const e = 1 / (1 + Math.exp(-z)) - R[i].y
      for (let j = 0; j < d; j++) g[j] += e * Z[i][j]
    }
    for (let j = 0; j < d; j++) if (keep[j]) w[j] -= lr * (g[j] / R.length + (j ? 2 * l2 * w[j] : 0))
  }
  return w
}
const score = (w, r) => 1 / (1 + Math.exp(-[1, ...X(r)].reduce((s, x, j) => s + w[j] * x, 0)))
function auc(pairs) {  // [score, y]
  const s = [...pairs].sort((a, b) => a[0] - b[0])
  let rank = 0, pos = 0, sum = 0
  for (let i = 0; i < s.length;) {
    let j = i; while (j < s.length && s[j][0] === s[i][0]) j++
    const r = (i + j + 1) / 2
    for (let k = i; k < j; k++) if (s[k][1]) { sum += r; pos++ }
    rank = j; i = j
  }
  const neg = s.length - pos
  return pos && neg ? (sum - (pos * (pos + 1)) / 2) / (pos * neg) : null
}
function withinAuc(rs, f) {  // per-channel AUC, weighted by rows, channels with both labels
  const g = new Map(); for (const r of rs) g.set(r.ch, [...(g.get(r.ch) ?? []), r])
  let t = 0, n = 0
  for (const v of g.values()) { const a = auc(v.map((r) => [f(r), r.y])); if (a != null) { t += a * v.length; n += v.length } }
  return n ? t / n : null
}

const H = rows.filter((r) => r.heldOut)
const chans = [...new Set(H.map((r) => r.ch))]
const oof = new Map()
for (const c of chans) {
  const w = fitLogit(H.filter((r) => r.ch !== c))
  for (const r of H.filter((r) => r.ch === c)) oof.set(r.id, score(w, r))
}
const r4 = (x) => (x == null ? null : Math.round(x * 1e4) / 1e4)
const singles = Object.fromEntries(NAMES.map((n, i) => {
  const on = H.filter((r) => r.q[i] != null)
  return [n, { rows: on.length, pooledAuc: r4(auc(on.map((r) => [r.q[i], r.y]))), withinChannelAuc: r4(withinAuc(on, (r) => r.q[i])) }]
}))
const stackAuc = auc(H.map((r) => [oof.get(r.id), r.y]))
const stackWithin = withinAuc(H, (r) => oof.get(r.id))
const best = Object.entries(singles).sort((a, b) => b[1].pooledAuc - a[1].pooledAuc)[0]
const pass = stackAuc >= best[1].pooledAuc
const w = fitLogit(H)
const coverage = Object.fromEntries(NAMES.map((n, i) => [n, { baseline: rows.filter((r) => r.q[i] != null).length, heldOut: H.filter((r) => r.q[i] != null).length }]))

const out = {
  builtAt: new Date().toISOString(),
  name: "Resonance, Gen 1 stack",
  definition: "docs/RESONANCE.md",
  formula: "P(outperform 3x) = sigma(b0 + b_c*logit(q_c) + b_x*logit(q_x) + b_h*logit(q_h) + m_c*[q_c missing] + m_x*[q_x missing] + m_h*[q_h missing]), q clamped to [0.01, 0.99], a missing q enters as 0",
  components: {
    q_c: "PAX2 Classifier v3, full arm, calibrated probability (predictions-v3.jsonl)",
    q_x: "craft rank: share of the channel's measured baseline shorts outscored under composition-ranker-combined.json (ties half)",
    q_h: "headline percentile: pax2-headline score against headline-v1-reference.json",
  },
  rows: { baseline: rows.length, heldOut: H.length, heldOutChannels: chans.length, heldOutPositives: H.filter((r) => r.y).length, coverage },
  validation: {
    rule: "leave one held-out channel out over the encoder's 10 held-out channels (the only rows v3 and the pair picker never trained on); pooled AUC of out-of-channel predictions",
    stack: { pooledAuc: r4(stackAuc), withinChannelAuc: r4(stackWithin) },
    singles,
    acceptance: { rule: "stack held-out AUC >= the best single component's, else that component alone serves as Resonance", bestSingle: best[0], bestSingleAuc: best[1].pooledAuc, stackAuc: r4(stackAuc), pass, serves: pass ? "stack" : best[0] },
  },
  weights: { b0: r4(w[0]), b_c: r4(w[1]), b_x: r4(w[2]), b_h: r4(w[3]), m_c: r4(w[4]), m_x: r4(w[5]), m_h: r4(w[6]), fitOn: "all held-out-channel baseline rows, L2 0.001 on the slopes" },
  notes: [
    "The held-out rows' outperform share is high because baseline media were mostly label-picked; AUC is unaffected by the base rate, the intercept is not, so the served probability needs recalibration against the uniform catalog rate before display.",
  ],
  futureInputs: "Window Q's audited census columns with a measured lift (data/generated/model/vqa-lift.json) join at the next refit (Gen 2).",
}
fs.writeFileSync(path.join(root, "data/generated/model/resonance-formula.json"), JSON.stringify(out, null, 1) + "\n")
console.log(JSON.stringify({ rows: out.rows, validation: out.validation, weights: out.weights }, null, 1))
