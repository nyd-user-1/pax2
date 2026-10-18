// Parity for PAX2 Velocity Classifier and PAX2 Headline Ranker: src/lib/velocity-model.ts and
// src/lib/headline.ts, applied in Node to the check rows the box's trainers stored, must reproduce the
// trainers' probabilities. Fails loudly if they drift.
// Usage: node --experimental-strip-types scripts/model-check.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { scoreHeadline } from "../src/lib/headline.ts"
import { velocityForecast } from "../src/lib/velocity-model.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = process.env.MODEL_DIR ?? path.join(root, "data/generated/model")
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
let worst = 0
const report = (p, want, label) => {
  const d = Math.abs(p - want)
  worst = Math.max(worst, d)
  console.log(`  ${p.toFixed(4)} vs ${want.toFixed(4)}  ${d < 1e-3 ? "ok " : "BAD"}  ${label}`)
}

const vel = read("velocity-model.json")
if (vel.horizons) {
  for (const [h, m] of Object.entries(vel.horizons)) {
    console.log(`velocity ${h}h (LOCO AUC ${m.metrics.leaveOneChannelOut.auc})`)
    for (const c of m.checks) report(velocityForecast(vel, { readings: c.readings, channelMedian: c.channelMedian, x: c.x }, Number(h)).p, c.p, `${c.readings.length} readings, median ${c.channelMedian}`)
  }
} else console.log(`velocity: no model (${vel.stopped ?? "no horizons"})`)

const head = read("headline-model.json")
console.log(`headline (held-out accuracy ${head.heldOutAccuracy}, flags only ${head.flagsOnlyAccuracy})`)
for (const c of head.checks) {
  const s = scoreHeadline(head, c.text)
  report(s.p, c.p, `${c.text.slice(0, 50)} | up ${s.up.map((u) => u.feature).join(", ")} | down ${s.down.map((u) => u.feature).join(", ")}`)
}
if (worst > 1e-3) {
  console.error(`parity failed: worst difference ${worst}`)
  process.exit(1)
}
console.log(`parity ok: worst difference ${worst.toExponential(2)}`)
