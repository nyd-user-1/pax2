/**
 * ma-q3.mjs — the two Massachusetts Question 3 message tests (Grow Progress, fielded for
 * Parallax, October 2026) as data: data/generated/trials.json.
 *
 *   node scripts/trials/ma-q3.mjs
 *
 * Source: the report PDF (data/raw/reports/ma-message-testing-2026-10.pdf; original in
 * s3://pax-2-638175140432/library/reports/). Test 2's subgroup grid is read from the PDF's
 * text layer, where a marked cell's value is set in the bold face and a small-sample cell in
 * the italic. Test 1's pages are images, so its grid is transcribed below and checked
 * against the Textract reading of the same pages in data/generated/reports/<slug>.json.
 * Both grids are checked against the counts the report prints. Any mismatch stops the build.
 */
import { readFileSync, writeFileSync } from "node:fs"

const SLUG = "ma-message-testing-2026-10"
const PDF = `data/raw/reports/${SLUG}.pdf`
const UNPDF = process.env.UNPDF ?? `${process.env.HOME}/Code/tariffs/node_modules/unpdf/dist/index.mjs`
const report = JSON.parse(readFileSync(`data/generated/reports/${SLUG}.json`, "utf8"))

const fail = (m) => { console.error("FAIL:", m); process.exit(1) }

// Names agreed across both tests (the report's own labels differ slightly between them).
const DIM = { Race: "Race/ethnicity", "Community type": "Urbanicity", "Media influence": "Media trust", "Parental status (children under 18)": "Parental status" }
const GROUP = {
  "Bachelor’s degree+": "Bachelor's degree+",
  "Non-Parent": "Non-parent",
  "A traditional TV or broadcast ad": "TV or broadcast ad",
  "A short social media video, person speaking to camera": "Person speaking to camera",
  "A short social media video with a person speaking directly to camera": "Person speaking to camera",
  "A clip of a podcast or interview": "Podcast or interview clip",
}
const dim = (d) => DIM[d] ?? d
const grp = (g) => GROUP[g] ?? g

// ---------- Test 1 (fielded Oct 2-7): transcribed from report pages 10-15 ----------
// Value tokens: 67 = level, * = marked vs placebo at the 90% threshold, ~ = small-sample flag.
const T1_ARMS = ["placebo", "danielle-allen", "littlewood", "donut", "official-ad", "dustin", "rodriguez"]
const T1 = `
10|Gender|Men|48 67* 65* 60* 59* 58* 48
10|Gender|Women|47 64* 61* 58* 59* 58* 50
10|Age|18–34|46 75* 59* 62* 66* 60* 53
10|Age|35–54|51 65* 69* 65* 65* 65* 56
10|Age|55+|46 60* 62* 52 47 51 41
11|Race/ethnicity|Black|45~ 61~ 53~ 64~ 45~ 61 55~
11|Race/ethnicity|Latino|54 68 66 72* 72* 59 53
11|Race/ethnicity|White|48 66* 63* 58* 58* 57* 48
11|Race/ethnicity|Other|38~ 67*~ 66*~ 52~ 60~ 60~ 51~
11|Education|High school or less|51 72* 56 59 60 46 44
11|Education|Some college|42 63* 68* 62* 61* 59* 46
11|Education|Bachelor's degree+|51 65* 64* 57 57 65* 55
12|Household income|$0–$49K|42 70* 60* 62* 59* 58* 38
12|Household income|$50K–$99K|50 69* 58 54 62* 55 52
12|Household income|$100K+|50 59 70* 62* 55 63* 62*
12|Parental status|Parent|50 67* 64* 65* 68* 72* 66*
12|Parental status|Non-parent|46 66* 63* 57* 55* 54 43
13|Political ideology|Liberal|36 68* 66* 57* 62* 62* 50*
13|Political ideology|Moderate|53 68* 68* 68* 63* 63* 53
13|Political ideology|Conservative|50 61 48 54 51 58 50
13|Party ID|Democrat|48 69* 62* 62* 62* 58 60*
13|Party ID|Independent/Other|45 65* 67* 58* 58* 57* 40
13|Party ID|Republican|51 60 50 53 53 63 48
14|Urbanicity|Urban|44 67* 65* 63* 53 56* 48
14|Urbanicity|Suburban|51 64* 62* 57 62* 60* 51
14|Urbanicity|Rural|36~ 88*~ 58~ 50~ 64~ 50~ 41~
14|2024 presidential vote choice|Voted Dem|50 65* 66* 60 58 61* 55
14|2024 presidential vote choice|Voted Rep|53 67* 64 60 57 69* 55
14|2024 presidential vote choice|Voted Other|42~ 65~ 67~ 64~ 64~ 67~ 32~
14|2024 presidential vote choice|Did not vote|41 67* 57* 56* 60* 43 42
15|2022 midterm turnout|Yes|54 63* 66* 60 57 65* 53
15|2022 midterm turnout|No|41 73* 62* 57* 63* 54* 51
15|2022 midterm turnout|Unsure|41~ 53~ 46~ 62~ 50~ 31~ 24~
15|Media trust|TV or broadcast ad|45 67* 67* 58* 59* 57* 49
15|Media trust|Person speaking to camera|52 65* 60 63* 64* 63 52
15|Media trust|Podcast or interview clip|47 64* 56 56 52 57 47
`

