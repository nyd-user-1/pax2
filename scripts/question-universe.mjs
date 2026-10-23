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
  return `<div class="q${q.pass === 2 ? " p2" : ""}" data-id="${q.id}" data-ask="${esc(q.ask)}" data-score="${q.score ?? ""}">
  <button type="button" class="chip">${esc(q.ask)}</button>${q.scope === "channel" ? `<span class="tag">channel</span>` : ""}
  <div class="lk">${[1, 2, 3, 4, 5].map((v) => `<button type="button" data-v="${v}">${v}</button>`).join("")}</div>
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
.chip{cursor:pointer;font:inherit;font-size:14px}
.q.on .chip{background:#1e3a8a;border-color:#1e3a8a;color:#fff}
.lk{display:flex;gap:4px;margin:8px 2px 0}
.lk button{width:30px;height:26px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font:12px -apple-system,system-ui,sans-serif;color:#475569;cursor:pointer}
.lk button.on{background:#2563eb;border-color:#2563eb;color:#fff}
.bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#f5f7fb;padding:10px 0 14px;margin-bottom:6px}
.bar button,.bar select{border:1px solid #cbd5e1;border-radius:999px;background:#fff;padding:6px 14px;font:13px -apple-system,system-ui,sans-serif;color:#0f172a;cursor:pointer}
.bar button.on{background:#1e3a8a;color:#fff;border-color:#1e3a8a}
.bar .key{font-size:13px;font-weight:600;color:#1e3a8a;margin-right:4px}
.bar .n{font-size:13px;color:#64748b;margin-left:auto}
.hide{display:none}
@media (max-width:640px){body{padding:28px 14px}section{padding:18px}}
</style></head><body><div class="wrap">
<h1>The question universe</h1>
<div class="bar"><span class="key">1 cut · 5 keep</span><button type="button" id="picked">Picked only</button><select id="min"><option value="0">Any score</option><option value="5">5</option><option value="4">4 and up</option><option value="3">3 and up</option><option value="-1">Unscored</option></select><button type="button" id="sort">Sort by score</button><button type="button" id="copy">Copy scores</button><button type="button" id="clear">Clear</button><span class="n" id="n"></span></div>
${REGISTERS.map((r) => {
  const qs = QUESTIONS.filter((q) => q.register === r.id)
  return `<section><h2>${esc(r.label)}<small>${qs.filter((q) => q.pass !== 2).length}${qs.some((q) => q.pass === 2) ? ` + ${qs.filter((q) => q.pass === 2).length} pass 2` : ""}</small></h2><div class="grid">${qs.map(chip).join("\n")}</div></section>`
}).join("\n")}
</div><script>
const KEY="pax2:question-universe:v1"
const st=JSON.parse(localStorage.getItem(KEY)||"{}")
const save=()=>{localStorage.setItem(KEY,JSON.stringify(st));draw()}
const qs=[...document.querySelectorAll(".q")]
const grids=[...document.querySelectorAll(".grid")]
const order=new Map(qs.map((q,i)=>[q,i]))
let pickedOnly=false,sorted=false
for(const q of qs){const id=q.dataset.id;st[id]??={};if(st[id].s==null&&q.dataset.score)st[id].s=+q.dataset.score
q.querySelector(".chip").onclick=()=>{st[id].p=!st[id].p;save()}
q.querySelectorAll(".lk button").forEach(b=>b.onclick=()=>{const v=+b.dataset.v;st[id].s=st[id].s===v?undefined:v;save()})}
function draw(){const min=+document.getElementById("min").value;let picked=0,scored=0
for(const q of qs){const r=st[q.dataset.id]||{};if(r.p)picked++;if(r.s)scored++
q.classList.toggle("on",!!r.p)
q.querySelectorAll(".lk button").forEach(b=>b.classList.toggle("on",+b.dataset.v===r.s))
const hide=(pickedOnly&&!r.p)||(min>0&&!(r.s>=min))||(min===-1&&r.s)
q.classList.toggle("hide",hide)}
for(const g of grids){const items=[...g.children];items.sort((a,b)=>sorted?((st[b.dataset.id]?.s||0)-(st[a.dataset.id]?.s||0))||order.get(a)-order.get(b):order.get(a)-order.get(b));items.forEach(i=>g.appendChild(i))}
document.getElementById("n").textContent=scored+" of "+qs.length+" scored, "+picked+" picked"
document.getElementById("picked").classList.toggle("on",pickedOnly);document.getElementById("sort").classList.toggle("on",sorted)}
document.getElementById("picked").onclick=()=>{pickedOnly=!pickedOnly;draw()}
document.getElementById("sort").onclick=()=>{sorted=!sorted;draw()}
document.getElementById("min").onchange=draw
document.getElementById("clear").onclick=()=>{if(confirm("Clear every score and pick?")){for(const k in st)delete st[k];save()}}
document.getElementById("copy").onclick=async e=>{const lines=qs.map(q=>{const r=st[q.dataset.id]||{};return [q.dataset.id,r.s??"",r.p?"picked":"",q.dataset.ask].join(String.fromCharCode(9))})
const T=String.fromCharCode(9),N=String.fromCharCode(10);const text=["id","score","picked","ask"].join(T)+N+lines.join(N);try{await navigator.clipboard.writeText(text);e.target.textContent="Copied"}catch{prompt("Copy:",text)}setTimeout(()=>e.target.textContent="Copy scores",1500)}
draw()
</script></body></html>
`
fs.writeFileSync("docs/sketches/question-universe.html", html)
console.log(`question-universe.html: ${free} free, ${p2} pass 2, ${(html.length / 1024).toFixed(0)} KB`)
for (const q of QUESTIONS.filter((q) => q.pass !== 2)) console.log(String(coverage(q)).padStart(5), q.id)
