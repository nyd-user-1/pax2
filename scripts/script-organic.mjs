// The channel half of each library script's research prior. worker/code_scripts.py writes the Swayable
// half (codes, notes, prior) into data/generated/model/script-codes.json from Claude on Bedrock; this
// adds, beside it, what travels on the campaign's own channels: every trait whose within-channel lift
// clears zero on the campaign's family with the line that carries it, and the delivery patterns of the
// coded reform shorts that broke out against the script's own Swayable codes. Every figure comes from
// src/lib/organic-evidence.ts, loaded here, so nothing re-reads the lift or pattern files. No AWS.
//
// Usage: node scripts/script-organic.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createJiti } from "jiti"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const jiti = createJiti(import.meta.url, { alias: { "@/": path.join(root, "src") + "/" } })
const { CAMPAIGN_FAMILY, organicCheck, organicEvidence } = await jiti.import(path.join(root, "src/lib/organic-evidence.ts"))
const { SCRIPTS } = await jiti.import(path.join(root, "src/lib/catalog.ts"))

const FILE = path.join(root, "data/generated/model/script-codes.json")
const codes = JSON.parse(fs.readFileSync(FILE, "utf8"))
const ev = organicEvidence(CAMPAIGN_FAMILY)

for (const s of SCRIPTS) {
  const c = codes.scripts[s.id]
  if (!c) {
    console.log(s.id, "has no Swayable codes yet; skipped")
    continue
  }
  const lines = organicCheck(s.text, s.seconds, CAMPAIGN_FAMILY).map(({ scope, ...r }) => ({ ...r, line: r.line == null ? null : r.line - 1 }))
  // Coded at the same 0.5 threshold the pattern file used; a pattern with no Swayable code stays uncoded.
  const patterns = ev.patterns.map((p) => {
    const code = c.codes?.[p.key]
    return { key: p.key, label: p.label, above: p.above, below: p.below, aboveN: p.aboveN, belowN: p.belowN, code: code ?? null, present: code == null ? null : code >= 0.5 }
  })
  c.organic = { family: ev.family, scope: ev.scope, seconds: s.seconds, lines, patterns }
  console.log(s.id, `${s.seconds}s`, lines.map((l) => `${l.key}:${l.present ? "has" : "no"}`).join(" "), "|", patterns.filter((p) => p.present).map((p) => p.key).join(" "))
}
codes.organic = { builtAt: new Date().toISOString(), family: ev.family, scope: ev.scope, counts: ev.counts, method: ev.method, delivery: ev.delivery }
fs.writeFileSync(FILE, JSON.stringify(codes, null, 1) + "\n")
console.log("wrote", path.relative(root, FILE))
