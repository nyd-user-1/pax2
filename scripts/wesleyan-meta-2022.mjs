// What Democratic video ads on Meta were for in 2022, from the Wesleyan Media Project's core file.
// Usage: node scripts/wesleyan-meta-2022.mjs <fb_2022_adid_var.csv.gz>
//   (s3://hermes-638175140432/raw/wmp-open/fs-meta-2022-core/fb_2022_adid_var.csv.gz)
// Writes data/generated/wesleyan-meta-2022.json: Wesleyan's goal classifier splits each ad into
// persuade, raise money, both or neither; per goal, the count of ads, the spend (midpoint of
// Meta's spend range) and the median impressions bucket.

import { createReadStream, writeFileSync } from "node:fs"
import { createGunzip } from "node:zlib"

const src = process.argv[2]
if (!src) {
  console.error("usage: node scripts/wesleyan-meta-2022.mjs <fb_2022_adid_var.csv.gz>")
  process.exit(1)
}

// Streaming CSV: quoted cells hold commas and the JSON of Meta's ranges.
let head = null
let row = []
let cell = ""
let q = false
let pendingQuote = false
const goals = new Map()

const range = (s) => {
  try {
    const d = JSON.parse(s)
    return { lo: Number(d.lower_bound ?? 0), hi: d.upper_bound == null ? null : Number(d.upper_bound) }
  } catch {
    return null
  }
}

function onRow(r) {
  if (!head) {
    head = Object.fromEntries(r.map((h, i) => [h, i]))
    return
  }
  if (!r[head.wmp_media_type]?.includes("video") || r[head.party_all_clf_adid] !== "DEM") return
  const money = r[head.goal_DONATE_prediction] === "1"
  const persuade = r[head.goal_PRIMARY_PERSUADE_prediction] === "1"
  const goal = money && persuade ? "both" : money ? "money" : persuade ? "persuade" : "neither"
  const spend = range(r[head.spend])
  const imps = range(r[head.impressions])
  const g = goals.get(goal) ?? { ads: 0, spend: 0, imps: [] }
  g.ads++
  if (spend) g.spend += spend.hi == null ? spend.lo : (spend.lo + spend.hi) / 2
  if (imps) g.imps.push(imps)
  goals.set(goal, g)
}

function feed(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (pendingQuote) {
      pendingQuote = false
      if (c === '"') {
        cell += '"'
        continue
      }
      q = false
    }
    if (q) {
      if (c === '"') pendingQuote = true
      else cell += c
    } else if (c === '"') q = true
    else if (c === ",") row.push(cell), (cell = "")
    else if (c === "\n") {
      row.push(cell)
      onRow(row)
      row = []
      cell = ""
    } else if (c !== "\r") cell += c
  }
}

const stream = createReadStream(src).pipe(createGunzip())
stream.setEncoding("utf8")
for await (const chunk of stream) feed(chunk)
if (cell || row.length) row.push(cell), onRow(row)

const total = { ads: 0, spend: 0 }
for (const g of goals.values()) (total.ads += g.ads), (total.spend += g.spend)
const fmt = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(0)}K` : `${n}`)
const out = {
  built: new Date().toISOString().slice(0, 10),
  source: "Wesleyan Media Project, Meta 2022 election ads, core dataset (fb_2022_adid_var), CC BY-NC",
  scope: "Video ads Wesleyan's party classifier reads as pro-Democratic",
  ads: total.ads,
  spend: Math.round(total.spend),
  goals: ["persuade", "money", "both", "neither"].map((key) => {
    const g = goals.get(key) ?? { ads: 0, spend: 0, imps: [] }
    g.imps.sort((a, b) => a.lo - b.lo)
    const m = g.imps[Math.floor(g.imps.length / 2)]
    return {
      key,
      ads: g.ads,
      spend: Math.round(g.spend),
      adShare: +((g.ads / total.ads) * 100).toFixed(1),
      spendShare: +((g.spend / total.spend) * 100).toFixed(1),
      medianImpressions: m ? (m.hi == null ? `${fmt(m.lo)}+` : `${fmt(m.lo)}–${fmt(m.hi + 1)}`) : null,
    }
  }),
}
writeFileSync(new URL("../data/generated/wesleyan-meta-2022.json", import.meta.url), JSON.stringify(out, null, 1) + "\n")
console.log(JSON.stringify(out, null, 1))
