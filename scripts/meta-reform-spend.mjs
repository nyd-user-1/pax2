// Sweep Meta Ad Library Report extracts for the election-reform universe —
// anything Unite America touches, anything open-primaries/RCV-related, every state.
// Usage: node scripts/meta-reform-spend.mjs <lifelong-dir> <last90-dir>
// Each dir holds FacebookAdLibraryReport_*_advertisers.csv and regions/*.csv.
// Output: data/raw/meta-reform-spend.json

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const [lifelongDir, last90Dir] = process.argv.slice(2)
if (!lifelongDir || !last90Dir) {
  console.error("usage: node scripts/meta-reform-spend.mjs <lifelong-dir> <last90-dir>")
  process.exit(1)
}

const UNIVERSE =
  /unite america|voter freedom|open primar|fairvote|fair vote|ranked[ -]?choice|instant[ -]runoff|courageous|healthy democracy|voter choice|better elections|honest elections|final[ -]?(four|five)|all[ -]party|top[ -](two|four|five)|nonpartisan primar|ballots without barriers|political innovation|representus|voters first|make elections fair|make all votes count|defend alaska|alaskans for better|montanans for election reform|veterans for all voters|election reform|better ballot|rank (the|my) vote|independent voting|independentvoting|more choice|save democracy|primary problem/i

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

const strip = (s) => (s ?? "").replace(/^﻿/, "").trim()
const hit = (name, disclaimer) => UNIVERSE.test(name) || UNIVERSE.test(disclaimer)

/** amount cells are numbers or "≤100"; keep the raw string when not numeric */
const amount = (s) => (/^\d+$/.test(s) ? Number(s) : s)

const out = new Map()
const key = (id, name, disclaimer) => `${id}\u0000${name}\u0000${disclaimer}`
const entry = (id, name, disclaimer) => {
  const k = key(id, name, disclaimer)
  if (!out.has(k)) out.set(k, { pageId: id, pageName: name, disclaimer, lifelong: null, last90: null, states: {} })
  return out.get(k)
}

function national(dir, window) {
  const file = readdirSync(dir).find((f) => f.includes("advertisers.csv"))
  const rows = parseCsv(readFileSync(path.join(dir, file), "utf8"))
  for (const r of rows.slice(1)) {
    const [id, name, disclaimer, usd, ads] = r.map(strip)
    if (!hit(name, disclaimer)) continue
    entry(id, name, disclaimer)[window] = { usd: amount(usd), ads: Number(ads) || ads }
  }
}

function regions(dir, window) {
  const rdir = path.join(dir, "regions")
  for (const f of readdirSync(rdir)) {
    if (!f.endsWith(".csv")) continue
    const state = f.replace(/\.csv$/, "").split("_").pop()
    const rows = parseCsv(readFileSync(path.join(rdir, f), "utf8"))
    for (const r of rows.slice(1)) {
      const [id, name, disclaimer, usd] = r.map(strip)
      if (!hit(name, disclaimer)) continue
      const e = entry(id, name, disclaimer)
      ;(e.states[state] = e.states[state] ?? {})[window] = amount(usd)
    }
  }
}

national(lifelongDir, "lifelong")
regions(lifelongDir, "lifelong")
national(last90Dir, "last90")
regions(last90Dir, "last90")

const advertisers = [...out.values()].sort((a, b) => ((typeof b.lifelong?.usd === "number" ? b.lifelong.usd : 0) - (typeof a.lifelong?.usd === "number" ? a.lifelong.usd : 0)))
const result = {
  built: new Date().toISOString().slice(0, 10),
  source: "Meta Ad Library Report, United States, downloaded 2026-10-04 (report date 2026-10-01): lifelong (since Oct 2019) and last 90 days",
  note: "Page name or funding disclaimer matching the election-reform universe; spend cells are USD totals, '≤100' kept verbatim",
  advertisers,
}
writeFileSync("data/raw/meta-reform-spend.json", JSON.stringify(result, null, 1))
const lifeTotal = advertisers.reduce((s, a) => s + (typeof a.lifelong?.usd === "number" ? a.lifelong.usd : 0), 0)
const d90Total = advertisers.reduce((s, a) => s + (typeof a.last90?.usd === "number" ? a.last90.usd : 0), 0)
console.log(advertisers.length, "reform advertisers | lifetime total $" + lifeTotal.toLocaleString(), "| last-90 total $" + d90Total.toLocaleString())
for (const a of advertisers.filter((x) => typeof x.lifelong?.usd === "number" && x.lifelong.usd >= 5000)) {
  const states = Object.entries(a.states)
    .filter(([, v]) => typeof v.lifelong === "number")
    .sort((x, y) => y[1].lifelong - x[1].lifelong)
    .slice(0, 3)
    .map(([s, v]) => `${s} ${v.lifelong}`)
    .join(", ")
  console.log(`${a.pageName} | ${a.disclaimer} | life ${a.lifelong?.usd ?? "-"} (${a.lifelong?.ads ?? "-"} ads) | 90d ${a.last90?.usd ?? "-"} | ${states}`)
}
