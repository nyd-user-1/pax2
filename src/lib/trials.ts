// Randomized message tests: each arm saw one video (or the placebo video), then answered how they would
// vote and what the measure does. Built by scripts/trials/ma-q3.mjs from the report in the library.
import data from "../../data/generated/trials.json"

export type Cell = { v: number; sig: boolean; small: boolean }
export type Group = { group: string; small: boolean; cells: Record<string, Cell> }
export type Dimension = { page: number; dimension: string; groups: Group[] }
export type Outcome = { level?: number; lift?: number; sig?: boolean }
export type Arm = {
  id: string
  name: string
  role?: "placebo"
  producer?: string
  n: number
  seconds?: number
  format?: string
  yes?: Outcome
  comprehension?: Outcome
  review?: string
  tested?: string
  youtube?: string
}
export type Test = {
  id: string
  label: string
  fielded: { from: string; to: string }
  respondents: number
  weighted: number
  cards: boolean
  pages: Record<string, number | number[]>
  liftsNote: string
  placebo?: { yes: number; comprehension: number }
  mediaTrust: { tv: number; camera: number; podcast: number; counts: { tv: number; camera: number; podcast: number }; page: number }
  arms: Arm[]
  subgroups: Dimension[]
}
export type Trials = {
  report: string
  title: string
  measure: string
  fieldedBy: string
  preparedBy: string
  population: string
  threshold: string
  outcomes: { yes: { label: string; question: string; definition: string }; comprehension: { label: string; question: string; answer: string; definition: string } }
  tests: Test[]
}

export const TRIALS = data as unknown as Trials

/** "Oct 2–7, 2026" */
export function fieldDates(t: Test) {
  const a = new Date(`${t.fielded.from}T12:00:00Z`)
  const b = new Date(`${t.fielded.to}T12:00:00Z`)
  const m = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
  return m(a) === m(b) ? `${m(a)} ${a.getUTCDate()}–${b.getUTCDate()}, ${b.getUTCFullYear()}` : `${m(a)} ${a.getUTCDate()} – ${m(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}`
}

export const videoArms = (t: Test) => t.arms.filter((a) => a.role !== "placebo")

/** Signed points: "+18", "−3", "0". */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")

/** Every test arm a YouTube video was matched to, for that video's page. */
export function trialsFor(youtubeId: string): { test: Test; arm: Arm }[] {
  return TRIALS.tests.flatMap((test) => test.arms.filter((a) => a.youtube === youtubeId).map((arm) => ({ test, arm })))
}

/** The groups where an arm beat the placebo, highest level first. */
export function markedGroups(test: Test, armId: string) {
  return test.subgroups
    .flatMap((d) => d.groups.map((g) => ({ dimension: d.dimension, group: g.group, cell: g.cells[armId], placebo: g.cells.placebo.v })))
    .filter((x) => x.cell?.sig)
    .sort((a, b) => b.cell.v - b.placebo - (a.cell.v - a.placebo))
}

export const reportHref = (page?: number) => `/library/${TRIALS.report}${page ? `?page=${page}` : ""}`

/** What a video page shows for each test its video was in: plain data, so a client page can take it as a
 *  prop without loading the whole file. */
export type TrialEntry = {
  test: string
  dates: string
  fieldedBy: string
  cards: boolean
  name: string
  n: number
  placeboN: number
  yes: Outcome
  comprehension: Outcome
  placebo: { yes: number; comprehension: number } | null
  groups: { total: number; marked: number; top: { dimension: string; group: string; v: number; placebo: number }[] }
  report: string
  experiments: string
}

export function trialEntries(youtubeId: string): TrialEntry[] {
  return trialsFor(youtubeId).map(({ test, arm }) => {
    const marked = markedGroups(test, arm.id)
    return {
      test: test.label,
      dates: fieldDates(test),
      fieldedBy: TRIALS.fieldedBy,
      cards: test.cards,
      name: arm.name,
      n: arm.n,
      placeboN: test.arms.find((a) => a.role === "placebo")?.n ?? 0,
      yes: arm.yes ?? {},
      comprehension: arm.comprehension ?? {},
      placebo: test.placebo ?? null,
      groups: { total: test.subgroups.reduce((s, d) => s + d.groups.length, 0), marked: marked.length, top: marked.slice(0, 3).map((m) => ({ dimension: m.dimension, group: m.group, v: m.cell.v, placebo: m.placebo })) },
      report: reportHref((test.pages.videos as number) ?? undefined),
      experiments: "/experiments",
    }
  })
}

/** Both tests as compact text for the discussion panel: the arms, then every group's levels, with the
 *  report's markers, which its chart pages carry as outlines and bold faces that page text loses. */
export function trialsText() {
  const lines = [`Structured results of "${TRIALS.title}" (${TRIALS.fieldedBy}; ${TRIALS.population}). * = marked vs placebo at the source's 90% threshold; ~ = small-sample flag (under 50 actual responses). Levels are % choosing Yes.`]
  for (const t of TRIALS.tests) {
    lines.push("", `${t.label}, fielded ${fieldDates(t)}, ${t.respondents.toLocaleString()} respondents (${t.weighted.toLocaleString()} weighted)${t.cards ? ", explanation cards added to the videos" : ""}. ${t.liftsNote}`)
    for (const a of t.arms) {
      if (a.role === "placebo") {
        lines.push(`- Placebo, n=${a.n}${a.yes?.level != null ? `, Yes ${a.yes.level}%, comprehension ${a.comprehension?.level}%` : ""}`)
        continue
      }
      const y = a.yes, c = a.comprehension
      lines.push(`- ${a.name}${a.producer ? ` (${a.producer}-produced)` : ""}, n=${a.n}: ballot support ${y?.level != null ? `${y.level}%, ` : ""}${signed(y?.lift ?? 0)} pts ${y?.sig ? "marked" : "not marked"}; comprehension ${c?.level != null ? `${c.level}%, ` : ""}${signed(c?.lift ?? 0)} pts ${c?.sig ? "marked" : "not marked"}`)
    }
    const arms = t.arms.map((a) => a.id)
    lines.push(`Groups (${arms.map((id) => t.arms.find((a) => a.id === id)!.name).join(" | ")}):`)
    for (const d of t.subgroups)
      for (const g of d.groups) lines.push(`${d.dimension} · ${g.group}: ${arms.map((id) => `${g.cells[id].v}${g.cells[id].sig ? "*" : ""}${g.cells[id].small ? "~" : ""}`).join(" | ")} (p. ${d.page})`)
  }
  return lines.join("\n")
}