function parseT1() {
  const dims = new Map()
  for (const line of T1.trim().split("\n")) {
    const [page, d, g, vals] = line.split("|")
    const toks = vals.trim().split(/\s+/)
    if (toks.length !== T1_ARMS.length) fail(`test 1 ${d}/${g}: ${toks.length} values`)
    const cells = Object.fromEntries(toks.map((t, i) => [T1_ARMS[i], { v: +t.replace(/[*~]/g, ""), sig: t.includes("*"), small: t.includes("~") }]))
    if (cells.placebo.sig) fail(`test 1 ${d}/${g}: placebo marked`)
    const key = `${page}|${d}`
    if (!dims.has(key)) dims.set(key, { page: +page, dimension: d, groups: [] })
    dims.get(key).groups.push({ group: g, small: Object.values(cells).every((c) => c.small), cells })
  }
  // Every transcribed value must appear on its page in the Textract reading (as a multiset).
  for (const pg of [10, 11, 12, 13, 14, 15]) {
    const ocr = (report.pages[pg - 1].text.match(/\b\d{1,3}%/g) ?? []).map((s) => +s.replace("%", ""))
    const pool = new Map()
    for (const v of ocr) pool.set(v, (pool.get(v) ?? 0) + 1)
    for (const s of [...dims.values()].filter((s) => s.page === pg)) for (const g of s.groups) for (const c of Object.values(g.cells)) {
      const n = pool.get(c.v) ?? 0
      if (!n) fail(`test 1 page ${pg} ${s.dimension}/${g.group}: ${c.v}% not in the OCR text`)
      pool.set(c.v, n - 1)
    }
  }
  return [...dims.values()]
}

// ---------- Test 2 (fielded Oct 12-15): read from the text layer, pages 22, 24-26 ----------
const T2_ARMS = ["placebo", "pahlow", "dizoglio", "matt-wilson", "green"]
async function parseT2() {
  const { getDocumentProxy } = await import(UNPDF)
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(PDF)))
  const out = []
  for (const p of [24, 25, 26, 22]) {
    const page = await pdf.getPage(p)
    const H = page.getViewport({ scale: 1 }).height
    const items = (await page.getTextContent()).items.filter((i) => i.str.trim()).map((i) => ({ s: i.str.trim(), x: i.transform[4], y: H - i.transform[5], f: i.fontName.replace(/^g_d\d+_/, "") }))
    // The page's faces: section titles f5, panel headers and marked values bold f7, plain f9, small f10, small+marked f11.
    const sections = items.filter((i) => i.f === "f5" && i.x < 50 && i.y > 150 && i.y < 700 && !/^Rebuilt|^\(/.test(i.s)).sort((a, b) => a.y - b.y)
    const captions = items.filter((i) => /^Marked vs placebo/.test(i.s))
    for (const [k, sec] of sections.entries()) {
      const yEnd = sections[k + 1]?.y ?? 700
      const hx = new Map()
      for (const h of items.filter((i) => i.f === "f7" && !/%$/.test(i.s) && i.x > 100 && i.y > sec.y && i.y < sec.y + 50).sort((a, b) => a.y - b.y)) {
        const x = Math.round(h.x)
        hx.set(x, hx.has(x) ? `${hx.get(x)} ${h.s}` : h.s)
      }
      const panels = [...hx.entries()].sort((a, b) => a[0] - b[0]).map(([x, name]) => ({ x, name }))
      const smallAll = items.filter((i) => i.f === "f8" && i.y > sec.y && i.y < sec.y + 50).map((i) => Math.round(i.x))
      const vals = items.filter((i) => /^\d+%$/.test(i.s) && i.y > sec.y && i.y < yEnd && i.x > 150 && ["f7", "f9", "f10", "f11"].includes(i.f))
      let marked = 0
      const groups = panels.map((pn, j) => {
        const v = vals.filter((i) => i.x >= pn.x && i.x < (panels[j + 1]?.x ?? 9999)).sort((a, b) => a.y - b.y)
        if (v.length !== T2_ARMS.length) fail(`test 2 page ${p} ${sec.s}/${pn.name}: ${v.length} values`)
        const cells = Object.fromEntries(v.map((i, r) => [T2_ARMS[r], { v: +i.s.replace("%", ""), sig: i.f === "f7" || i.f === "f11", small: i.f === "f10" || i.f === "f11" }]))
        if (cells.placebo.sig) fail(`test 2 ${sec.s}/${pn.name}: placebo marked`)
        marked += T2_ARMS.slice(1).filter((a) => cells[a].sig).length
        return { group: grp(pn.name), small: smallAll.includes(pn.x), cells }
      })
      const cap = captions.find((c) => c.y > sec.y - 5 && c.y < sec.y + 30)?.s.match(/(\d+) of (\d+)/)
      if (!cap || +cap[1] !== marked || +cap[2] !== groups.length * 4) fail(`test 2 ${sec.s}: ${marked} marked against the caption ${cap?.[0]}`)
      out.push({ page: p, dimension: dim(sec.s.replace(/ \(source label: Media Influence\)$/, "")), groups })
    }
  }
  return out
}

