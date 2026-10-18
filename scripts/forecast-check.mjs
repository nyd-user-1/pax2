// Parity for PAX2 Classifier: the feature extractor and the model's arithmetic, applied in Node to the
// check rows the trainer stored, must reproduce the trainer's probabilities, for the metadata model
// and for the image model (whose checks carry the thumbnail's features). Fails loudly if they drift.
// Usage: node --experimental-strip-types scripts/forecast-check.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { extract } from "../src/lib/video-features.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const models = JSON.parse(fs.readFileSync(path.join(process.env.MODEL_DIR ?? path.join(root, "data/generated/model"), "var-model.json"), "utf8"))

const imageX = (im) => ({ bright: im.bright, contrast: im.contrast, color: im.color, ...(im.mem == null ? {} : { mem: im.mem }), ...Object.fromEntries(im.pca.map((v, k) => [`pca${k}`, v])) })

let worst = 0
for (const kind of ["metadata", "image"]) {
  const model = models[kind]
  console.log(`${kind} (${model.version}, n=${model.n}, LOCO AUC ${model.metrics.leaveOneChannelOut.auc})`)
  for (const c of model.checks) {
    const x = { ...extract(c.input), ...(c.image ? imageX(c.image) : {}) }
    let eta = model.intercept
    for (const f of model.features) {
      if (x[f.key] == null) throw new Error(`${kind}: no value for ${f.key}`)
      eta += f.coef * ((x[f.key] - f.mean) / f.sd)
    }
    const p = 1 / (1 + Math.exp(-eta))
    const diff = Math.abs(p - c.p)
    worst = Math.max(worst, diff)
    console.log(`  ${p.toFixed(4)} vs ${c.p.toFixed(4)}  ${diff < 1e-3 ? "ok " : "BAD"}  ${c.input.title.slice(0, 60)}`)
  }
}
console.log(`image gate: ${models.gates.image.passed ? "passed" : "failed"}`)
if (worst > 1e-3) {
  console.error(`parity failed: worst difference ${worst}`)
  process.exit(1)
}
console.log(`parity ok: worst difference ${worst.toExponential(2)}`)
