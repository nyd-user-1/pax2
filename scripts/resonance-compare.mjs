// The comparison sheet behind docs/RESONANCE-COMPARE.html: the top 10 scored paid takes and the
// top 10 catalog videos by views, each scored under the five proposed Resonance definitions
// (docs/PROPOSALS.html). Real inputs where they exist (views, Outlier Score, engagement, Hit
// probability, existing Resonance); approximations marked approx:true per cell, rendered grey.
// Writes data/generated/resonance-compare.json.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const Phi = (z) => 0.5 * (1 + Math.erf ? erf(z / Math.SQRT2) : 0)
function erf(x) {
  const s = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return s * y
}
const P = (z) => Math.round(100 * 0.5 * (1 + erf(z / Math.SQRT2)))
const logit = (p) => Math.log(Math.max(1e-6, Math.min(1 - 1e-6, p)) / (1 - Math.max(1e-6, Math.min(1 - 1e-6, p))))
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null }
const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)) || 1 }

// ---------- catalog side ----------
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

const byChan = new Map()
for (const v of settled) {
  const c = byChan.get(v.channelId) ?? []
  c.push(v)
  byChan.set(v.channelId, c)
}
const er = (v) => ((v.likes ?? 0) + (v.comments ?? 0)) / Math.max(1, v.views)
const age = (v) => Math.max(1, (Date.now() - Date.parse(v.published)) / 86400000)
const vpd = (v) => v.views / age(v)
const chanStats = new Map()
for (const [cid, list] of byChan) {
  chanStats.set(cid, {
    sdLnRatio: sd(list.map((v) => Math.log(Math.max(0.01, v.ratio)))),
    medEr: median(list.map(er)) || 0.001,
    medVpd: median(list.map(vpd)) || 1,
    medViews: median(list.map((v) => v.views)) || 1,
    medDur: median(list.map((v) => v.durationSec)) || 30,
  })
}
const pct = (xs, x) => xs.filter((y) => y <= x).length / Math.max(1, xs.length)

function axes(v) {
  const list = byChan.get(v.channelId) ?? settled
  return [
    pct(list.map((x) => x.ratio), v.ratio), // outlier standing
    pct(list.map(er), er(v)), // engagement standing
    pct(list.map(vpd), vpd(v)), // pace standing
    pct(list.map((x) => x.likes ?? 0), v.likes ?? 0),
    pct(list.map((x) => x.comments ?? 0), v.comments ?? 0),
    1 - Math.min(1, Math.abs(v.durationSec - chanStats.get(v.channelId).medDur) / 60), // length fit
    preds[v.id] != null ? Math.min(1, preds[v.id] / (2 * BASE)) : 0.5, // forecast standing
    Math.min(1, (v.title ?? "").split(/\s+/).length <= 12 ? 1 : 12 / (v.title ?? "x").split(/\s+/).length), // hook fitness
  ]
}
const AXIS_NAMES = ["outlier", "engagement", "pace", "likes", "comments", "lengthFit", "forecast", "hookFit"]

// modes: k-means (k=4) over templates of settled >=3x videos
const winners = settled.filter((v) => v.ratio >= 3).map((v) => ({ v, t: axes(v) }))
function kmeans(points, k, iters = 50) {
  let cents = points.slice(0, k).map((p) => [...p])
  for (let it = 0; it < iters; it++) {
    const groups = Array.from({ length: k }, () => [])
    for (const p of points) {
      let bi = 0, bd = Infinity
      cents.forEach((c, i) => { const d = c.reduce((s, ci, j) => s + (ci - p[j]) ** 2, 0); if (d < bd) { bd = d; bi = i } })
      groups[bi].push(p)
    }
    cents = groups.map((g, i) => g.length ? g[0].map((_, j) => g.reduce((s, p) => s + p[j], 0) / g.length) : cents[i])
  }
  return cents
}
const modes = kmeans(winners.map((w) => w.t), 4)
// each mode's lift: share over 3x among settled videos nearest to it
const nearest = (t) => { let bi = 0, bd = Infinity; modes.forEach((c, i) => { const d = c.reduce((s, ci, j) => s + (ci - t[j]) ** 2, 0); if (d < bd) { bd = d; bi = i } }); return bi }
const modeLift = modes.map((_, i) => {
  const mine = settled.filter((v) => nearest(axes(v)) === i)
  return mine.length ? mine.filter((v) => v.ratio >= 3).length / mine.length : 0
})
const maxLift = Math.max(...modeLift, 0.01)
const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1)

