// Codebook 5K, the 20-video verification: the open model's codes (s3 codebook/raw/<TAG>-a|b/) against the
// Bedrock coder's (data/raw/codebook/bedrock/, scripts/codebook/bedrock.mjs) and against /labeling's hand
// labels where a verification video has them (the ledger, labeling#VOTE#traits-yt-<id>: the latest non-pass
// vote per voter and trait, majority at half, as scripts/consensus-agreement.mjs reads them).
// Swayable: per trait, agreement on present/absent over the 20 and Cohen's kappa; Wesleyan: per column,
// exact agreement. A reply whose JSON does not parse has its present flags read off the text by pattern
// ("key": "...", "present": true|false, or a colon for the comma), so one malformed quote does not drop the video.
// Writes data/generated/model/codebook-verify.json and prints markdown tables.
// Usage: TAG=qwen3-8b-v2 node scripts/codebook/verify.mjs   (IDS=<ids file> OUT=<json path> for another set)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const TAG = process.env.TAG ?? "qwen3-8b-v1"
const BUCKET = "pax-2-638175140432"
const ids = fs.readFileSync(path.join(root, process.env.IDS ?? "data/raw/codebook/verify-ids.txt"), "utf8").trim().split("\n")
const TRAITS = read("data/generated/swayable-patterns.json").traits
const tidKeys = Object.keys(read("data/generated/model/reference-model.json").featureLabels)

export function presentOf(coded, raw) {
  if (coded?.traits) return Object.fromEntries(coded.traits.map((t) => [t.key, !!t.present]))
  const m = {}
  for (const x of (raw ?? "").matchAll(/"key"\s*:\s*"(\w+)"\s*[,:]\s*"present"\s*:\s*(true|false)/g)) m[x[1]] = x[2] === "true"
  return Object.keys(m).length ? m : null
}
const s3json = (key) => { try { return JSON.parse(execFileSync("aws", ["s3", "cp", "--only-show-errors", `s3://${BUCKET}/${key}`, "-"], { encoding: "utf8" })) } catch { return null } }

const open = {}, bed = {}
for (const id of ids) {
  const a = s3json(`codebook/raw/${TAG}-a/${id}.json`), b = s3json(`codebook/raw/${TAG}-b/${id}.json`)
  open[id] = { sw: a ? presentOf(a.coded, a.raw) : null, we: b?.coded ?? null }
  const r = read(`data/raw/codebook/bedrock/${id}.json`)
  bed[id] = { sw: presentOf(r.swayable, r.rawA), we: r.wesleyan }
}

// Hand labels.
const hand = {}
for (const id of ids) {
  const out = execFileSync("aws", ["dynamodb", "query", "--region", "us-east-1", "--table-name", process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger", "--key-condition-expression", "pk = :p", "--expression-attribute-values", JSON.stringify({ ":p": { S: `labeling#VOTE#traits-yt-${id}` } }), "--output", "json"], { encoding: "utf8" })
  const items = JSON.parse(out).Items.map((i) => ({ voter: i.voter.S, at: i.at.S, tid: +i.tid.N, vote: +i.vote.N })).sort((x, y) => x.at.localeCompare(y.at))
  if (!items.length) continue
  const latest = new Map(items.map((v) => [`${v.voter}|${v.tid}`, v]))
  const by = {}
  for (const v of latest.values()) if (v.vote !== 0) (by[tidKeys[v.tid]] ??= []).push(v.vote === 1)
  hand[id] = Object.fromEntries(Object.entries(by).map(([k, vs]) => [k, vs.filter(Boolean).length / vs.length >= 0.5]))
}

const kappa = (pairs) => {
  const n = pairs.length; if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pa = pairs.filter(([a]) => a).length / n, pb = pairs.filter(([, b]) => b).length / n
  const pe = pa * pb + (1 - pa) * (1 - pb)
  return pe === 1 ? null : +((po - pe) / (1 - pe)).toFixed(2)
}
const r2 = (x) => (x == null ? null : +x.toFixed(2))
const both = ids.filter((id) => open[id].sw && bed[id].sw)
const swRows = TRAITS.map((t) => {
  const pairs = both.map((id) => [!!open[id].sw[t.key], !!bed[id].sw[t.key]])
  const hp = Object.keys(hand).filter((id) => hand[id][t.key] != null)
  return { key: t.key, label: t.label, n: pairs.length, agree: r2(pairs.filter(([a, b]) => a === b).length / pairs.length), kappa: kappa(pairs),
    openPresent: pairs.filter(([a]) => a).length, bedrockPresent: pairs.filter(([, b]) => b).length,
    hand: hp.length ? { n: hp.length, open: r2(hp.filter((id) => !!open[id].sw?.[t.key] === hand[id][t.key]).length / hp.length), bedrock: r2(hp.filter((id) => !!bed[id].sw?.[t.key] === hand[id][t.key]).length / hp.length) } : null }
})
const allPairs = both.flatMap((id) => TRAITS.map((t) => [!!open[id].sw[t.key], !!bed[id].sw[t.key]]))
const handAll = Object.keys(hand).flatMap((id) => Object.keys(hand[id]).map((k) => [hand[id][k], !!open[id].sw?.[k], !!bed[id].sw?.[k]]))
const weRows = ["goal", "tone", "party"].map((c) => {
  const ok = ids.filter((id) => open[id].we && bed[id].we)
  const conf = {}
  for (const id of ok) { const k = `${open[id].we[c]}|${bed[id].we[c]}`; conf[k] = (conf[k] ?? 0) + 1 }
  return { column: c, n: ok.length, agree: r2(ok.filter((id) => open[id].we[c] === bed[id].we[c]).length / ok.length), pairs: conf }
})
const out = { builtAt: new Date().toISOString(), tag: TAG, bedrock: "us.anthropic.claude-sonnet-4-6", videos: ids.length, swayableCompared: both.length,
  swayable: { pooledAgree: r2(allPairs.filter(([a, b]) => a === b).length / allPairs.length), pooledKappa: kappa(allPairs), rows: swRows },
  hand: { videos: Object.keys(hand), labels: handAll.length, open: r2(handAll.filter(([h, o]) => h === o).length / (handAll.length || 1)), bedrock: r2(handAll.filter(([h, , b]) => h === b).length / (handAll.length || 1)) },
  wesleyan: weRows, perVideo: Object.fromEntries(ids.map((id) => [id, { open: open[id], bedrock: bed[id], hand: hand[id] ?? null }])) }
fs.writeFileSync(path.join(root, process.env.OUT ?? "data/generated/model/codebook-verify.json"), JSON.stringify(out, null, 1) + "\n")

console.log(`Swayable, ${both.length} videos: pooled agreement ${out.swayable.pooledAgree}, kappa ${out.swayable.pooledKappa}; hand labels ${handAll.length} on ${Object.keys(hand).join(", ")}: open ${out.hand.open}, Bedrock ${out.hand.bedrock}\n`)
console.log("| trait | agree | kappa | present open / Bedrock | hand: open / Bedrock |\n|---|---|---|---|---|")
for (const r of swRows) console.log(`| ${r.key} | ${r.agree} | ${r.kappa ?? "—"} | ${r.openPresent} / ${r.bedrockPresent} | ${r.hand ? `${r.hand.open} / ${r.hand.bedrock}` : "—"} |`)
console.log("\n| column | agree | open|Bedrock counts |\n|---|---|---|")
for (const r of weRows) console.log(`| ${r.column} | ${r.agree} (n=${r.n}) | ${Object.entries(r.pairs).map(([k, v]) => `${k} ${v}`).join(", ")} |`)
