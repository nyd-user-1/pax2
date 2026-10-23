// A script's footage: the shots a text-to-video model generates (the opening shot, and the b-roll behind
// each line) and the graphics Remotion draws at no cost (the checklist card, a callout, a stat card, a
// quote, an intro, end credits). One plan per script text, written once and kept in S3, so everyone who
// picks the same script gets the same plan, and every clip made for it is paid for once.

export type Shot = { id: string; kind: "opening" | "broll"; line?: string; prompt: string; seconds: number }

export type Graphics = {
  checklist: { title: string; items: string[]; footer: string }
  callout: { text: string; highlight: string }
  stat: { value: string; label: string }
  quote: { text: string; by: string }
  intro: { title: string; sub: string }
  end: { ask: string; handle: string }
}

export type GraphicKind = keyof Graphics

export type FootagePlan = { key: string; shots: Shot[]; graphics: Graphics }

/** Where the plus menu sends a script: its shots, or one of its graphics. */
export type FootageFocus = "shots" | GraphicKind

export const GRAPHIC_KINDS: { id: GraphicKind; label: string; about: string; seconds: number }[] = [
  { id: "checklist", label: "Checklist card", about: "A title, three checked rows and a footer bar, over the lower half", seconds: 5 },
  { id: "callout", label: "Callout", about: "One phrase from the script on screen, its key word in color", seconds: 3 },
  { id: "stat", label: "Stat card", about: "The script's number, large, with what it counts", seconds: 4 },
  { id: "quote", label: "Quote", about: "The strongest line, set as a pull quote", seconds: 4 },
  { id: "intro", label: "Intro", about: "A title card for the first seconds", seconds: 3 },
  { id: "end", label: "End credits", about: "The ask, full screen, over the close", seconds: 4 },
]

// ---------- the brand kit ----------
// The graphics' dress, picked from the Graphics card's palette (Brendan, 2026-10-23): a preset, a
// typeface, two colors and a logo, saved to the script with its footage.

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