function scoreCatalog(v) {
  const st = chanStats.get(v.channelId)
  const zOut = Math.log(Math.max(0.01, v.ratio)) / st.sdLnRatio
  const zEr = Math.log(Math.max(1e-5, er(v)) / st.medEr) / 1.2
  const zVpd = Math.log(Math.max(0.01, vpd(v)) / st.medVpd) / 1.5
  const zHp = preds[v.id] != null ? (logit(preds[v.id]) - logit(BASE)) / 1.5 : 0
  const t = axes(v)
  const mScores = modes.map((m, i) => cos(t, m) * (modeLift[i] / maxLift))
  return {
    pR: { v: P(0.5 * zOut + 0.3 * zEr + 0.2 * zVpd), approx: true }, // durability proxied by pace
    hR: { v: P(0.7 * (0.5 * zOut + 0.3 * zEr + 0.2 * zVpd) + 0.3 * (0.6 * 0 + 0.4 * zHp)), approx: true }, // earlyShare, nLift proxied
    xR: { v: P(0.45 * zOut + 0.2 * zVpd + 0.2 * zEr + 0.15 * zHp), approx: true }, // curve fit proxied
    fR: { v: P(Math.log((v.views * (1 + 10 * er(v))) / (st.medViews * (1 + 10 * st.medEr))) / 1.5), approx: true },
    mR: { v: Math.round(100 * Math.max(...mScores)), approx: preds[v.id] == null },
    axes: t.map((x) => Math.round(100 * x)),
  }
}

const topCat = [...settled].sort((a, b) => b.views - a.views).slice(0, 10).map((v) => ({
  kind: "catalog",
  id: v.id,
  title: v.title,
  channel: v.channel,
  poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  outlier: { v: v.ratio != null ? (v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)) + "x" : "--", approx: false },
  views: { v: v.views, approx: false },
  eR: null,
  ...scoreCatalog(v),
}))

// ---------- paid uploads (the real partner videos: VF uploads matched to paid creatives) ----------
const paid = read("data/generated/voter-freedom-paid.json")
const paidIds = [...new Set(paid.creatives.map((c) => c.videoId))]
const byId = new Map(vids.map((v) => [v.id, v]))
const spendOf = (id) => paid.creatives.filter((c) => c.videoId === id).reduce((s, c) => s + (c.totals?.spend_usd ?? 0), 0)
const topPaid = paidIds.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => b.views - a.views).slice(0, 10).map((v) => ({
  kind: "paid",
  id: v.id,
  title: v.title,
  channel: `Voter Freedom · $${Math.round(spendOf(v.id)).toLocaleString("en-US")} paid flight`,
  poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  outlier: { v: v.ratio != null ? (v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)) + "x" : "--", approx: false },
  views: { v: v.views, approx: false },
  eR: null,
  ...scoreCatalog(v),
}))

const modeCounts = modes.map((_, i) => settled.filter((v) => nearest(axes(v)) === i).length)
const out = { at: new Date().toISOString(), axisNames: AXIS_NAMES, base: BASE, modes: modes.map((m) => m.map((x) => Math.round(100 * x))), modeLift, modeCounts, rows: [...topPaid, ...topCat] }
fs.writeFileSync(path.join(root, "data/generated/resonance-compare.json"), JSON.stringify(out, null, 1))
console.log("paid uploads:", topPaid.length, "catalog:", topCat.length, "modes lift:", modeLift.map((x) => x.toFixed(2)).join(" "))
