// The full-corpus database page (docs/CORPUS.html), in the manner of the models session's
// ACCOUNTING.html: every catalog video as one compact row, searchable and sortable in the browser.
// Joins the poller history (velocity bucket, synced to /tmp/polls) and computes the five proposed
// Resonance definitions per settled video with the same arithmetic as scripts/resonance-compare.mjs.
// pR/hR/xR/fR carry proxied time components corpus-wide (the poller watches publishes since Oct 6);
// mR is real where a Classifier prediction exists.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

function erf(x) {
  const s = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x))
}
const P = (z) => Math.round(100 * 0.5 * (1 + erf(z / Math.SQRT2)))
const logit = (p) => Math.log(Math.max(1e-6, Math.min(1 - 1e-6, p)) / (1 - Math.max(1e-6, Math.min(1 - 1e-6, p))))
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null }
const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)) || 1 }

const cat = read("data/velocity/catalog.json")
const vids = (Array.isArray(cat) ? cat : cat.videos ?? Object.values(cat)).filter((v) => v.views != null)
const settled = vids.filter((v) => v.tier !== "unsettled" && v.ratio != null && v.ratio > 0)

const preds = {}
for (const line of fs.readFileSync(path.join(root, "data/generated/model/predictions-v3.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue
  const j = JSON.parse(line)
  preds[j.id] = j.full ?? j.embed ?? j.transcript ?? j.metadata
}
const BASE = 0.172

// poll coverage per video
const polls = {}
const dir = "/tmp/polls"
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
  if (!line.trim()) continue
  try { const r = JSON.parse(line); polls[r.id] = (polls[r.id] ?? 0) + 1 } catch {}
}

const er = (v) => ((v.likes ?? 0) + (v.comments ?? 0)) / Math.max(1, v.views)
const age = (v) => Math.max(1, (Date.now() - Date.parse(v.published)) / 86400000)
const vpd = (v) => v.views / age(v)

const byChan = new Map()
for (const v of settled) { const c = byChan.get(v.channelId) ?? []; c.push(v); byChan.set(v.channelId, c) }
// sorted arrays per channel for fast percentiles
const chan = new Map()
for (const [cid, list] of byChan) {
  const S = (f) => list.map(f).sort((a, b) => a - b)
  chan.set(cid, {
    ratio: S((v) => v.ratio), er: S(er), vpd: S(vpd), likes: S((v) => v.likes ?? 0), comments: S((v) => v.comments ?? 0),
    sdLnRatio: sd(list.map((v) => Math.log(Math.max(0.01, v.ratio)))),
    medEr: median(list.map(er)) || 0.001, medVpd: median(list.map(vpd)) || 1,
    medViews: median(list.map((v) => v.views)) || 1, medDur: median(list.map((v) => v.durationSec)) || 30,
  })
}
const pctOf = (sorted, x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m } return lo / Math.max(1, sorted.length) }

function axes(v, c) {
  return [
    pctOf(c.ratio, v.ratio), pctOf(c.er, er(v)), pctOf(c.vpd, vpd(v)),
    pctOf(c.likes, v.likes ?? 0), pctOf(c.comments, v.comments ?? 0),
    1 - Math.min(1, Math.abs(v.durationSec - c.medDur) / 60),
    preds[v.id] != null ? Math.min(1, preds[v.id] / (2 * BASE)) : 0.5,
    Math.min(1, (v.title ?? "").split(/\s+/).length <= 12 ? 1 : 12 / (v.title ?? "x").split(/\s+/).length),
  ]
}
// modes from the winners, as in resonance-compare
const winners = settled.map((v) => ({ v, t: axes(v, chan.get(v.channelId)) })).filter((w) => w.v.ratio >= 3)
function kmeans(points, k, iters = 40) {
  let cents = points.slice(0, k).map((p) => [...p])
  for (let it = 0; it < iters; it++) {
    const groups = Array.from({ length: k }, () => [])
    for (const p of points) { let bi = 0, bd = Infinity; cents.forEach((cn, i) => { const d = cn.reduce((s, ci, j) => s + (ci - p[j]) ** 2, 0); if (d < bd) { bd = d; bi = i } }); groups[bi].push(p) }
    cents = groups.map((g, i) => (g.length ? g[0].map((_, j) => g.reduce((s, p) => s + p[j], 0) / g.length) : cents[i]))
  }
  return cents
}
const modes = kmeans(winners.map((w) => w.t), 4)
const nearest = (t) => { let bi = 0, bd = Infinity; modes.forEach((c, i) => { const d = c.reduce((s, ci, j) => s + (ci - t[j]) ** 2, 0); if (d < bd) { bd = d; bi = i } }); return bi }
const near = settled.map((v) => nearest(axes(v, chan.get(v.channelId))))
const modeLift = modes.map((_, i) => { const mine = settled.filter((_, j) => near[j] === i); return mine.length ? mine.filter((v) => v.ratio >= 3).length / mine.length : 0 })
const maxLift = Math.max(...modeLift, 0.01)
const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1)

