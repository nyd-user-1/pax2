// The prompt PAX2GPT (Claude on Bedrock, rented) writes a volunteer's script from: the framing to
// build on, what Swayable's tested campaign ads found, what travels on the campaign's own channels
// (organic-evidence.ts), and the volunteer's three answers. A plain function so the prompt can be
// read and tested without the server action around it (src/app/actions.ts writeScript).
import feed from "../../data/generated/home-feed.json"
import model from "../../data/generated/model/reference-model.json"
import channels from "../../data/velocity/channels.json"
import { CAMPAIGN_FAMILY, organicEvidence, type OrganicFamily } from "./organic-evidence"

export type WriterAnswers = { name: string; role: string; town: string; why: string; moment: string }
export type WriterBase = { title: string; framing: string; text: string }

// The ten reform-core shorts with the highest iWAR (views over the channel's median) in the home feed.
const REFORM_CORE = new Set((channels as { id: string; group: string }[]).filter((c) => c.group === "reform-core").map((c) => c.id))
const TRAVELLED = (feed as { title: string; channel: string; channelId: string; ratio: number }[])
  .filter((v) => REFORM_CORE.has(v.channelId))
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 10)

// Swayable's randomized ad tests: the coded traits whose 95% range clears zero, the same figures the
// editor's checks and the Scripts page quote.
type Outcome = { ads: number; features: { key: string; diff: number; low: number; high: number }[] }
const RM = model as unknown as { featureLabels: Record<string, string>; outcomes: Record<string, Outcome> }
const OUTCOME_NAME: Record<string, string> = { votechoice: "vote choice", favorability: "favorability" }
function swayableLines() {
  const out: string[] = []
  for (const [k, name] of Object.entries(OUTCOME_NAME)) {
    const o = RM.outcomes[k]
    for (const f of o?.features ?? [])
      if (f.low > 0 || f.high < 0) out.push(`${RM.featureLabels[f.key] ?? f.key}: ${f.diff > 0 ? "+" : "−"}${Math.abs(f.diff).toFixed(1)} points of ${name} (95% range ${f.low.toFixed(1)} to ${f.high.toFixed(1)}), ${o.ads} tested ads.`)
  }
  return out
}

function channelLines(family: OrganicFamily) {
  const ev = organicEvidence(family)
  const lifts = ev.traits.filter((t) => t.direction === "lifts").map((t) => t.sentence)
  const sinks = ev.traits.filter((t) => t.direction === "sinks").map((t) => t.sentence)
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n")
  return [
    `Measured within each channel, on the ${ev.scope}: the share of shorts with a trait that reached 3x their channel's median, against the same channel's shorts without it. Traits named for the title were measured on titles; in a script they matter most in the opening line.`,
    lifts.length ? `Lifts:\n${list(lifts)}` : "",
    sinks.length ? `Sinks:\n${list(sinks)}` : "",
    ev.patterns.length ? `How the coded reform shorts that broke out were delivered, against the rest:\n${list([...ev.patterns.map((p) => p.sentence), ...ev.delivery])}` : "",
    family === "reform" || family === "all" ? `The titles of the ten reform-channel shorts with the highest iWAR (views against their channel's median):\n${list(TRAVELLED.map((v) => `"${v.title}" (${v.channel}, ${v.ratio.toFixed(1)}x)`))}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function writerPrompt(base: WriterBase, input: WriterAnswers, family: OrganicFamily = CAMPAIGN_FAMILY) {
  // Ruled 2026-10-18: 45 to 60 words, about 20 to 27 seconds spoken. On the reform channels, shorts of 20
  // seconds or less reach 3x their channel's median 6.5 points more often (90% range 1 to 13, 6 channels,
  // 56 shorts, data/velocity/metadata-lift.json); 35 and 60 seconds showed nothing that clears zero. The
  // old 80 to 110 words ran 37 to 51 seconds. The library scripts keep their lengths.
  return `Write a script a volunteer will read to a phone camera, 45 to 60 words, about 20 seconds spoken, in the first person, in plain spoken English that sounds like this person, not like a campaign.
Build it on this argument (keep its core claim and framing): "${base.title}" — ${base.framing}
Reference text of that argument:
${base.text}

What tested campaign ads found (Swayable's randomized tests against a placebo video):
${swayableLines().map((l) => `- ${l}`).join("\n") || "- (nothing measured clears zero)"}

What travels on these channels
${channelLines(family)}

Observed patterns, not rules: weigh them, don't obey them blindly. Where they fit this person's story, favor the traits that lift and avoid the ones that sink. Never quote any of these figures in the script itself.

About the volunteer, in their words:
- Name: ${input.name || "(not given)"}
- Who they are: ${input.role || "(not given)"}${input.town ? `, ${input.town}` : ""}
- Why this matters to them: ${input.why}
- A moment they felt they had no real choice: ${input.moment || "(not given)"}

Rules: open with one short line that would make someone stop scrolling; use one of their own details; keep any number only if it appears in the reference text; end with "Vote yes on Question 3." Return only the script, line breaks between sentences groups, no title.`
}
