// Window Q's hand audit. Two steps:
//   node scripts/vqa/audit.mjs pick [n=100] [dir]
//       a stratified sample of the answered set: strata are the model's format answer x outperformed-3x, each
//       stratum gets an equal share of n (leftover to the largest), drawn in hash order. Writes the ids to
//       data/raw/vqa/audit-ids.txt and fetches each short's two contact sheets (the frames the model saw, and a
//       frame every 2 s) from s3://pax-2-638175140432/vqa/sheets/ into dir for the auditor.
//   node scripts/vqa/audit.mjs verify <tag> [<tag>]
//       the same scoring over the 20-video verification truth (data/raw/vqa/verify.json), per model tag,
//       to data/generated/model/vqa-verify.json.
//   node scripts/vqa/audit.mjs score
//       reads the auditor's truth in data/raw/vqa/audit.json ({ id: { column: value, ... } }; a column the
//       auditor could not settle is left out) and writes per-column accuracy to data/generated/model/vqa-audit.json.
//       0/1 columns: agreement, with precision and recall of the 1s; enums: agreement; peopleMax: exact and
//       within one; peopleScreenShare: within 0.15; ctaSec: within 2 s where both say a call to action.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { columns } from "./merge.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const census = fs.existsSync(path.join(root, "data/generated/model/vqa-census.json")) ? read("data/generated/model/vqa-census.json") : { shorts: {} }
const [cmd, a1, a2] = process.argv.slice(2)

// Per-column accuracy of a model's columns (colsOf(id)) against a truth file.
function score(truth, colsOf) {
  const BIN = ["captionsBurnedIn", "callToAction", "productShown", "thirdPartyWatermark", "onScreenText"]
  const res = {}
  const r3 = (x) => Math.round(x * 1000) / 1000
  const pairs = (k) => Object.entries(truth).map(([id, t]) => [t[k], colsOf(id)?.[k]]).filter(([t, m]) => t != null && m != null)
  for (const k of BIN) {
    const P = pairs(k)
    const tp = P.filter(([t, m]) => t === 1 && m === 1).length, fp = P.filter(([t, m]) => t === 0 && m === 1).length, fn = P.filter(([t, m]) => t === 1 && m === 0).length
    res[k] = { n: P.length, accuracy: P.length ? r3(P.filter(([t, m]) => t === m).length / P.length) : null, truePositives: tp + fn, precision: tp + fp ? r3(tp / (tp + fp)) : null, recall: tp + fn ? r3(tp / (tp + fn)) : null }
  }
  for (const k of ["format", "setting"]) {
    const P = pairs(k); const errors = {}
    for (const [t, m] of P) if (t !== m) errors[`${m} -> ${t}`] = (errors[`${m} -> ${t}`] ?? 0) + 1
    res[k] = { n: P.length, accuracy: P.length ? r3(P.filter(([t, m]) => t === m).length / P.length) : null, errors }
  }
  { const P = pairs("peopleMax"); res.peopleMax = { n: P.length, accuracy: P.length ? r3(P.filter(([t, m]) => t === m).length / P.length) : null, withinOne: P.length ? r3(P.filter(([t, m]) => Math.abs(t - m) <= 1).length / P.length) : null } }
  { const P = pairs("peopleScreenShare"); res.peopleScreenShare = { n: P.length, accuracy: P.length ? r3(P.filter(([t, m]) => Math.abs(t - m) <= 0.15).length / P.length) : null, rule: "within 0.15" } }
  { const P = pairs("ctaSec"); res.ctaSec = { n: P.length, accuracy: P.length ? r3(P.filter(([t, m]) => Math.abs(t - m) <= 2).length / P.length) : null, rule: "within 2 s, where both see a call to action" } }
  return res
}


