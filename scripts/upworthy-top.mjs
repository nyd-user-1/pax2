// Top Upworthy headlines from the confirmatory packages file.
// Usage: node scripts/upworthy-top.mjs <path-to-confirmatory-csv>
// Writes data/generated/upworthy-top.json: the 500 best headlines by click rate
// (same headline's impressions pooled within a test, 1,000+ impressions, exact
// duplicates across tests kept once at their best), plus pattern rates measured
// on the top 500 against the whole archive.

import { readFileSync, writeFileSync } from "node:fs"

const src = process.argv[2]
if (!src) {
  console.error("usage: node scripts/upworthy-top.mjs <confirmatory csv>")
  process.exit(1)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ",") row.push(cell), (cell = "")
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      if (row.some((x) => x !== "")) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows
}

const rows = parseCsv(readFileSync(src, "utf8"))
const head = rows[0]
const col = (name) => head.indexOf(name)
const TEST = col("clickability_test_id")
const HEADLINE = col("headline")
const IMPRESSIONS = col("impressions")
const CLICKS = col("clicks")
const FIRST = col("first_place")

// Pool identical headline text within a test: variants of the same headline
// differ only by image, and pooling isolates the words.
const byTest = new Map()
for (const r of rows.slice(1)) {
  const headline = (r[HEADLINE] ?? "").trim()
  if (!headline) continue
  const key = `${r[TEST]}\u0000${headline.toLowerCase()}`
  const e = byTest.get(key) ?? { headline, impressions: 0, clicks: 0, won: false }
  e.impressions += Number(r[IMPRESSIONS]) || 0
  e.clicks += Number(r[CLICKS]) || 0
  if (r[FIRST] === "True") e.won = true
  byTest.set(key, e)
}

const MIN = 1000
const all = [...byTest.values()].filter((e) => e.impressions >= MIN)
for (const e of all) e.ctr = e.clicks / e.impressions

// The same text tested more than once counts once, at its best showing.
const best = new Map()
for (const e of all) {
  const k = e.headline.toLowerCase()
  if (!best.has(k) || best.get(k).ctr < e.ctr) best.set(k, e)
}
const unique = [...best.values()].sort((a, b) => b.ctr - a.ctr)
const top = unique.slice(0, 500)

const PATTERNS = [
  { key: "digit", label: "Carries a number", test: (h) => /\d/.test(h) },
  { key: "this", label: "Starts with “This” or “These”", test: (h) => /^(this|these)\b/i.test(h) },
  { key: "question", label: "Asks a question", test: (h) => h.includes("?") },
  { key: "you", label: "Says “you” or “your”", test: (h) => /\byou(r|['’]re)?\b/i.test(h) },
  { key: "quote", label: "Quotes someone", test: (h) => /[“”"]/.test(h) },
  { key: "caps", label: "Shouts a word in capitals", test: (h) => /\b[A-Z]{3,}\b/.test(h) },
  { key: "whatwhyhow", label: "Starts with “What”, “Why” or “How”", test: (h) => /^(what|why|how)\b/i.test(h) },
  { key: "watch", label: "Says “watch”, “see” or “listen”", test: (h) => /\b(watch|see|listen)\b/i.test(h) },
  { key: "ellipsis", label: "Trails off or breaks midline", test: (h) => /(\.\.\.|…|—| - )/.test(h) },
  { key: "firstperson", label: "First person: “I” or “my”", test: (h) => /\b(i|i['’]m|my|me)\b/i.test(h) },
]

const pct = (xs, f) => (100 * xs.filter((e) => f(e.headline)).length) / xs.length
const words = (xs) => {
  const ns = xs.map((e) => e.headline.split(/\s+/).length).sort((a, b) => a - b)
  return ns[Math.floor(ns.length / 2)]
}
const meanCtr = (xs) => (100 * xs.reduce((s, e) => s + e.ctr, 0)) / xs.length

// The archive's real design is within a test: same story, same day, only the words
// differ. Winners vs. losers inside each test is the comparison that isolates wording.
const tests = new Map()
for (const [key, e] of byTest) {
  if (e.impressions < MIN) continue
  const id = key.split("\u0000")[0]
  ;(tests.get(id) ?? tests.set(id, []).get(id)).push(e)
}
const winners = []
const losers = []
const swings = []
for (const es of tests.values()) {
  if (es.length < 2) continue
  const win = es.filter((e) => e.won)
  if (!win.length) continue
  winners.push(...win)
  losers.push(...es.filter((e) => !e.won))
  const rs = es.map((e) => e.clicks / e.impressions).sort((a, b) => a - b)
  if (rs[0] > 0) swings.push(rs[rs.length - 1] / rs[0])
}
swings.sort((a, b) => a - b)
const medianSwing = swings[Math.floor(swings.length / 2)]

const out = {
  built: new Date().toISOString().slice(0, 10),
  source: "upworthy-archive-confirmatory-packages-03.12.2020.csv",
  method: `Headlines pooled across image variants within a test, ${MIN}+ impressions, ranked by clicks per impression; a text tested more than once appears once, at its best.`,
  counts: { packages: rows.length - 1, headlines: unique.length, top: top.length, tests: swings.length, winners: winners.length, losers: losers.length },
  ctr: { top: +meanCtr(top).toFixed(2), all: +meanCtr(unique).toFixed(2) },
  words: { top: words(top), all: words(unique) },
  swing: +medianSwing.toFixed(1),
  patterns: PATTERNS.map((p) => ({
    key: p.key,
    label: p.label,
    top: +pct(top, p.test).toFixed(1),
    all: +pct(unique, p.test).toFixed(1),
    won: +pct(winners, p.test).toFixed(1),
    lost: +pct(losers, p.test).toFixed(1),
  })),
  rows: top.map((e) => ({ h: e.headline, i: e.impressions, c: e.clicks, r: +(100 * e.ctr).toFixed(2), w: e.won })),
}

writeFileSync("data/generated/upworthy-top.json", JSON.stringify(out, null, 1))
console.log(`${out.counts.headlines} pooled headlines from ${out.counts.packages} packages; top ${top.length} written`)
console.log(`mean click rate: top ${out.ctr.top}% vs all ${out.ctr.all}% · median words: ${out.words.top} vs ${out.words.all}`)
console.log(`within-test: ${out.counts.tests} tests, median best/worst swing ${out.swing}x, ${out.counts.winners} winners vs ${out.counts.losers} losers`)
for (const p of out.patterns) console.log(`${p.label}: top ${p.top}% vs all ${p.all}% · won ${p.won}% vs lost ${p.lost}%`)
