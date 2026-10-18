// How well the Swayable archive's raters agreed on each trait PAX2 labels. Reads Table DA35 of the
// Dataverse appendix (data/raw/swayable/reliability-DA35.tsv: ICC(C,k), three ratings per video in
// 2018, two in 2020) and the archive's name per trait key, TRAIT_NAMES in src/lib/trait-definitions.ts,
// itself checked here against defined_term_names in data/raw/swayable/definitions.R. A trait matches
// a row on the exact term name only; "Cited fact (where fact present)" is a different variable from
// "Cited fact", so fact_cite_yes and fact_new_yes have no row.
// Writes data/generated/swayable-reliability.json: { traits: { <key>: [{ year, icc, lower, upper }] } }.
// Usage: node scripts/swayable-reliability.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const OUT = path.join(root, "data/generated/swayable-reliability.json")

// TRAIT_NAMES, parsed from its one definition.
const ts = read("src/lib/trait-definitions.ts")
const block = ts.slice(ts.indexOf("export const TRAIT_NAMES"), ts.indexOf("\n}\n", ts.indexOf("export const TRAIT_NAMES")))
const names = Object.fromEntries([...block.matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => [m[1], m[2]]))
const keys = Object.keys(JSON.parse(read("data/generated/model/reference-model.json")).featureLabels)
const missing = keys.filter((k) => !names[k])
if (missing.length) throw new Error(`TRAIT_NAMES lacks ${missing.join(", ")}`)

// Every name but the two the archive does not map must be one of defined_term_names' values.
const archive = new Set([...read("data/raw/swayable/definitions.R").matchAll(/"\w+"\s*=\s*"([^"]+)"/g)].map((m) => m[1]))
const unnamed = keys.filter((k) => !archive.has(names[k]))
if (unnamed.join() !== "tone_negative,how_scripted") throw new Error(`names not in definitions.R: ${unnamed.join(", ")}`)

const [head, ...lines] = read("data/raw/swayable/reliability-DA35.tsv").trim().split("\n")
const col = Object.fromEntries(head.split("\t").map((h, i) => [h, i]))
const rows = lines.map((l) => l.split("\t")).map((c) => ({ term: c[col.term], year: Number(c[col.year]), icc: Number(c[col.icc]), lower: Number(c[col.lower95]), upper: Number(c[col.upper95]) }))
if (rows.length !== 53) throw new Error(`expected 53 rows, read ${rows.length}`)

const traits = {}
for (const k of keys) {
  const hit = rows.filter((r) => r.term === names[k]).sort((a, b) => a.year - b.year).map(({ year, icc, lower, upper }) => ({ year, icc, lower, upper }))
  if (hit.length) traits[k] = hit
}
const matched = Object.keys(traits)
fs.writeFileSync(OUT, JSON.stringify({ source: "Hewitt et al. (APSR 2024), Dataverse appendix Table DA35: ICC(C,k), three ratings per video in 2018, two in 2020", traits }, null, 2) + "\n")
console.log(`${matched.length} trait keys matched, ${keys.length - matched.length} unmatched`)
console.log(`matched: ${matched.join(", ")}`)
console.log(`unmatched: ${keys.filter((k) => !traits[k]).join(", ")}`)
