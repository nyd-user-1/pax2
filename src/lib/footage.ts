// A script's footage: the shots a text-to-video model generates (the opening shot, and the b-roll behind
// each line) and the graphics Remotion draws at no cost. One plan per script text, written once and kept
// in S3, so everyone who picks the same script gets the same plan, and every clip made for it is paid
// for once. The storyboard lays the script out line by line: each line's shot underneath, at most one
// graphic over it, the captions and the lower third across the whole video.

export type Shot = { id: string; kind: "opening" | "broll"; line?: string; prompt: string; seconds: number }

export type Graphics = {
  checklist: { title: string; items: string[]; footer: string }
  callout: { text: string; highlight: string }
  stat: { value: string; label: string }
  quote: { text: string; by: string }
  intro: { title: string; sub: string }
  end: { ask: string; handle: string }
  lowerThird: { name: string; role: string }
}

/** Captions come from the script's words, not the plan, so they are a kind without fields. */
export type GraphicKind = keyof Graphics | "captions"

export type FootagePlan = { key: string; shots: Shot[]; graphics: Graphics }

/** Where the plus menu sends a script: its shots, or one of its graphics. */
export type FootageFocus = "shots" | GraphicKind

export const GRAPHIC_KINDS: { id: GraphicKind; label: string; about: string; seconds: number }[] = [
  { id: "checklist", label: "Checklist card", about: "The measure's name, three checked rows saying what it does, and a footer bar, over the lower half", seconds: 5 },
  { id: "captions", label: "Captions", about: "The spoken words on screen as they are said, the word being spoken in color", seconds: 5 },
  { id: "lowerThird", label: "Lower third", about: "The messenger's name and role, over the first seconds", seconds: 4 },
  { id: "callout", label: "Callout", about: "One phrase from the script on screen, its key word in color", seconds: 3 },
  { id: "stat", label: "Stat card", about: "The script's number, large, with what it counts", seconds: 4 },
  { id: "quote", label: "Quote", about: "The strongest line, set as a pull quote", seconds: 4 },
  { id: "intro", label: "Intro", about: "A title card for the first seconds", seconds: 3 },
  { id: "end", label: "End credits", about: "The ask, full screen, over the close", seconds: 4 },
]

/** Kinds that take over the whole frame; the rest sit over the line's shot. */
export const FULL_FRAME: GraphicKind[] = ["intro", "end"]

// ---------- the brand kit ----------

export type BrandFont = "jakarta" | "condensed" | "serif"
export type Brand = { name: string; logo: string | null; primary: string; accent: string; font: BrandFont }

export const FONTS: Record<BrandFont, { label: string; stack: string }> = {
  jakarta: { label: "Sans", stack: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" },
  condensed: { label: "Condensed", stack: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', sans-serif" },
  serif: { label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
}

export const BRAND_PRESETS: Brand[] = [
  { name: "Yes on 3", logo: "/logos/channels/UC-rKSUWdEqPmP-UM7yV6Ssw.jpg", primary: "#24398c", accent: "#ea6a24", font: "jakarta" },
  { name: "PAX", logo: null, primary: "#1e3a8a", accent: "#dc2626", font: "jakarta" },
]

// ---------- the storyboard ----------

/** One line of the script: the shot behind it, its seconds, and the graphic over it (or none). */
export type Row = { shotId: string; line: string; seconds: number; graphic: GraphicKind | null }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}/]+/gu, " ").trim()

/** The script's sentences, as the plan's shots split them. */
export const sentencesOf = (script: string) => script.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/).filter(Boolean)

/** The storyboard's first draft: each shot on its line, and each graphic on the line whose words it
 *  quotes: the checklist first, on the line that says what the measure does (it is the comprehension
 *  card), then the stat on the line with its number, the quote on its sentence, the callout on its
 *  phrase, and the end credits on the last line. A line
 *  takes at most one graphic; a graphic with no matching line waits in the strip. */
export function defaultRows(plan: FootagePlan, script: string): Row[] {
  const first = sentencesOf(script)[0] ?? ""
  const rows: Row[] = plan.shots.map((s) => ({ shotId: s.id, line: s.kind === "opening" ? first : s.line ?? "", seconds: s.seconds, graphic: null }))
  const g = plan.graphics
  const place = (kind: GraphicKind, test: (line: string) => boolean) => {
    const r = rows.find((x) => !x.graphic && test(norm(x.line)))
    if (r) r.graphic = kind
  }
  if (g.checklist?.title) place("checklist", (l) => /every|one (open|primary|ballot)|top two|all candidates/.test(l))
  if (g.stat?.value) place("stat", (l) => l.includes(norm(g.stat.value)) || /\d/.test(l))
  if (g.quote?.text) place("quote", (l) => !!l && norm(g.quote.text).startsWith(l.slice(0, 24)))
  if (g.callout?.text) place("callout", (l) => l.includes(norm(g.callout.text).split(" ").slice(0, 2).join(" ")))
  if (rows.length && !rows[rows.length - 1].graphic && g.end?.ask) rows[rows.length - 1].graphic = "end"
  return rows
}
