// Pre-publish features of a short: everything knowable before it is posted, from the title,
// description, tags, length, planned publish time and channel. One extractor serves both the
// training set (scripts/training-set.mjs) and the forecast (src/lib/forecast.ts), so a model
// trained on the catalog applies to a new video the same way. No imports: it runs under plain Node
// (--experimental-strip-types) as well as inside the app.
//
// Keys match data/velocity/metadata-lift.json where the trait is the same, so a forecast's inputs
// and the measured within-channel lifts line up.

export type VideoInput = {
  title: string
  description: string
  tags: string[]
  durationSec: number
  /** ISO time: when it was published, or when it will be. */
  published: string
  /** The channel's group id (lambda/velocity/channels.json), e.g. "reform-core". */
  group: string
  /** Median lifetime views of the channel's settled shorts. */
  channelMedian: number | null
}

/** The six families the lifts are read by; unmapped groups (suspect-automated) are left out of training. */
export const GROUP_FAMILY: Record<string, string> = {
  "reform-core": "Reform",
  reform: "Reform",
  "reform-opposition": "Reform",
  "voting-rights": "Voting rights",
  "media-nonpartisan": "Nonpartisan media",
  "independent-media": "Nonpartisan media",
  "official-D": "Candidates & officials",
  "official-R": "Candidates & officials",
  "candidate-D": "Candidates & officials",
  "candidate-R": "Candidates & officials",
  "candidate-independent": "Candidates & officials",
  "party-D": "Candidates & officials",
  "party-R": "Candidates & officials",
  "media-D": "Partisan media",
  "media-R": "Partisan media",
  uk: "UK",
}
export const FAMILIES = ["Reform", "Voting rights", "Nonpartisan media", "Candidates & officials", "Partisan media", "UK"]

const ANGER = /\b(lie|lies|lying|liar|corrupt|rigged|destroy|destroys|destroyed|slam|slams|outrage|outrageous|disgrace|disgraceful|furious|insane|crazy|shocking|unhinged|meltdown|scam|fraud|evil|traitor|disaster|pathetic|humiliat\w*|wrecks?|torch\w*|eviscerat\w*|explod\w*)\b/i
const CTA = /\b(subscribe|donate|chip in|sign (up|the|our)|join us|volunteer|register|vote (yes|no|for|early)|link in (bio|description)|learn more)\b/i

const et = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false })
export function easternBin(iso: string): { dow: number; hour: number } {
  const parts = et.formatToParts(new Date(iso))
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Mon")
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24
  return { dow: Math.max(0, dow), hour }
}

const words = (t: string) => t.replace(/#\w+/g, "").trim().split(/\s+/).filter(Boolean)

export type FeatureDef = { key: string; label: string; kind: "binary" | "continuous" | "family" }

/** Every feature, in the order the model stores them. */
export const FEATURE_DEFS: FeatureDef[] = [
  { key: "question", label: "Title asks a question", kind: "binary" },
  { key: "exclaim", label: "Exclamation mark in the title", kind: "binary" },
  { key: "number", label: "A number in the title", kind: "binary" },
  { key: "firstPerson", label: "First person in the title", kind: "binary" },
  { key: "you", label: "Addresses the viewer", kind: "binary" },
  { key: "caps", label: "A word in all caps", kind: "binary" },
  { key: "anger", label: "Combative words in the title", kind: "binary" },
  { key: "quote", label: "Quotation in the title", kind: "binary" },
  { key: "shortTitle", label: "Title of six words or fewer", kind: "binary" },
  { key: "longTitle", label: "Title of fifteen words or more", kind: "binary" },
  { key: "emoji", label: "Emoji in the title", kind: "binary" },
  { key: "hashtagTitle", label: "Hashtag in the title", kind: "binary" },
  { key: "trump", label: "Names Trump", kind: "binary" },
  { key: "titleWords", label: "Title length (log words)", kind: "continuous" },
  { key: "cta", label: "Call to action in the description", kind: "binary" },
  { key: "link", label: "Link in the description", kind: "binary" },
  { key: "noDescription", label: "No description", kind: "binary" },
  { key: "descWords", label: "Description length (log words)", kind: "continuous" },
  { key: "tags", label: "Has tags", kind: "binary" },
  { key: "tagCount", label: "Tag count (log)", kind: "continuous" },
  { key: "under20", label: "20 seconds or shorter", kind: "binary" },
  { key: "under35", label: "35 seconds or shorter", kind: "binary" },
  { key: "over60", label: "Longer than a minute", kind: "binary" },
  { key: "logDuration", label: "Length (log seconds)", kind: "continuous" },
  { key: "weekend", label: "Posted on a weekend", kind: "binary" },
  { key: "morning", label: "Posted 6 to 11am Eastern", kind: "binary" },
  { key: "evening", label: "Posted 6 to 11pm Eastern", kind: "binary" },
  { key: "night", label: "Posted midnight to 5am Eastern", kind: "binary" },
  { key: "logMedian", label: "Channel size (log median views)", kind: "continuous" },
  ...FAMILIES.map((f) => ({ key: `family:${f}`, label: f, kind: "family" as const })),
]

export function extract(v: VideoInput): Record<string, number> {
  const title = v.title ?? ""
  const desc = v.description ?? ""
  const tw = words(title)
  const dw = words(desc)
  const { dow, hour } = easternBin(v.published)
  const fam = GROUP_FAMILY[v.group] ?? null
  const x: Record<string, number> = {
    question: +title.includes("?"),
    exclaim: +title.includes("!"),
    number: +/\d/.test(title),
    firstPerson: +/\b(I|my|me|I'm|I've|I'll)\b/.test(title),
    you: +/\b(you|your|you're)\b/i.test(title),
    caps: +tw.some((w) => /^[A-Z]{4,}[!?.,]*$/.test(w)),
    anger: +ANGER.test(title),
    quote: +/["“”]/.test(title),
    shortTitle: +(tw.length <= 6),
    longTitle: +(tw.length >= 15),
    emoji: +/\p{Extended_Pictographic}/u.test(title),
    hashtagTitle: +/#\w/.test(title),
    trump: +/\btrump\b/i.test(title),
    titleWords: Math.log1p(tw.length),
    cta: +CTA.test(desc),
    link: +/https?:\/\//.test(desc),
    noDescription: +(desc.trim().length === 0),
    descWords: Math.log1p(dw.length),
    tags: +((v.tags ?? []).length > 0),
    tagCount: Math.log1p((v.tags ?? []).length),
    under20: +(v.durationSec > 0 && v.durationSec <= 20),
    under35: +(v.durationSec > 0 && v.durationSec <= 35),
    over60: +(v.durationSec > 60),
    logDuration: Math.log1p(Math.max(0, v.durationSec)),
    weekend: +(dow >= 5),
    morning: +(hour >= 6 && hour < 12),
    evening: +(hour >= 18 && hour < 24),
    night: +(hour < 6),
    logMedian: Math.log10((v.channelMedian ?? 0) + 1),
  }
  for (const f of FAMILIES) x[`family:${f}`] = +(fam === f)
  return x
}

export const familyOf = (group: string) => GROUP_FAMILY[group] ?? null
