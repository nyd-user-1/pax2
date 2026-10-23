// Renders docs/sketches/question-universe.html from src/lib/question-bank.ts: every question as its chip,
// the columns it reads and its basis beneath, and how many of the 5,379 baseline shorts it answers today.
// Pass-2 questions are drawn dashed.
//   node --experimental-strip-types scripts/question-universe.mjs
import fs from "node:fs"
import { QUESTIONS, REGISTERS, CENSUS_AUDIT } from "../src/lib/question-bank.ts"

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"))
const census = read("data/generated/model/vqa-census.json").shorts
const base = Object.keys(census)
const has = (ids) => new Set(base.filter((id) => ids.has(id)))
const all = new Set(base)

const rawComp = new Set(fs.readdirSync("data/raw/composition/raw").map((f) => f.replace(/\.json$/, "")))
const comp = read("data/generated/model/composition.json").shorts
const speech = new Set(Object.entries(comp).filter(([, v]) => v.firstWordSec != null).map(([k]) => k))
const tx = read("data/generated/transcripts.json")
const transcript = new Set(Object.entries(tx).filter(([, v]) => v.text).map(([k]) => k))
const v72 = read("data/generated/model/velocity-features.json").byId
const velocity72 = new Set(Object.entries(v72).filter(([, v]) => v.views72h != null).map(([k]) => k))
const codebook = read("data/generated/codebook.json")

const stores = {
  catalog: all, census: all, index: all, craft: all, modes: all, topics: all, policy: all,
  findings: all, lengths: all, registry: all,
  composition: has(rawComp), speech: has(speech), transcript: has(transcript), velocity72: has(velocity72),
  swayable: new Set(), codebook: has(new Set(Object.entries(codebook).filter(([, v]) => v.swayable).map(([k]) => k))), "frames-gpu": new Set(),
}
const coverage = (q) => base.filter((id) => q.needs.every((s) => stores[s].has(id))).length

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const n = (x) => x.toLocaleString("en-US")

const chip = (q) => {
  const c = q.pass === 2 ? null : coverage(q)
  const audit = q.census ? CENSUS_AUDIT[q.census] : null
  return `<div class="q${q.pass === 2 ? " p2" : ""}">
  <span class="chip">${esc(q.ask)}</span>${q.scope === "channel" ? `<span class="tag">channel</span>` : ""}
  <div class="meta"><div><b>Reads</b> ${q.reads.map((r) => `<code>${esc(r)}</code>`).join(" ")}</div>
  <div><b>Basis</b> ${esc(q.basis)}${audit ? `; ${audit.right} of ${audit.of} right in audit` : ""}</div>
  ${q.template ? `<div><b>Answer</b> ${esc(q.template)}</div>` : ""}
  ${c == null ? `<div class="cov">GPU read, pass 2</div>` : `<div class="cov${c === 0 ? " zero" : ""}">${n(c)} of ${n(base.length)} baseline shorts${c < base.length && q.unlock ? `; the rest: ${esc(q.unlock)}` : ""}</div>`}</div>
</div>`
}

const free = QUESTIONS.filter((q) => q.pass !== 2).length
const p2 = QUESTIONS.length - free
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketch: the question universe</title>
<style>
body{margin:0;padding:48px 24px;background:#f5f7fb;font:15px/1.5 -apple-system,system-ui,sans-serif;color:#0f172a}
.wrap{max-width:1120px;margin:0 auto}
h1{font-size:26px;color:#1e3a8a;margin:0 0 24px}
section{background:#fff;border-radius:20px;outline:1px solid rgb(15 23 42/.06);padding:24px 28px;margin-bottom:20px}
h2{font-size:17px;color:#1e3a8a;margin:0 0 16px}
h2 small{font-weight:400;color:#94a3b8;font-size:13px;margin-left:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px 22px}
.q{min-width:0}
.chip{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:7px 14px;font-size:14px;background:#fff;color:#0f172a}
.p2 .chip{border-style:dashed;color:#64748b;background:transparent}
.tag{margin-left:6px;font-size:11px;color:#2563eb;background:#dbeafe;border-radius:999px;padding:2px 8px;vertical-align:middle}
.meta{margin:8px 2px 0;font-size:12px;line-height:1.45;color:#64748b;display:flex;flex-direction:column;gap:3px}
.meta b{color:#334155;font-weight:600;margin-right:4px}
code{font:11px ui-monospace,Menlo,monospace;background:#f1f5f9;border-radius:4px;padding:0 4px;color:#334155;word-break:break-all}
.cov{color:#16a34a}.cov.zero{color:#b45309}.p2 .cov{color:#94a3b8}
@media (max-width:640px){body{padding:28px 14px}section{padding:18px}}
</style></head><body><div class="wrap">
<h1>The question universe</h1>
${REGISTERS.map((r) => {
  const qs = QUESTIONS.filter((q) => q.register === r.id)
  return `<section><h2>${esc(r.label)}<small>${qs.filter((q) => q.pass !== 2).length}${qs.some((q) => q.pass === 2) ? ` + ${qs.filter((q) => q.pass === 2).length} pass 2` : ""}</small></h2><div class="grid">${qs.map(chip).join("\n")}</div></section>`
}).join("\n")}
</div></body></html>
`
fs.writeFileSync("docs/sketches/question-universe.html", html)
console.log(`question-universe.html: ${free} free, ${p2} pass 2, ${(html.length / 1024).toFixed(0)} KB`)
for (const q of QUESTIONS.filter((q) => q.pass !== 2)) console.log(String(coverage(q)).padStart(5), q.id)
