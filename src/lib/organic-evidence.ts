// What travels on the campaigns' own channels, for a script: the within-channel lifts of the
// pre-publish traits (data/velocity/metadata-lift.json) and the delivery patterns of the coded reform
// shorts that broke out (data/generated/organic-patterns.json). The one reader of those two files for
// the writer's prompt, the editor's sixth check and the library scripts' research prior; nothing else
// in that chain re-reads them. Trait tests come from video-features.ts, the extractor the lifts were
// keyed to, so a script line is tested exactly the way a title was.
//
// Relative imports only, so scripts/script-organic.mjs can load this file through jiti.
import lift from "../../data/velocity/metadata-lift.json"
import organic from "../../data/generated/organic-patterns.json"
import { extract } from "./video-features"

export type OrganicFamily = "reform" | "voting-rights" | "nonpartisan" | "all"

/** The one campaign, Massachusetts Question 3 (all-party primaries), is an electoral-reform measure. */
export const CAMPAIGN_FAMILY: OrganicFamily = "reform"

const GROUP: Record<Exclude<OrganicFamily, "all">, string> = { reform: "Reform", "voting-rights": "Voting rights", nonpartisan: "Nonpartisan media" }

// Traits a script's words or length can carry. The rest (title length, emoji, hashtags, the
// description, tags, the posting hour) are set when the video is posted, not in the script.
const IN_TEXT = ["question", "exclaim", "number", "firstPerson", "you", "caps", "anger", "quote", "trump"]
const IN_LENGTH = ["under20", "under35", "over60"]

type Effect = { points: number; low: number; high: number; channels: number; videos: number; basePushed: number } | null
type LiftRow = { key: string; label: string; all: Effect; byGroup: Record<string, Effect> }
const LIFT = lift as unknown as { builtAt: string; method: string; videos: number; channels: number; rows: LiftRow[] }
type Pattern = { key: string; label: string; above: number; below: number }
const ORGANIC = organic as unknown as { built: string; method: string; counts: { above: number; below: number }; means: Record<string, { above: number; below: number }>; patterns: Pattern[] }

export type OrganicTrait = {
  key: string
  /** The trait as the lift file names it. */
  label: string
  /** Where a script carries it: in a line's words, or in its length. */
  carrier: "text" | "length"
  /** Percentage points in the share of shorts reaching 3x their channel's median, within channel, with its 90% range. */
  points: number
  low: number
  high: number
  channels: number
  videos: number
  /** "lifts" or "sinks" when the 90% range clears zero; "unclear" when it straddles it. */
  direction: "lifts" | "sinks" | "unclear"
  sentence: string
}

export type OrganicPattern = { key: string; label: string; above: number; below: number; aboveN: number; belowN: number; sentence: string }

export type OrganicEvidence = {
  family: OrganicFamily
  /** How the family's channels are named in sentences. */
  scope: string
  traits: OrganicTrait[]
  /** Only for reform and all: the coded shorts all come from reform channels. */
  patterns: OrganicPattern[]
  delivery: string[]
  /** How many coded reform shorts sit above and below the set's median. */
  counts: { above: number; below: number }
  method: { lift: string; patterns: string; liftBuilt: string; patternsBuilt: string }
}

/** Patterns whose share differs by at least this many points between the shorts above and below the set's median. */
const PATTERN_GAP = 10

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
const range = (lo: number, hi: number) => `${lo < 0 ? "−" : ""}${Math.abs(lo)} to ${hi < 0 ? "−" : ""}${Math.abs(hi)}`

/** For a family: every script-carried trait with a measured lift on its channels, strongest first,
 *  and the delivery patterns that separate the coded shorts that broke out from the rest, each as a
 *  plain sentence with its numbers. */
