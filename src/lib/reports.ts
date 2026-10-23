// Reports in the library: the original PDF in private S3 (library/reports/<slug>.pdf), served only to a
// signed-in reader through /api/reports/<slug>/pdf, and every page's text (scripts/reports/ingest.mjs)
// for the library's search and the discussion panel.
import maQ3 from "../../data/generated/reports/ma-message-testing-2026-10.json"
import massinc from "../../data/generated/reports/massinc-ballot-questions-2026-09.json"

export type ReportPage = { n: number; source: "text" | "ocr"; text: string }
export type Report = { slug: string; title: string; publisher: string | null; date: string | null; key: string; bytes: number; pages: ReportPage[] }

/** What each report is, in one line, and its tags; the text comes from the ingest. */
const ABOUT: Record<string, { summary: string; tags: string[]; experiments?: boolean }> = {
  "ma-message-testing-2026-10": {
    summary: "Two randomized, placebo-controlled tests of ten Question 3 videos (Grow Progress, October 2026): ballot support and comprehension, overall and in 74 voter groups.",
    tags: ["experiments", "persuasion", "Massachusetts", "Question 3"],
    experiments: true,
  },
  "massinc-ballot-questions-2026-09": {
    summary: "MassINC Polling Group for CommonWealth Beacon, September 14–22, 2026: 800 likely voters on the nine Massachusetts ballot questions, Question 3 at 43% Yes, 36% No, 20% undecided.",
    tags: ["polling", "Massachusetts", "Question 3"],
  },
}

export const REPORTS = [maQ3 as unknown as Report, massinc as unknown as Report]

export const reportBySlug = (slug: string) => REPORTS.find((r) => r.slug === slug) ?? null
export const reportAbout = (slug: string) => ABOUT[slug] ?? { summary: "", tags: [] }

/** Letter-spaced headings ("E X E C U T I V E") read back as words' letters run together. */
const tidy = (s: string) => s.replace(/\b(?:[A-Z0-9&·,-] ){3,}[A-Z0-9&·,-]\b/g, (m) => m.replace(/ /g, "")).replace(/[ \t]+/g, " ")

/** The report as the discussion panel reads it: every page, marked so an answer can cite it, then any
 *  structured results built from it. */
export function reportContext(r: Report, structured?: string) {
  const pages = r.pages.map((p) => `[p. ${p.n}]\n${tidy(p.text)}`).join("\n\n")
  return `ACTIVE CONTEXT — the user is reading the report "${r.title}"${r.publisher ? ` (${r.publisher}, ${r.date ?? ""})` : ""} in the library (/library/${r.slug}). Answer from it, quote its numbers exactly, and cite the page as (p. N) after each claim. If the report does not say, say so.${structured ? `\n\n${structured}` : ""}\n\nThe report's ${r.pages.length} pages:\n\n${pages}`
}
