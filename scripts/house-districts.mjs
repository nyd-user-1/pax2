// Builds data/generated/house-districts.json: who holds each Massachusetts and Colorado House seat
// and how its last two generals went, for /chat's address mode. Inputs (Athena extracts from
// GovBlock's lake, saved in data/raw):
//   medsl-house-2024-ma-co.csv    govblock_elections.medsl_precinct_returns, 2024 State House general,
//                                 summed over precincts (dataset DODOBJ; NYTPDU repeats the same rows)
//   klarner-house-2022-ma-co.csv  govblock_elections.klarner_state_legislative_returns, 2022 House general
//   house-members-ma-co.csv       govblock_legislative.people, current House members
// The people table keeps some members current at a seat they left (Colorado 7 lists James Coleman,
// now a senator, beside Jennifer Bacon); the seat keeps whoever won it in 2024. A seat the table
// leaves empty takes its 2024 winner.
import { readFileSync, writeFileSync } from "node:fs"

const rows = (f) => {
  const [head, ...rest] = readFileSync(new URL(`../data/raw/${f}`, import.meta.url), "utf8").trim().split("\n")
  const cols = head.split(",").map((c) => c.replace(/"/g, ""))
  return rest.map((l) => Object.fromEntries(l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((v, i) => [cols[i], v.replace(/^"|"$/g, "")])))
}

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`
const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/(\d)(St|Nd|Rd|Th)\b/g, (_, d, x) => d + x.toLowerCase())
const last = (n) => n.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => !["jr", "sr", "ii", "iii"].includes(w)).at(-1)
const PARTY = { democrat: "Democratic", republican: "Republican", unenrolled: "Unenrolled", libertarian: "Libertarian", greenrainbow: "Green-Rainbow", workers: "Working Families", uni: "Unity", other: "Other" }

const out = { MA: {}, CO: {} }
const seat = (st, district) => (out[st][district] ??= { members: [], race: null, previous: null })
const race = (election) => ({ election, candidates: [], contested: false })

// 2024: MEDSL district names are "10TH BRISTOL" and "001".
for (const r of rows("medsl-house-2024-ma-co.csv")) {
  if (!r.party_simplified) continue // ALL OTHERS, UNDERVOTE
  const district = r.state_po === "CO" ? String(+r.district) : title(r.district)
  const s = seat(r.state_po, district)
  ;(s.race ??= race("2024 general")).candidates.push({ name: title(r.candidate), party: PARTY[r.party_simplified.toLowerCase()] ?? title(r.party_simplified), votes: +r.votes, won: false })
}

// 2022: Klarner names Massachusetts seats by county and number.
const COUNTY = { barnstabledukesnantucket: "Barnstable, Dukes and Nantucket" }
for (const r of rows("klarner-house-2022-ma-co.csv")) {
  if (r.party === "writein") continue
  const district = r.sab === "CO" ? r.dno : COUNTY[r.dname] ?? `${ordinal(+r.dno)} ${title(r.dname)}`
  const s = seat(r.sab, district)
  ;(s.previous ??= race("2022 general")).candidates.push({ name: title(r.cando), party: PARTY[r.party] ?? title(r.party), votes: +r.vote, won: r.outcome === "w" })
}

for (const s of [...Object.values(out.MA), ...Object.values(out.CO)])
  for (const r of [s.race, s.previous].filter(Boolean)) {
    r.candidates.sort((a, b) => b.votes - a.votes)
    if (r.election.startsWith("2024") && r.candidates[0]) r.candidates[0].won = true
    r.contested = r.candidates.length > 1
  }

const listed = {}
for (const p of rows("house-members-ma-co.csv")) (listed[`${p.state}|${p.district}`] ??= []).push({ name: p.name, party: p.party })
for (const st of ["MA", "CO"])
  for (const [district, s] of Object.entries(out[st])) {
    const list = listed[`${st}|${district}`] ?? []
    const winner = s.race?.candidates.find((c) => c.won)
    const kept = winner ? list.filter((m) => last(m.name) === last(winner.name)) : []
    s.members = kept.length ? kept : list.length === 1 ? list : winner ? [{ name: winner.name, party: winner.party }] : list
  }

writeFileSync(
  new URL("../data/generated/house-districts.json", import.meta.url),
  JSON.stringify({ sources: { members: "govblock_legislative.people (Open States), checked against the 2024 winner", race: "MEDSL precinct returns via GovBlock, 2024 general", previous: "Klarner State Legislative Election Returns via GovBlock, 2022 general" }, ...out }, null, 1),
)
const all = [...Object.values(out.MA), ...Object.values(out.CO)]
console.log({ MA: Object.keys(out.MA).length, CO: Object.keys(out.CO).length, no2024: all.filter((s) => !s.race).length, twoMembers: all.filter((s) => s.members.length > 1).length, noMember: all.filter((s) => !s.members.length).length })
