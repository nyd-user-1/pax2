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


// The model ledger: name, kind, what it does, inputs, score, then Live or Staged (passed) or why it
// failed. Every number is from the model's own record: the NYSgpt/martian-* model cards
// on Hugging Face (one repo per fitted model, published pass or fail) and the artifacts under
// data/generated/model/.
const PASSED = [
  ["Outlier classifier v1", "logistic regression", "chance a short outperforms 3\u00d7 its channel median, from publish-day fields", "title, description, tags, length, posting time, thumbnail", "AUC 0.611 pooled, 0.566 within-channel", "Live"],
  ["Outlier classifier v3", "logistic regression", "the same, with transcript and embedding evidence", "v1's fields + transcript TF-IDF + 32 components of the PAX2 Encoder embedding", "0.648 held-out, 0.630 within", "Live"],
  ["Early-hit predictor", "logistic regression", "whether a short hits 3\u00d7 by 72 hours, from its first hours of views", "the poller's view curve + v1's features", "6-hour AUC 0.729 pooled, 0.862 within", "Live"],
  ["Behavior-corrected text embedding", "fine-tuned embedding", "places videos near videos that performed alike", "title, description, transcript (fine-tuned bge-m3)", "kNN-AUC over stock +0.031 pooled, +0.022 within", "Live"],
  ["Candidate re-scorer", "fine-tuned transformer", "re-scores the embedding's nearest candidates pairwise", "the two shorts' texts (gte-reranker-modernbert fine-tune)", "0.572 pooled over 0.571; 0.563 within", "Live"],
  ["Headline picker", "fine-tuned transformer", "picks the stronger of two headlines", "the headline text (bert-base-uncased, Upworthy-trained)", "held-out pairwise 0.672", "Live"],
  ["Persuasion evidence reference", "reference", "measured per-trait effects on favorability and vote choice from 146 randomized ad tests", "Swayable replication archive (APSR 2024)", "e.g. explicit ask +0.59 points of vote choice (0.19\u20130.99)", "Live"],
  ["Composition pair picker", "Bradley-Terry pairwise", "picks which of a same-channel pair outperformed, from the file's measurables", "composition features; combined variant adds neighbor evidence", "pair accuracy 0.566; combined 0.595", "Staged"],
  ["Pairwise picker, Reform & Voting rights", "Bradley-Terry pairwise", "same-channel pair winner within two families", "35 pre-publish features", "pair accuracy 0.550 over v1's 0.512", "Staged"],
  ["Resonance text embedding, behavior arm", "fine-tuned embedding", "the encoder recipe plus a behavioral co-occurrence term", "same corpus + co-outlier and co-surge groups", "kNN-AUC over stock +0.027; pair ranking 0.582 over the encoder's 0.562", "Staged"],
  ["Resonance text embedding, full arm", "fine-tuned embedding", "the same with publish-week co-surge proxy groups", "as above, \u03bb = 0.25", "kNN-AUC over stock +0.037; pair ranking 0.578", "Staged"],
  ["Watch-through regressor v0", "ridge regression", "how much of a short a viewer watches, from length, type, tags", "KuaiRand-1K random exposures (pretrain)", "Spearman 0.746 per held-out video", "Live"],
  ["Feed ranker v0", "logistic regression", "which short a given reader watches through", "KuaiRand-1K (pretrain): video + reader history features", "AUC 0.697 pooled, 0.553 within-reader", "Staged"],
]
const FAILED = [
  ["Outlier classifier v2", "logistic regression", "add the transcript's words to v1", "v1's fields + 400-term TF-IDF", "AUC 0.597 against a 0.624 bar", "the transcript's words, read this way, do not predict an outlier"],
  ["Outlier classifier v3b", "logistic regression", "add composition features to v3", "v3's features + composition", "0.589 vs v3's 0.648", "label-picked media coverage; composition added 0.005 where measured"],
  ["Pairwise picker, all families", "Bradley-Terry pairwise", "same-channel pair winner, every family", "35 pre-publish features", "0.546 vs v1's 0.563", "under v1 on the same pairs"],
  ["Semantic-ID cell model", "residual k-means", "score a short by its ID cell's outlier share", "3-level residual k-means over the encoder index", "0.558; retry 0.571", "a cell table carries less than the 20 nearest neighbors (0.608)"],
  ["Embedding retrain candidate", "fine-tuned embedding", "a retrain of the text embedding", "transcript text", "under the serving encoder, pooled", "did not beat the model already serving"],
  ["Video resonance heads v1, v2", "projection head", "a projection head over frozen VideoPrism embeddings", "16 frames per video, no audio", "0.551, 0.566 \u2014 below stock's 0.558 band on validation", "halted before the gate; v3 selected instead"],
  ["Video resonance head v3", "projection head", "the selected head", "as above, \u03bb = 1.0, 5 epochs", "held-out pairs 0.5695 against a 0.5776 bar", "+0.012 over stock, inside stock's own interval"],
  ["Video resonance head v3b", "projection head", "v3 with negatives from a label-blind sample", "as v3; negatives 16.4% outliers not 49.8%", "held-out pairs 0.5508 against a 0.5776 bar", "label-heavy negatives did not explain the failure"],
  ["Video arm of the classifier", "logistic regression", "add the video embedding to classifier v3", "VideoPrism embedding + v3's features", "0.636 vs 0.648 (\u22120.011)", "the video embedding added nothing over text"],
]
// The Flow tab places the models: the four the scoring step calls sit at Scored; every other passed
// model was fitted before a take arrives, so it stands in a row above the triggers. Names are the ledger's.
const AT_SCORED = ["Headline picker", "Outlier classifier v3", "Behavior-corrected text embedding", "Candidate re-scorer"]
for (const n of AT_SCORED) if (!PASSED.some((r) => r[0] === n)) throw new Error(`Flow names a model the ledger lacks: ${n}`)
const chips = (names) => `<div class="fchips">${names.map((n) => `<span class="fchip">${n}</span>`).join("")}</div>`
const BEFORE = PASSED.map((r) => r[0]).filter((n) => !AT_SCORED.includes(n))

