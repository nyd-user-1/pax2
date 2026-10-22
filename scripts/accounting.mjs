// The accounting page (docs/ACCOUNTING.html): every catalog short and what the pipeline holds for
// it — transcript, media on hand (label-picked or label-blind), composition measured from the file,
// serving-index embedding, Lab Tested. One static page in the RESONANCE-COMPARE dress: searchable,
// sortable, rows rendered as they scroll so 19k rows paint instantly.
//
// Usage: node scripts/accounting.mjs
// Reads  data/generated/feed-index.json (the universe), data/generated/transcripts.json,
//        data/generated/model/composition.json (media-derived fields = measured),
//        data/raw/composition/index/rows.json, data/generated/lab-tested.json,
//        data/generated/model/video-blind-sample.json, and the live S3 catalog-media listing.
// Writes docs/ACCOUNTING.html
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const universe = read("data/generated/feed-index.json")
const transcripts = new Set(Object.keys(read("data/generated/transcripts.json")))
const compAll = read("data/generated/model/composition.json")
const compRows = compAll.shorts ?? compAll.videos
const composition = new Set(Object.keys(compRows).filter((k) => compRows[k].cutsPerSec != null))
const index = new Set(read("data/raw/composition/index/rows.json").map((r) => r.id))
const lab = new Set(read("data/generated/lab-tested.json"))
const e2 = new Set(read("data/generated/e2.json"))
const blind = new Set(read("data/generated/model/video-blind-sample.json").ids)

// Media on hand is whatever sits in S3 — the one authoritative inventory.
const media = new Set(
  execSync("aws s3 ls s3://pax-2-638175140432/catalog-media/ --region us-east-1", { maxBuffer: 64 * 1024 * 1024 })
    .toString()
    .split("\n")
    .map((l) => l.trim().split(/\s+/).pop() ?? "")
    .filter(Boolean)
    .map((f) => f.replace(/\.(mp4|m4a)$/, ""))
)

// Per row: [id, title, channel, views, ratio, transcript, media(0 none / 1 picked / 2 blind),
// composition, index, lab, e2] — compact arrays keep the embedded data near 2 MB.
const rows = universe.map((v) => [
  v.id,
  v.title,
  v.channel,
  v.views ?? 0,
  typeof v.ratio === "number" ? v.ratio : null,
  transcripts.has(v.id) ? 1 : 0,
  media.has(v.id) ? (blind.has(v.id) ? 2 : 1) : 0,
  composition.has(v.id) ? 1 : 0,
  index.has(v.id) ? 1 : 0,
  lab.has(v.id) ? 1 : 0,
  e2.has(v.id) ? 1 : 0,
])

const n = (f) => rows.filter(f).length
const fmt = (x) => x.toLocaleString("en-US")
const k = (x) => (x >= 950 ? `${Math.round(x / 1000)}k` : `${x}`)
const counts = {
  all: rows.length,
  transcript: n((r) => r[5]),
  media: n((r) => r[6] > 0),
  picked: n((r) => r[6] === 1),
  blind: n((r) => r[6] === 2),
  composition: n((r) => r[7]),
  index: n((r) => r[8]),
  lab: n((r) => r[9]),
  e2: n((r) => r[10]),
}