const t1 = parseT1()
const t2 = await parseT2()

// The report's own counts (pages 9 and 23): Danielle Allen marked in 29 of 36 groups, Green in 24 of 38.
const count = (dims, arm) => dims.flatMap((d) => d.groups).filter((g) => g.cells[arm].sig).length
const groups = (dims) => dims.flatMap((d) => d.groups).length
if (groups(t1) !== 36 || count(t1, "danielle-allen") !== 29) fail(`test 1: ${groups(t1)} groups, Danielle Allen marked in ${count(t1, "danielle-allen")}`)
if (groups(t2) !== 38 || count(t2, "green") !== 24) fail(`test 2: ${groups(t2)} groups, Green marked in ${count(t2, "green")}`)

const FRAME1 = "https://next.frame.io/share/ed42d6ec-f4eb-4e9d-b4af-83173df40de8/view/"
const FRAME2 = "https://next.frame.io/share/80e0f5ad-075b-44f7-8622-ca68ce99085b/view/"
const GP = "https://s3.amazonaws.com/condoropenskies.net/videos/"

const QUESTION_YES = "If the election were held today, how would you vote on Ballot Question 3? (Yes · No · Would not vote)"
const QUESTION_COMP = "Which of the following best describes the main change Question 3 would make to Massachusetts state primary elections?"
const COMP_ANSWER = "Create one primary with all candidates on the same ballot, with the top two vote-getters overall advancing to the general election"