const mrow = (r, n) => `<tr><td class="mnum">${n}</td>${r.map((c, i) => `<td class="${i === 0 ? "mname" : "mtxt"}">${c}</td>`).join("")}</tr>`
const mtable = (title, rows, last, from) => `<div class="mcard"><h2>${title}</h2><table>
<thead><tr><th></th><th>Model</th><th>Kind</th><th>What it does</th><th>Inputs</th><th>Score</th><th>${last}</th></tr></thead>
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
 #models, #flow { display:none; }
 body.m #models { display:block; } body.m #acct { display:none; }
 body.f #flow { display:block; } body.f #acct { display:none; }
 .fbox { display:inline-block; border:1px solid #cbd5e1; border-radius:10px; padding:10px 18px; font-weight:600; background:#fff; }
 .fbox.trigger { background:var(--blue); color:#fff; border-color:var(--blue); }
 .fnote { font-size:12px; color:var(--muted); font-weight:400; display:block; margin-top:2px; }
 .fbox.trigger .fnote { color:#c7d2fe; }
 .fline { width:1px; height:18px; background:#cbd5e1; margin:0 auto; }
 .lab { display:grid; grid-template-columns:190px 40px minmax(300px,480px) 40px 190px; justify-content:center; align-items:center; }
 .lab .stage { grid-column:3; text-align:center; }
 .lab .fline { grid-column:3; }
 .trio { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
 .rail { border:0 solid #cbd5e1; }
 .railcard { border:1px dashed #94a3b8; border-radius:12px; background:#fff; padding:10px 12px; font-size:12px; color:#334155; }
 .railcard b { display:block; font-size:13px; color:var(--ink); margin-bottom:2px; }
 .chips { margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }
 .chip { font-size:11px; font-weight:600; color:var(--blue); background:#eef2ff; border-radius:999px; padding:3px 9px; }
 .fbox.ftrig { background:var(--blue); border-color:var(--blue); color:#fff; }
 .fbox.ftrig .fnote { color:#dbeafe; }
 .fchips { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; max-width:720px; margin:0 auto; }
 .fchip { border:1px solid #c7d2fe; background:#eef2ff; color:var(--blue); border-radius:999px; padding:3px 10px; font-size:12px; font-weight:600; }
 .fat { display:flex; flex-direction:column; align-items:center; gap:8px; }
</style></head><body>
<div class="wrap">
<nav class="tabs">
 <button class="tabbtn on" id="ta" onclick="document.body.className='';ta.classList.add('on');tm.classList.remove('on');tf.classList.remove('on')">Accounting</button>
 <button class="tabbtn" id="tm" onclick="document.body.className='m';tm.classList.add('on');ta.classList.remove('on');tf.classList.remove('on')">Models</button>
 <button class="tabbtn" id="tf" onclick="document.body.className='f';tf.classList.add('on');ta.classList.remove('on');tm.classList.remove('on')">Flow</button>
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
</div>
<div class="card" id="flow">
 <h1>Flow</h1>
 <div class="lab">
  <div class="stage trio" style="grid-row:1">
   <div class="fbox trigger">Record on camera<span class="fnote">teleprompter, /record/camera</span></div>
   <div class="fbox trigger">Upload a finished file<span class="fnote">/record/camera#upload</span></div>
   <div class="fbox trigger">Flask a catalog video<span class="fnote">the flask button on any card</span></div>
  </div>
  <div class="fline" style="grid-row:2"></div>
  <div class="stage" style="grid-row:3">
   <div class="fbox">Measure<span class="fnote">cuts, loudness, on-screen text · transcript · embedding into the index</span></div>
  </div>
  <div class="fline" style="grid-row:4"></div>
  <div class="stage" style="grid-row:5">
   <div class="fbox">Score<span class="fnote">the read, saved with the video</span></div>
   <div class="chips">
    <span class="chip">Outlier classifier</span><span class="chip">Headline picker</span><span class="chip">Pair-picker read</span>
    <span class="chip">Neighbor re-scorer</span><span class="chip">Persuasion citations</span><span class="chip">Ask it anything (Q)</span>
   </div>
  </div>
  <div class="fline" style="grid-row:6"></div>
  <div class="stage" style="grid-row:7">
   <div class="fbox">Review and deliver<span class="fnote">PAX2 review · the flask granted · link sent</span></div>
  </div>
  <div class="fline" style="grid-row:8"></div>
  <div class="stage" style="grid-row:9">
   <div class="fbox">Publish and watch<span class="fnote">the poller · the early-hit read at 72 hours</span></div>
  </div>
  <div class="rail" style="grid-column:2; grid-row:3/6; align-self:stretch; border-left-width:1px; border-top-width:1px; border-bottom-width:1px; border-radius:12px 0 0 12px; margin:24px 0"></div>
  <div class="railcard" style="grid-column:1; grid-row:3/6; align-self:center"><b>Models fitted from the catalog</b>Every run&rsquo;s measurements join the catalog; the instruments are refit from it and score the next run.</div>
  <div class="rail" style="grid-column:4; grid-row:1/10; align-self:stretch; border-right-width:1px; border-top-width:1px; border-bottom-width:1px; border-radius:0 12px 12px 0; margin:24px 0"></div>
  <div class="railcard" style="grid-column:5; grid-row:1/10; align-self:center"><b>What to publish next (P)</b>The policy learns from every outcome and advises the next recording&rsquo;s topic, length and hour.</div>
 </div>
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