const rows = []
for (const v of vids) {
  const c = chan.get(v.channelId)
  let scores = [null, null, null, null, null]
  if (c && v.tier !== "unsettled" && v.ratio != null && v.ratio > 0) {
    const zOut = Math.log(Math.max(0.01, v.ratio)) / c.sdLnRatio
    const zEr = Math.log(Math.max(1e-5, er(v)) / c.medEr) / 1.2
    const zVpd = Math.log(Math.max(0.01, vpd(v)) / c.medVpd) / 1.5
    const zHp = preds[v.id] != null ? (logit(preds[v.id]) - logit(BASE)) / 1.5 : 0
    const t = axes(v, c)
    const m = Math.max(...modes.map((mo, i) => cos(t, mo) * (modeLift[i] / maxLift)))
    scores = [
      P(0.5 * zOut + 0.3 * zEr + 0.2 * zVpd),
      P(0.7 * (0.5 * zOut + 0.3 * zEr + 0.2 * zVpd) + 0.3 * 0.4 * zHp),
      P(0.45 * zOut + 0.2 * zVpd + 0.2 * zEr + 0.15 * zHp),
      P(Math.log((v.views * (1 + 10 * er(v))) / (c.medViews * (1 + 10 * c.medEr))) / 1.5),
      Math.round(100 * m),
    ]
  }
  rows.push([v.id, v.title ?? "", v.channel ?? "", v.views, v.ratio != null ? Math.round(v.ratio * 100) / 100 : null, polls[v.id] ?? 0, preds[v.id] != null ? Math.round(preds[v.id] * 100) : null, ...scores])
}