export function organicEvidence(family: OrganicFamily): OrganicEvidence {
  const scope = family === "all" ? "all channels" : `${GROUP[family].toLowerCase()} channels`
  const traits: OrganicTrait[] = []
  for (const row of LIFT.rows) {
    const carrier = IN_TEXT.includes(row.key) ? "text" : IN_LENGTH.includes(row.key) ? "length" : null
    if (!carrier) continue
    const e = family === "all" ? row.all : row.byGroup[GROUP[family]]
    if (!e) continue
    const direction = e.low > 0 ? "lifts" : e.high < 0 ? "sinks" : "unclear"
    traits.push({
      key: row.key,
      label: row.label,
      carrier,
      points: e.points,
      low: e.low,
      high: e.high,
      channels: e.channels,
      videos: e.videos,
      direction,
      sentence: `${row.label}: ${signed(e.points)} points in the share of shorts reaching 3x their channel's median (90% range ${range(e.low, e.high)}), within ${e.channels} ${family === "all" ? "channels" : scope}, ${e.videos} shorts with it.`,
    })
  }
  traits.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))

  const reformSet = family === "reform" || family === "all"
  const { above: nA, below: nB } = ORGANIC.counts
  const patterns: OrganicPattern[] = reformSet
    ? ORGANIC.patterns
        .filter((p) => Math.abs(p.above - p.below) >= PATTERN_GAP)
        .sort((a, b) => Math.abs(b.above - b.below) - Math.abs(a.above - a.below))
        .map((p) => {
          const aboveN = Math.round((p.above / 100) * nA)
          const belowN = Math.round((p.below / 100) * nB)
          return { ...p, aboveN, belowN, sentence: `${p.label}: ${aboveN} of the ${nA} coded reform shorts above the set's median Organic score (${p.above}%), ${belowN} of the ${nB} below (${p.below}%).` }
        })
    : []
  const m = ORGANIC.means
  const delivery = reformSet
    ? [
        `Pace: ${m.wpm.above} words a minute in the ${nA} above the median, ${m.wpm.below} in the ${nB} below.`,
        `Length: ${m.durationSec.above} seconds on average above the median, ${m.durationSec.below} below.`,
      ]
    : []

  return { family, scope, traits, patterns, delivery, counts: ORGANIC.counts, method: { lift: LIFT.method, patterns: ORGANIC.method, liftBuilt: LIFT.builtAt.slice(0, 10), patternsBuilt: ORGANIC.built } }
}

export type OrganicCheckLine = {
  key: string
  label: string
  direction: "lifts" | "sinks"
  points: number
  low: number
  high: number
  channels: number
  scope: string
  /** Whether the script carries the trait; good when it carries one that lifts or avoids one that sinks. */
  present: boolean
  good: boolean
  /** 1-based line of the script that carries it, or null for length and for "not present". */
  line: number | null
  /** The sentence that carries it or "not present"; for length, "about N seconds to say". */
  where: string
}

const sentences = (para: string) => para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
const PROBE = { description: "", tags: [], durationSec: 0, published: "2026-01-05T14:00:00Z", group: "", channelMedian: null }

/** The editor's sixth check: for each trait that measurably lifts or sinks on the family's channels,
 *  whether the script carries it and where. `seconds` is the caller's own speaking-time estimate. */
export function organicCheck(text: string, seconds: number, family: OrganicFamily = CAMPAIGN_FAMILY): OrganicCheckLine[] {
  const ev = organicEvidence(family)
  const paras = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const out: OrganicCheckLine[] = []
  for (const t of ev.traits) {
    if (t.direction === "unclear") continue
    let line: number | null = null
    let where = "not present"
    let present = false
    if (t.carrier === "text") {
      search: for (let i = 0; i < paras.length; i++)
        for (const s of sentences(paras[i]))
          if (extract({ ...PROBE, title: s })[t.key] > 0) {
            line = i + 1
            where = s.length > 90 ? `${s.slice(0, 89)}…` : s
            present = true
            break search
          }
    } else if (seconds > 0) {
      present = extract({ ...PROBE, title: "", durationSec: seconds })[t.key] > 0
      where = `about ${seconds} seconds to say`
    }
    out.push({ key: t.key, label: t.label, direction: t.direction, points: t.points, low: t.low, high: t.high, channels: t.channels, scope: ev.scope, present, good: present === (t.direction === "lifts"), line, where })
  }
  return out
}
