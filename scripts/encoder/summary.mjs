// PAX2 Encoder and PAX2 Reranker, C3: data/generated/model/encoder.json, read by the recipe cards and /ml.
// From a run's verified bench files (scripts/encoder/rescore.mjs --apply) and the Hugging Face ids.
//   node scripts/encoder/summary.mjs <run-id> [--cost <dollars>]
import fs from "node:fs"
import path from "node:path"

const RUN = process.argv[2]
if (!RUN) throw new Error("usage: summary.mjs <run-id> [--cost <dollars>]")
const ci = process.argv.indexOf("--cost")
const DIR = path.join("data/generated/model/encoder/runs", RUN)
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"))
const pairs = read("pairs-stats.json")
const arms = Object.fromEntries(
  ["stock", "encoder", "reranker"].map((a) => {
    const b = read(`bench-${a}.json`)
    if (!b.verified) throw new Error(`bench-${a}.json has no verified block; run rescore.mjs --apply first`)
    return [a, { pooled: b.pooled, within: b.within, withinUnweighted: b.withinUnweighted, withinChannels: b.withinChannels, n: b.n, breakouts: b.breakouts, perFamily: b.perFamily, perChannel: b.perChannel, gate: b.gate ?? null }]
  }),
)
const holdout = JSON.parse(fs.readFileSync("data/generated/model/encoder/holdout.json", "utf8"))
const gateE = arms.encoder.gate
const gateR = arms.reranker.gate
const hf = {
  encoder: "NYSgpt/pax2-encoder-bge-m3",
  reranker: "NYSgpt/pax2-reranker-gte-modernbert",
  benchmark: "datasets/NYSgpt/pax2-breakout-benchmark",
  trainingSet: "datasets/NYSgpt/pax2-shorts-training-set",
}
const out = {
  builtAt: new Date().toISOString(),
  run: RUN,
  // The hf id goes on only after the weights are actually uploaded and listed (rule 26): --published.
  models: {
    "PAX2 Encoder": { base: "BAAI/bge-m3", hf: gateE.pass && process.argv.includes("--published") ? hf.encoder : null, s3: `s3://nsr-embed-v2/pax2/models/${RUN}/encoder/` },
    "PAX2 Reranker": { base: "Alibaba-NLP/gte-reranker-modernbert-base", hf: gateR.pass && process.argv.includes("--published") ? hf.reranker : null, s3: `s3://nsr-embed-v2/pax2/models/${RUN}/reranker/` },
  },
  // Staged in s3://nsr-embed-v2/pax2/publish/<run>/; published only once the upload is listed and matches.
  datasets: { benchmark: { hf: hf.benchmark, published: process.argv.includes("--published") }, trainingSet: { hf: hf.trainingSet, published: process.argv.includes("--published") }, staged: `s3://nsr-embed-v2/pax2/publish/${RUN}/` },
  benchmark: {
    task: "For each held-out short, the 20 nearest training shorts by cosine; score = the share that broke out; AUC against the short's own breakout label, pooled and within each held-out channel (weighted by the channel's shorts, channels with both classes).",
    heldOutChannels: holdout.heldOutChannels,
    heldOutDocs: holdout.heldOutDocs,
    heldOutBreakouts: holdout.heldOutBreakouts,
    trainingDocs: holdout.trainingDocs,
    pairs: pairs.pairs,
  },
  gates: {
    E: { rule: gateE.rule, pass: gateE.pass, pooledDelta: gateE.pooledDelta, withinDelta: gateE.withinDelta },
    R: { rule: gateR.rule, pass: gateR.pass },
  },
  arms,
  ...(ci > 0 && { costUsd: Number(process.argv[ci + 1]) }),
}
fs.writeFileSync("data/generated/model/encoder.json", JSON.stringify(out, null, 1) + "\n")
console.log(`encoder.json: gate E ${gateE.pass ? "PASS" : "FAIL"}, gate R ${gateR.pass ? "PASS" : "FAIL"}`)
for (const [a, v] of Object.entries(arms)) console.log(`  ${a}: pooled ${v.pooled.toFixed(4)} within ${v.within.toFixed(4)}`)
