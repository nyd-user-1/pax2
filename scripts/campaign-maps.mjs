// Builds data/generated/campaign-maps.json: one state map per mode on /campaigns.
// Inputs (Athena extracts from GovBlock's lake, saved in data/raw):
//   google-reform-geo-spend.csv           govblock_ads.google_ads_advertiser_geo_spend, 17 reform advertisers
//   uncontested-legislative-2014-2022.csv govblock_elections.klarner_state_legislative_returns, single-seat general elections
import { readFileSync, writeFileSync } from "node:fs"

const rows = (f) => {
  const [head, ...rest] = readFileSync(new URL(`../data/raw/${f}`, import.meta.url), "utf8").trim().split("\n")
  const cols = head.split(",").map((c) => c.replace(/"/g, ""))
  return rest.map((l) => Object.fromEntries(l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((v, i) => [cols[i], v.replace(/^"|"$/g, "")])))
}

// Advertiser names as filed, made readable: no "C/O ..." or "SPONSORED BY ...", title case.
const SMALL = new Set(["for", "of", "and", "the", "on"])
const tidy = (a) =>
  a
    .replace(/ C\/O .*$/i, "")
    .replace(/, SPONSORED BY .*$/i, "")
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.toUpperCase() === "YES" ? "YES" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\bInc\b/g, "Inc.")

const geo = rows("google-reform-geo-spend.csv").map((r) => ({ name: tidy(r.advertiser_name), state: r.country_subdivision_primary, usd: Number(r.spend_usd) }))

function spend(filter) {
  const states = {}
  for (const r of geo.filter(filter)) {
    const s = (states[r.state] ??= { total: 0, by: {} })
    s.total += r.usd
    s.by[r.name] = (s.by[r.name] ?? 0) + r.usd
  }
  return Object.fromEntries(Object.entries(states).map(([st, s]) => [st, { total: s.total, top: Object.entries(s.by).sort((a, b) => b[1] - a[1]).slice(0, 5) }]))
}

const unc = Object.fromEntries(rows("uncontested-legislative-2014-2022.csv").map((r) => [r.sab, { races: +r.races, uncontested: +r.uncontested, pct: +r.pct }]))

const out = {
  spendAll: spend(() => true),
  spendUnite: spend((r) => /^unite america/i.test(r.name)),
  spendOpen: spend((r) => /^open primaries/i.test(r.name)),
  uncontested: unc,
}
writeFileSync(new URL("../data/generated/campaign-maps.json", import.meta.url), JSON.stringify(out, null, 1))
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length])))