const out = {
  report: SLUG,
  title: "Massachusetts Question 3 message tests",
  measure: "Massachusetts Ballot Question 3 (all-party primary, top two advance)",
  fieldedBy: "Grow Progress",
  preparedBy: "Parallax",
  population: "Massachusetts general adults, not a verified likely-voter sample",
  threshold: "90% (the source's criterion for a marked difference against placebo)",
  outcomes: {
    yes: { label: "Ballot support", question: QUESTION_YES, definition: "Share choosing Yes after the video, against the share after the placebo video" },
    comprehension: { label: "Comprehension", question: QUESTION_COMP, answer: COMP_ANSWER, definition: "Share choosing the correct description, asked after every arm read the same written explanation of Question 3" },
  },
  tests: [
    {
      id: "ma-q3-1",
      label: "Test 1",
      fielded: { from: "2026-10-02", to: "2026-10-07" },
      respondents: 3600,
      weighted: 3564,
      cards: false,
      pages: { summary: 7, videos: 8, pairings: 9, subgroups: [10, 15], limits: 16 },
      liftsNote: "Lifts as published, computed before rounding.",
      mediaTrust: { tv: 54, camera: 24, podcast: 22, counts: { tv: 1919, camera: 855, podcast: 790 }, page: 4 },
      arms: [
        { id: "placebo", name: "Placebo", role: "placebo", n: 494 },
        { id: "danielle-allen", name: "Danielle Allen", producer: "Parallax", n: 512, seconds: 35, format: "Street interview", yes: { lift: 18, sig: true }, comprehension: { lift: 3, sig: false }, review: `${FRAME1}a00551fa-04cd-4718-b210-f6b16f8bca78` },
        { id: "littlewood", name: "Littlewood", producer: "Parallax", n: 484, yes: { lift: 15, sig: true }, comprehension: { lift: -3, sig: false }, review: `${FRAME1}fd9f7400-be31-4ab8-ac90-05186b576a90` },
        { id: "donut", name: "Donut", producer: "Parallax", n: 518, yes: { lift: 12, sig: true }, comprehension: { lift: 0, sig: false }, review: `${FRAME1}5a5daad0-422f-4a67-8897-686dc781f85e`, youtube: "pn1g00H9YKA" },
        { id: "official-ad", name: "Official campaign ad", producer: "Campaign", n: 491, seconds: 30, yes: { lift: 11, sig: true }, comprehension: { lift: 3, sig: false }, review: "https://www.dropbox.com/scl/fi/jateupa882uhqcqlhro6u/CFHD_HTA30_1026.mp4?rlkey=v58jz7ynw5derpf80b89803su&st=lm527e95&e=1&dl=0" },
        { id: "dustin", name: "Dustin", producer: "Parallax", n: 520, yes: { lift: 11, sig: true }, comprehension: { lift: 0, sig: false }, review: `${FRAME1}cee18145-b226-43e2-bc9d-ea869c6c702c`, youtube: "bLQQHGa-Css" },
        { id: "rodriguez", name: "Rodriguez", producer: "Parallax", n: 546, yes: { lift: 2, sig: false }, comprehension: { lift: 0, sig: false }, review: `${FRAME1}21e136f4-f9ed-4fe1-af41-18677b03b988` },
      ],
      subgroups: t1,
    },
    {
      id: "ma-q3-2",
      label: "Test 2",
      fielded: { from: "2026-10-12", to: "2026-10-15" },
      respondents: 2400,
      weighted: 2371,
      cards: true,
      pages: { summary: 17, videos: 18, method: 19, yes: 20, comprehension: 21, mediaTrust: 22, pairings: 23, subgroups: [24, 26] },
      liftsNote: "Lifts are differences between rounded displayed percentages.",
      placebo: { yes: 47, comprehension: 45 },
      mediaTrust: { tv: 54.4, camera: 24.5, podcast: 21.1, counts: { tv: 1290, camera: 581, podcast: 501 }, page: 22 },
      arms: [
        { id: "placebo", name: "Placebo", role: "placebo", n: 443, yes: { level: 47 }, comprehension: { level: 45 } },
        { id: "pahlow", name: "Pahlow", n: 482, seconds: 32.6, yes: { level: 57, lift: 10, sig: true }, comprehension: { level: 56, lift: 11, sig: true }, tested: `${GP}435f181a420581798fd5d3f0fb00fc15.mp4`, review: `${FRAME2}3571fae1-0ae1-425b-8c1d-8916032e199a`, youtube: "oTytFVuVQzE" },
        { id: "dizoglio", name: "DiZoglio", n: 484, seconds: 30, yes: { level: 58, lift: 11, sig: true }, comprehension: { level: 54, lift: 9, sig: true }, tested: `${GP}526c5d31f5ba126c1776c3cd098c5e9c.mp4`, review: `${FRAME2}2aad8b8f-2577-4d80-b519-923aee0c5b90` },
        { id: "matt-wilson", name: "Matt Wilson", n: 506, seconds: 36.4, yes: { level: 58, lift: 11, sig: true }, comprehension: { level: 51, lift: 6, sig: true }, tested: `${GP}6417d791d9411c2c168787b7e8d2008e.mp4`, review: `${FRAME2}a25c42dd-5b13-40bc-b7dd-e6423ff7530a` },
        { id: "green", name: "Green", n: 457, seconds: 34.6, yes: { level: 61, lift: 14, sig: true }, comprehension: { level: 50, lift: 5, sig: false }, tested: `${GP}6ca5b15be2ca5c2ce9ea963e6b66fd35.mp4`, review: `${FRAME2}3cdb9f3d-9eff-48a5-b965-e589e18e17d8`, youtube: "7ux0S0cNvd8" },
      ],
      subgroups: t2,
    },
  ],
  // YouTube matches: Dustin by name in the transcript and face; Pahlow ("This Harvard Democrat") and
  // Green (David Green, same set and captions) by frames of the tested MP4; Donut by the bakery
  // script. The YouTube upload may be a different cut from the tested one.
}

writeFileSync("data/generated/trials.json", JSON.stringify(out, null, 1))
console.log(`wrote data/generated/trials.json: test 1 ${groups(t1)} groups, test 2 ${groups(t2)} groups; checks passed`)