const stats = {
  total: vids.length,
  settled: settled.length,
  over3: settled.filter((v) => v.ratio >= 3).length,
  polled: rows.filter((r) => r[5] > 0).length,
  pollRows: Object.values(polls).reduce((a, b) => a + b, 0),
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Corpus</title>
<style>
 :root { --blue:#1e3a8a; --ink:#0f172a; --muted:#64748b; --border:#e2e8f0; --mist:#f1f5f9; }
 body { margin:0; padding:48px 24px; background:var(--mist); font:16px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); }
 .wrap { max-width:1380px; margin:0 auto; }
 .card { background:#fff; border-radius:20px; box-shadow:0 1px 3px rgb(2 6 23/.06); outline:1px solid rgb(15 23 42/.06); padding:36px 40px 28px; }
 h1 { margin:0 0 24px; font-size:26px; font-weight:650; color:var(--blue); }
 .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; margin-bottom:24px; }
 .tile { border:1px solid var(--border); border-radius:14px; padding:12px 14px; text-align:center; }
 .tile b { font-size:20px; } .tile p { margin:2px 0 0; font-size:12px; color:var(--muted); }
 #q { width:100%; box-sizing:border-box; margin-bottom:18px; padding:12px 16px; font:inherit; border:1px solid var(--border); border-radius:12px; outline:none; }
 #q:focus { border-color:var(--blue); }
 table { width:100%; border-collapse:collapse; }
 th { text-align:left; font-size:12px; letter-spacing:.06em; color:var(--muted); padding:10px 12px; border-bottom:1px solid var(--border); white-space:nowrap; cursor:pointer; user-select:none; }
 th.on { color:var(--blue); } th.ap { background:#f1f3f7; }
 td { padding:8px 12px; border-bottom:1px solid var(--border); white-space:nowrap; font-weight:600; font-size:14px; }
 td.t { white-space:normal; font-weight:400; max-width:460px; } td.t i { font-style:normal; color:var(--muted); font-size:12px; display:block; }
 td.no { color:var(--muted); font-weight:500; } td.dash { color:#94a3b8; }
 .foot { margin-top:14px; color:var(--muted); font-size:13px; }
 a { color:inherit; text-decoration:none; } td.t a:hover b { color:var(--blue); }
</style></head><body>
<div class="wrap"><div class="card">
<h1>Corpus</h1>
<div class="grid">
 <div class="tile"><b>${stats.total.toLocaleString()}</b><p>videos</p></div>
 <div class="tile"><b>${stats.settled.toLocaleString()}</b><p>settled</p></div>
 <div class="tile"><b>${stats.over3.toLocaleString()}</b><p>over 3x</p></div>
 <div class="tile"><b>${stats.polled.toLocaleString()}</b><p>polled videos</p></div>
 <div class="tile"><b>${stats.pollRows.toLocaleString()}</b><p>poll rows held</p></div>
 <div class="tile"><b>0</b><p>eR on file</p></div>
</div>
<input id="q" placeholder="Search title or channel… (${stats.total.toLocaleString()} videos; showing the first 500 of any filter)">
<table>
 <thead><tr>
  <th data-k="-1">No.</th><th data-k="1">video</th><th data-k="4">outlier</th><th data-k="3">views</th>
  <th data-k="5">polls</th><th data-k="6">hitProb</th>
  <th data-k="7" class="ap">pR</th><th data-k="8" class="ap">hR</th><th data-k="9" class="ap">xR</th><th data-k="10" class="ap">fR</th><th data-k="11">mR</th>
 </tr></thead>
 <tbody id="tb"></tbody>
</table>
<p class="foot">Grey-headed columns carry proxied time components corpus-wide: the poller watches publishes since Oct 6, so earlier rises were never observable. mR is computed from real counts; blank cells are unsettled videos. Rows cap at 500 — search to narrow.</p>
</div></div>
<script>
const DATA = ${JSON.stringify(rows)};
let sortK = 3, dir = -1;
const tb = document.getElementById("tb"), q = document.getElementById("q");
const fmt = (n) => n == null ? '<span class="dash">--</span>' : (typeof n === "number" && n > 999 ? n.toLocaleString() : n);
function render() {
  const needle = q.value.toLowerCase();
  let rows = needle ? DATA.filter((r) => (r[1] + " " + r[2]).toLowerCase().includes(needle)) : DATA.slice();
  const total = rows.length;
  if (sortK >= 0) rows.sort((a, b) => (dir) * (((a[sortK] ?? -1e18) < (b[sortK] ?? -1e18)) ? -1 : ((a[sortK] ?? -1e18) > (b[sortK] ?? -1e18)) ? 1 : 0));
  rows = rows.slice(0, 500);
  tb.innerHTML = rows.map((r, i) =>
    '<tr><td class="no">' + (i + 1) + '</td>' +
    '<td class="t"><a href="https://www.youtube.com/watch?v=' + r[0] + '" target="_blank"><b>' + r[1].replace(/</g, "&lt;") + '</b><i>' + r[2].replace(/</g, "&lt;") + '</i></a></td>' +
    '<td>' + (r[4] == null ? '<span class="dash">--</span>' : r[4] + 'x') + '</td>' +
    '<td>' + fmt(r[3]) + '</td><td>' + (r[5] || '<span class="dash">--</span>') + '</td>' +
    '<td>' + (r[6] == null ? '<span class="dash">--</span>' : r[6] + '%') + '</td>' +
    [7, 8, 9, 10, 11].map((k) => '<td>' + fmt(r[k]) + '</td>').join('') + '</tr>'
  ).join("");
  document.getElementById("q").placeholder = "Search title or channel… (" + total.toLocaleString() + " matching; showing first 500)";
}
document.querySelectorAll("th").forEach((th) => th.onclick = () => {
  const k = +th.dataset.k; if (k < 0) return;
  dir = (sortK === k) ? -dir : (k === 1 ? 1 : -1); sortK = k;
  document.querySelectorAll("th").forEach((x) => x.classList.toggle("on", x === th));
  render();
});
q.oninput = render;
render();
</script>
</body></html>`
fs.writeFileSync(path.join(root, "docs/CORPUS.html"), html)
console.log("rows:", rows.length, "settled:", stats.settled, "polled:", stats.polled, "bytes:", html.length)