if (cmd === "pick") {
  const n = Number(a1 ?? 100)
  const dir = a2 ?? "/tmp/vqa-audit"
  const tier = new Map(read("data/velocity/catalog.json").videos.map((v) => [v.id, v.tier]))
  const verified = new Set(fs.existsSync(path.join(root, "data/raw/vqa/verify-ids.txt")) ? fs.readFileSync(path.join(root, "data/raw/vqa/verify-ids.txt"), "utf8").split("\n").filter(Boolean) : [])
  const h = (id) => createHash("sha1").update("audit:" + id).digest("hex")
  const strata = new Map()
  for (const [id, c] of Object.entries(census.shorts)) {
    if (verified.has(id) || !tier.get(id) || tier.get(id) === "unsettled") continue
    const k = `${c.format}|${tier.get(id) === "breakout" ? 1 : 0}`
    strata.set(k, [...(strata.get(k) ?? []), id])
  }
  for (const v of strata.values()) v.sort((x, y) => h(x).localeCompare(h(y)))
  const keys = [...strata.keys()].sort()
  const pick = new Map(keys.map((k) => [k, []]))
  let left = n
  while (left > 0) {  // round-robin, so small strata give what they have and the rest flows to larger ones
    let moved = false
    for (const k of keys) { if (!left) break; const s = strata.get(k); const p = pick.get(k); if (p.length < s.length) { p.push(s[p.length]); left--; moved = true } }
    if (!moved) break
  }
  const ids = [...pick.values()].flat()
  fs.writeFileSync(path.join(root, "data/raw/vqa/audit-ids.txt"), ids.join("\n") + "\n")
  fs.mkdirSync(dir, { recursive: true })
  for (const id of ids) for (const s of [`${id}.jpg`, `${id}-dense.jpg`]) execFileSync("aws", ["s3", "cp", "--only-show-errors", `s3://pax-2-638175140432/vqa/sheets/${s}`, path.join(dir, s), "--region", "us-east-1"])
  console.log(JSON.stringify({ n: ids.length, strata: Object.fromEntries(keys.map((k) => [k, `${pick.get(k).length} of ${strata.get(k).length}`])), dir }, null, 1))
} else if (cmd === "score") {
  const truth = read("data/raw/vqa/audit.json")
  const res = score(truth, (id) => census.shorts[id])
  const out = { builtAt: new Date().toISOString(), census: census.version, audited: Object.keys(truth).length, method: "Hand audit of a stratified sample (scripts/vqa/audit.mjs pick: the model's format x outperformed-3x), read from the frames the model saw and a frame every 2 s. The auditor's truth is data/raw/vqa/audit.json; a column the auditor could not settle is left out of its count.", columns: res }
  fs.writeFileSync(path.join(root, "data/generated/model/vqa-audit.json"), JSON.stringify(out, null, 1) + "\n")
  console.log(JSON.stringify(out.columns, null, 1))
} else if (cmd === "verify") {
  // node scripts/vqa/audit.mjs verify <tag> [<tag> ...]: the 20-video verification (data/raw/vqa/verify.json) per model tag
  const truth = read("data/raw/vqa/verify.json")
  const out = {}
  for (const tag of [a1, a2, ...process.argv.slice(5)].filter(Boolean)) {
    const dir = path.join(root, `data/raw/vqa/raw/${tag}`)
    execFileSync("aws", ["s3", "sync", "--only-show-errors", `s3://pax-2-638175140432/vqa/raw/${tag}/`, dir, "--region", "us-east-1", "--exclude", "*", ...Object.keys(truth).flatMap((id) => ["--include", `${id}.json`])])
    out[tag] = score(truth, (id) => { const f = path.join(dir, `${id}.json`); return fs.existsSync(f) ? columns(JSON.parse(fs.readFileSync(f, "utf8")).answers) : null })
  }
  fs.writeFileSync(path.join(root, "data/generated/model/vqa-verify.json"), JSON.stringify({ builtAt: new Date().toISOString(), truth: "data/raw/vqa/verify.json (hand-checked from the frames the model saw and a frame every 2 s)", ids: Object.keys(truth).length, models: out }, null, 1) + "\n")
  for (const [tag, r] of Object.entries(out)) console.log(tag, Object.entries(r).map(([k, v]) => `${k} ${v.accuracy}${v.precision != null ? ` (p ${v.precision})` : ""}`).join(" | "))
} else {
  console.error("usage: node scripts/vqa/audit.mjs pick [n] [dir] | score")
  process.exit(1)
}