// The model ledger, from each model's own artifact (data/generated/model/*):
// composition-ranker{,-combined}.json, headline-v1.json (gateH), encoder.json (gates E and R),
// video/var-model-v3v.json + video/bench-m2.json (Gate M2), pairwise-v0.json.
const PASSED = [
  ["Outperformed-3\u00d7 classifier (PAX2 Classifier v3)", "predicts whether a short beats 3\u00d7 its channel median before publish", "metadata, transcript, text embedding", "AUC above v1's 0.604 and within-channel at least 0.55, held-out channels", "0.648 (within-channel 0.63)", "2026-10-21", "serving"],
  ["Headline picker (PAX2 Headline Ranker v1)", "picks the stronger of two headlines", "the headline text (bert-base-uncased, Upworthy-trained)", "held-out pairwise accuracy at least 0.630 (v0 + 0.02)", "0.672", "2026-10-18", "serving (Lambda)"],
  ["Behavior-corrected text embedding (PAX2 Encoder)", "places videos near videos that performed alike", "transcript text", "pooled kNN-AUC at least stock bge-m3 + 0.02, within-channel not below stock", "+0.031 pooled, +0.022 within", "2026-10-19", "serving (the index)"],
  ["Pairwise outperformer picker from composition (PAX2 Composition Ranker)", "picks which of a same-channel pair outperformed, from the video file's measurables", "composition features; the combined variant adds neighbor evidence", "held-out pair accuracy at least 0.55", "0.566; combined 0.595", "2026-10-20", "ready \u2014 no caller yet"],
]
const FAILED = [
  ["Video arm of the classifier (fullvideo)", "add the video file's embedding to the classifier", "VideoPrism video embedding plus the full features", "Gate M2: beat the text-only AUC by 0.02 on held-out rows with media", "0.636 vs 0.648 (\u22120.011)", "2026-10-21", "the video embedding added nothing over text"],
  ["Embedding retrain candidate (Gate R)", "a retrain of the text embedding", "transcript text", "pooled kNN-AUC at least the serving encoder's, within-channel not below", "under the serving encoder", "2026-10-19", "did not beat the model already serving"],
  ["Pairwise classifier v0 (PAX2 Classifier, pairs)", "picks the outperformer of a same-channel pair from pre-publish features", "35 pre-publish features", "held-out pair accuracy at least 0.55", "0.546", "2026-10-19", "under the bar, and under v1 on the same pairs"],
]
const mrow = (r, n) => `<tr><td class="mnum">${n}</td>${r.map((c, i) => `<td class="${i === 0 ? "mname" : "mtxt"}">${c}</td>`).join("")}</tr>`
const mtable = (title, rows, last, from) => `<div class="mcard"><h2>${title}</h2><table>
<thead><tr><th></th><th>Model</th><th>What it does</th><th>Inputs</th><th>Gate</th><th>Score</th><th>Trained</th><th>${last}</th></tr></thead>
<tbody>${rows.map((r, i) => mrow(r, from + i)).join("\n")}</tbody></table></div>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accounting</title>
<style>
 :root { --blue:#1e3a8a; --ink:#0f172a; --muted:#64748b; --border:#e2e8f0; --mist:#f1f5f9; }
 body { margin:0; padding:48px 24px; background:var(--mist); font:16px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); }
 .wrap { max-width:1280px; margin:0 auto; }
 .card { background:#fff; border-radius:20px; box-shadow:0 1px 3px rgb(2 6 23/.06); outline:1px solid rgb(15 23 42/.06); padding:36px 40px 28px; }
 h1 { margin:0 0 24px; font-size:26px; font-weight:650; color:var(--blue); }
 .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
 .tile { border:1px solid var(--border); border-radius:14px; display:flex; overflow:hidden; }
 .half { flex:1; padding:12px 8px; text-align:center; background:none; border:none; font:inherit; color:inherit; cursor:pointer; }
 .half + .half { border-left:1px solid var(--border); }
 .half.on { background:var(--mist); }
 .half b { display:block; font-size:20px; } .half p { margin:2px 0 0; font-size:12px; color:var(--muted); }
 #q { width:100%; box-sizing:border-box; margin-bottom:18px; padding:12px 16px; font:inherit; border:1px solid var(--border); border-radius:12px; outline:none; }
 #q:focus { border-color:var(--blue); }
 table { width:100%; border-collapse:collapse; }
 th { text-align:left; font-size:12px; letter-spacing:.06em; color:var(--muted); padding:10px 12px; border-bottom:1px solid var(--border); white-space:nowrap; cursor:pointer; user-select:none; }
 th.on { color:var(--blue); background:var(--mist); }
 td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; white-space:nowrap; font-weight:600; }
 td.vid { display:flex; align-items:center; gap:12px; max-width:420px; white-space:normal; font-weight:400; }
 td.vid img { width:56px; height:56px; object-fit:cover; border-radius:10px; flex:none; background:var(--mist); }
 td.vid b { display:block; font-size:14px; line-height:1.3; } td.vid i { font-style:normal; font-size:12px; color:var(--muted); }
 td.y { color:#15803d; } td.dash { color:#cbd5e1; font-weight:500; }
 td.kind { font-weight:500; font-size:13px; }
 #tally { margin:14px 0 0; font-size:13px; color:var(--muted); }
 .tabs { display:flex; gap:6px; padding:0 28px; }
 .tabbtn { padding:10px 22px; border-radius:14px 14px 0 0; font-weight:600; font-size:15px; color:var(--muted); background:#e6ebf2; outline:1px solid rgb(15 23 42/.06); cursor:pointer; border:none; font:inherit; font-weight:600; }
 .tabbtn.on { background:#fff; color:var(--blue); position:relative; z-index:2; }
 .mcard { margin-bottom:28px; }
 .mcard h2 { font-size:19px; font-weight:650; color:var(--blue); margin:0 0 10px; }
 td.mname { font-weight:600; white-space:normal; min-width:170px; }
 td.mnum { color:var(--muted); font-weight:600; }
 td.mtxt { font-weight:400; white-space:normal; font-size:13px; color:#334155; }
 #models { display:none; } body.m #models { display:block; } body.m #acct { display:none; }
</style></head><body>
<div class="wrap">
<nav class="tabs">
 <button class="tabbtn on" id="ta" onclick="document.body.classList.remove('m');ta.classList.add('on');tm.classList.remove('on')">Accounting</button>
 <button class="tabbtn" id="tm" onclick="document.body.classList.add('m');tm.classList.add('on');ta.classList.remove('on')">Models</button>
</nav>
<div class="card" id="acct">
 <h1>Accounting</h1>
 <div class="grid">
  <div class="tile"><button class="half" data-k="3" data-dir="-1"><b>${k(counts.all)}</b><p>Catalog</p></button></div>
  <div class="tile"><button class="half" data-k="5" data-dir="-1"><b>${k(counts.transcript)}</b><p>Transcript</p></button><button class="half" data-k="5" data-dir="1"><b>${k(counts.all - counts.transcript)}</b><p>without</p></button></div>
  <div class="tile"><button class="half" data-k="6" data-dir="-1"><b>${k(counts.media)}</b><p>Media</p></button><button class="half" data-k="6" data-dir="1"><b>${k(counts.all - counts.media)}</b><p>without</p></button></div>
  <div class="tile"><button class="half" data-k="7" data-dir="-1"><b>${k(counts.composition)}</b><p>Composition</p></button><button class="half" data-k="7" data-dir="1"><b>${k(counts.all - counts.composition)}</b><p>without</p></button></div>
  <div class="tile"><button class="half" data-k="8" data-dir="-1"><b>${k(counts.index)}</b><p>Index</p></button><button class="half" data-k="8" data-dir="1"><b>${k(counts.all - counts.index)}</b><p>without</p></button></div>
  <div class="tile"><button class="half" data-k="9" data-dir="-1"><b>${k(counts.lab)}</b><p>Lab Tested</p></button><button class="half" data-k="9" data-dir="1"><b>${k(counts.all - counts.lab)}</b><p>without</p></button></div>
 </div>
 <input id="q" type="search" placeholder="Search title or channel" autofocus>
 <table>
  <thead><tr>
   <th data-k="1">Video</th><th data-k="3">Views</th><th data-k="4">Outlier</th>
   <th data-k="5">Transcript</th><th data-k="6">Media</th><th data-k="7">Composition</th>
   <th data-k="8">Index</th><th data-k="9">Lab</th>
  </tr></thead>
  <tbody id="tb"></tbody>
 </table>
 <p id="tally"></p>
 <div id="more"></div>
</div>
<div class="card" id="models">
 <h1>Models</h1>
 ${mtable("Passed", PASSED, "Status", 1)}
 ${mtable("Failed", FAILED, "Why it failed", PASSED.length + 1)}
</div></div>
<script>
const DATA = ${JSON.stringify(rows)};
const tb = document.getElementById("tb"), q = document.getElementById("q"), tally = document.getElementById("tally");
let key = 3, dir = -1, needle = "", shown = 0, view = DATA;
const PAGE = 150;
const MEDIA = ["", "picked", "blind"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mark = (on) => on ? '<td class="y">\\u2713</td>' : '<td class="dash">\\u2014</td>';
function rowHtml(r) {
  return '<tr><td class="vid"><img loading="lazy" src="https://i.ytimg.com/vi/' + r[0] + '/default.jpg" alt=""><span><b>' +
    esc(r[1]) + '</b><i>' + esc(r[2]) + '</i></span></td><td>' + r[3].toLocaleString("en-US") + '</td><td>' +
    (r[4] == null ? "\\u2014" : r[4].toFixed(r[4] >= 10 ? 0 : 1) + "\\u00d7") + '</td>' +
    mark(r[5]) + mark(r[6]) +
    mark(r[7]) + mark(r[8]) + mark(r[9]) + '</tr>';
}
function renderMore() {
  const next = view.slice(shown, shown + PAGE);
  tb.insertAdjacentHTML("beforeend", next.map(rowHtml).join(""));
  shown += next.length;
  tally.textContent = shown.toLocaleString("en-US") + " of " + view.length.toLocaleString("en-US");
}
function rebuild() {
  const words = needle.toLowerCase().split(/\\s+/).filter(Boolean);
  view = words.length ? DATA.filter((r) => { const h = (r[1] + " " + r[2]).toLowerCase(); return words.every((w) => h.includes(w)) }) : DATA.slice();
  view.sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null) return 1; if (y == null) return -1;
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
  });
  tb.innerHTML = ""; shown = 0; renderMore();
}
function paint() {
  document.querySelectorAll("th").forEach((x) => {
    x.textContent = x.textContent.replace(/ [\\u2191\\u2193]$/, "");
    x.classList.toggle("on", +x.dataset.k === key);
    if (+x.dataset.k === key) x.textContent += dir === 1 ? " \\u2191" : " \\u2193";
  });
  document.querySelectorAll(".half").forEach((x) => x.classList.toggle("on", +x.dataset.k === key && +x.dataset.dir === dir));
}
function setSort(k, d) { key = k; dir = d; rebuild(); paint() }
q.addEventListener("input", () => { needle = q.value; rebuild() });
document.querySelectorAll("th").forEach((th) => th.addEventListener("click", () =>
  setSort(+th.dataset.k, +th.dataset.k === key ? -dir : (+th.dataset.k === 1 ? 1 : -1))
));
document.querySelectorAll(".half").forEach((h) => h.addEventListener("click", () => setSort(+h.dataset.k, +h.dataset.dir)));
new IntersectionObserver((es) => { if (es[0].isIntersecting && shown < view.length) renderMore() }).observe(document.getElementById("more"));
setSort(3, -1);
</script>
</body></html>
`
// Written atomically: a reload mid-write once served a truncated script and an empty table.
fs.writeFileSync(path.join(root, "docs/ACCOUNTING.html.tmp"), html)
fs.renameSync(path.join(root, "docs/ACCOUNTING.html.tmp"), path.join(root, "docs/ACCOUNTING.html"))
console.log(`ACCOUNTING.html: ${rows.length} rows, ${(html.length / 1e6).toFixed(1)} MB`, counts)
