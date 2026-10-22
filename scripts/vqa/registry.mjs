// Window Q step 4: the recommendation registry. One row per trait the census columns define
// (scripts/vqa/lift.mjs TRAITS): variable, grounds, citation. Only a measured lift mints a recommendation, and
// the rule was fixed at batch launch, before any lift was read, then amended once as marked (2026-10-22):
//   recommendation  the trait's 90% range excludes zero (vqa-lift.json) AND its column's hand-audited accuracy
//                   is at least 0.85 (vqa-audit.json; peopleMax uses exact agreement)
//                   AND it is measured in at least 5 channels (the floor scripts/resonance/topic-lift.mjs uses; added
//                   after the 500-short dry run showed a 2-channel trait with a tight, meaningless range)
//   descriptive     everything else, with the reason
// The direction follows the sign: a positive lift recommends the trait, a negative one recommends against it.
// Usage: node scripts/vqa/registry.mjs  -> data/generated/model/vqa-registry.json
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const MIN_ACCURACY = 0.85
const MIN_CHANNELS = 5
const lift = read("data/generated/model/vqa-lift.json")
const audit = read("data/generated/model/vqa-audit.json")

const rows = lift.rows.map((r) => {
  const acc = audit.columns[r.column]?.accuracy ?? null
  const accurate = acc != null && acc >= MIN_ACCURACY
  const enough = (r.channels ?? 0) >= MIN_CHANNELS
  const status = r.measured && accurate && enough ? "recommendation" : "descriptive"
  const why = r.points == null ? "too few channels with 3+ shorts on each side to measure" : !enough ? `measured in ${r.channels} channels, under ${MIN_CHANNELS}` : !r.measured ? "the 90% range crosses zero" : !accurate ? `the column's audited accuracy ${acc} is under ${MIN_ACCURACY}` : null
  return {
    variable: r.key,
    label: r.label,
    status,
    direction: status === "recommendation" ? (r.points > 0 ? "do" : "avoid") : null,
    grounds: r.points == null ? null : { liftPoints: r.points, range90: [r.low, r.high], channels: r.channels, shortsWithTrait: r.videos, basePushedPercent: r.basePushed, prevalencePercent: r.prevalence, columnAccuracy: acc, auditN: audit.columns[r.column]?.n ?? null },
    reason: why,
    citation: `data/generated/model/vqa-lift.json (${lift.method.split(";")[0]}; ${lift.videos} shorts, ${lift.channels} channels, built ${lift.builtAt.slice(0, 10)}); accuracy from data/generated/model/vqa-audit.json (${audit.audited} hand-audited shorts)`,
  }
})
const out = { builtAt: new Date().toISOString(), rule: `recommendation only where the Breakout lift's 90% range excludes zero, it is measured in ${MIN_CHANNELS}+ channels, and the column's audited accuracy is at least ${MIN_ACCURACY}; all else descriptive`, recommendations: rows.filter((r) => r.status === "recommendation").length, rows }
fs.writeFileSync(path.join(root, "data/generated/model/vqa-registry.json"), JSON.stringify(out, null, 1) + "\n")
for (const r of rows) console.log(`${r.status === "recommendation" ? `${r.direction.toUpperCase()}` : "desc"} | ${r.label} | ${r.grounds ? `${r.grounds.liftPoints} (${r.grounds.range90.join(" to ")}) acc ${r.grounds.columnAccuracy}` : "—"}${r.reason ? ` | ${r.reason}` : ""}`)

// Step 5's last clause: each audited new column with a measured lift is noted in the Resonance formula as a
// future stack input (Gen 2), joining at the next refit.
const RF = path.join(root, "data/generated/model/resonance-formula.json")
const rf = JSON.parse(fs.readFileSync(RF, "utf8"))
rf.futureInputs = {
  note: "audited census columns whose trait passed the registry rule; they join the stack at the next refit (Gen 2)",
  registry: "data/generated/model/vqa-registry.json",
  columns: rows.filter((r) => r.status === "recommendation").map((r) => ({ variable: r.variable, liftPoints: r.grounds.liftPoints, range90: r.grounds.range90, columnAccuracy: r.grounds.columnAccuracy })),
}
fs.writeFileSync(RF, JSON.stringify(rf, null, 1) + "\n")
console.log(`resonance-formula.json futureInputs: ${rf.futureInputs.columns.length}`)
