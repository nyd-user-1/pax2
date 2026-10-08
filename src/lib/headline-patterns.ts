import upworthy from "../../data/generated/upworthy-top.json"

/** The Upworthy headline patterns; the same tests as scripts/upworthy-top.mjs. */
export const PATTERN_TESTS: Record<string, (h: string) => boolean> = {
  digit: (h) => /\d/.test(h),
  this: (h) => /^(this|these)\b/i.test(h),
  question: (h) => h.includes("?"),
  you: (h) => /\byou(r|['’]re)?\b/i.test(h),
  quote: (h) => /[“”"]/.test(h),
  caps: (h) => /\b[A-Z]{3,}\b/.test(h),
  whatwhyhow: (h) => /^(what|why|how)\b/i.test(h),
  watch: (h) => /\b(watch|see|listen)\b/i.test(h),
  ellipsis: (h) => /(\.\.\.|…|—| - )/.test(h),
  firstperson: (h) => /\b(i|i['’]m|my|me)\b/i.test(h),
}

/** A title read against every pattern, the ones it carries first. */
export const titlePatterns = (title: string) =>
  upworthy.patterns.map((p) => ({ key: p.key, label: p.label, won: p.won, lost: p.lost, has: PATTERN_TESTS[p.key]?.(title) ?? false })).sort((a, b) => Number(b.has) - Number(a.has))
