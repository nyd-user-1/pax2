import "server-only"

import feed from "../../data/generated/home-feed.json"
import model from "../../data/generated/model/var-model.json"
import patterns from "../../data/generated/swayable-patterns.json"
import { forecast, recommendations, type VideoInput } from "@/lib/forecast"
import { titlePatterns } from "@/lib/headline-patterns"
import type { Evaluation, Original, Recommendation, Trait } from "@/lib/originals"

// The PAX2 evaluation of an original video. One model pass reads the script the messenger recorded
// and codes it on Swayable's traits, quoting the line that shows each one, and writes a concrete
// change for each trait worth adding or dropping. Every number comes from the evidence files, never
// from the model:
//   persuasion  each trait's lean from Swayable's tests: its ads against the other ads in the same
//               study (data/generated/swayable-patterns.json)
//   virality    the title against Upworthy's headline tests (won vs. lost)
//   forecast    PAX2 Classifier's chance of a Hit from what the video will carry at publish and, when
//               its Gate C passed, from the script as the transcript; the views to expect; and the
//               distribution recommendations from the measured within-channel lifts (src/lib/forecast.ts)
// The script stands in for what was said: the recording's words are the script.

const MODEL = process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"
const TRAITS = patterns.traits as { key: string; label: string; ads: number; diff: number; low: number; high: number }[]

// An original goes out on a reform channel; until PAX2 has its own, Vote YES on 3 is the stand-in.
// Its median is the catalog's (data/velocity/catalog.json), carried on every row of the home feed,
// which the app already bundles; the 12 MB catalog stays out of the server bundle.
const STAND_IN = "UC-rKSUWdEqPmP-UM7yV6Ssw"
const STAND_IN_ROW = (feed as { channelId: string; channel: string; channelMedian?: number }[]).find((v) => v.channelId === STAND_IN)
const CHANNEL_MEDIAN: number | null = STAND_IN_ROW?.channelMedian ?? null
const MEDIAN_SOURCE = STAND_IN_ROW ? `${STAND_IN_ROW.channel}'s median of settled shorts, the stand-in channel` : null
const CHANNELS = Number((model as { method: string }).method.match(/from (\d+) channels/)?.[1]) || null

/** What PAX2 Classifier reads from an original. The script stands in for the description and is the transcript. */
export function videoInputOf(o: Original): VideoInput & { transcript: string | null } {
  const firstLine = (o.text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  return {
    title: o.title?.trim() || firstLine,
    description: o.text ?? "",
    tags: [],
    durationSec: o.seconds,
    published: o.publishAt ?? new Date().toISOString(),
    group: "reform-core",
    channelMedian: CHANNEL_MEDIAN,
    transcript: o.text?.trim() || null,
  }
}

type Coded = { summary: string; traits: { key: string; present: boolean; quote?: string; change?: string }[]; title?: string }

function prompt(o: Original) {
  return `You are coding a short political video for PAX2. Below is the script its messenger recorded${o.title ? `, titled "${o.title}"` : ""}${o.seconds ? `, ${o.seconds} seconds long` : ""}.

SCRIPT:
${o.text ?? "(no script given)"}

MESSENGER: ${[o.name, o.role, o.town].filter(Boolean).join(", ") || "(not given)"}

For each trait below, decide whether the video carries it (present: true only when the script clearly shows it) and quote the shortest line that shows it. Then, for every trait, write "change": one concrete sentence telling the messenger how to add the trait if it is absent or drop it if it is present, in this script's own terms (name the line to cut or write the new line). Keep it plain; no jargon.

TRAITS (key: meaning):
${TRAITS.map((t) => `${t.key}: ${t.label}`).join("\n")}

Also write "summary": two plain sentences on what the video says and how. And "title": a better short title for the video, under 70 characters.

Reply with JSON only: {"summary": "...", "title": "...", "traits": [{"key": "...", "present": true, "quote": "...", "change": "..."}]}`
}

export async function evaluate(o: Original): Promise<Evaluation> {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime")
  const client = new BedrockRuntimeClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
  const r = await client.send(new ConverseCommand({ modelId: MODEL, messages: [{ role: "user", content: [{ text: prompt(o) }] }], inferenceConfig: { maxTokens: 4000, temperature: 0 } }))
  const raw = r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? ""
  const coded = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Coded
  const byKey = new Map(coded.traits.map((t) => [t.key, t]))

  const traits: Trait[] = TRAITS.filter((t) => byKey.get(t.key)?.present).map((t) => ({ key: t.key, label: t.label, quote: byKey.get(t.key)?.quote, diff: t.diff, low: t.low, high: t.high }))
  const lean = +traits.reduce((s, t) => s + t.diff, 0).toFixed(2)

  // Persuasion: the three changes with the biggest lean — add a trait that leans ahead, drop one that leans behind.
  const persuasion: Recommendation[] = TRAITS.map((t) => {
    const c = byKey.get(t.key)
    const present = !!c?.present
    const gain = present ? -t.diff : t.diff
    return { t, c, present, gain }
  })
    .filter((x) => x.gain > 0.05 && x.c?.change && x.t.ads >= 25)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map(({ t, c, present, gain }) => ({
      axis: "persuasion",
      change: c!.change!,
      why: `${present ? "Drop" : "Add"} ${t.label.toLowerCase()}: in Swayable's tests, ads ${present ? "without" : "with"} it moved ${gain.toFixed(2)} more points of vote choice than the other ads in the same campaign.`,
      diff: +gain.toFixed(2),
      low: present ? -t.high : t.low,
      high: present ? -t.low : t.high,
      source: "Swayable",
    }))

  // Virality: the title against Upworthy's headline tests.
  const title = titlePatterns(o.title ?? "")
  const virality: Recommendation[] =
    coded.title && o.title && coded.title.trim() !== o.title.trim()
      ? [{ axis: "virality", change: `Retitle it: "${coded.title.trim()}"`, why: "In Upworthy's tests the same story under its best headline drew a median 1.9 times the clicks of its worst.", source: "Upworthy" }]
      : []

  const input = videoInputOf(o)
  const f = forecast(input, null, input.transcript)
  const d = recommendations(input)
  return {
    model: MODEL,
    summary: coded.summary,
    traits,
    lean,
    title,
    recommendations: [...persuasion, ...virality],
    forecast: { p: f.p, model: f.model, base: f.base, anchor: f.anchor, expected: f.expected ? { ...f.expected, medianSource: MEDIAN_SOURCE } : null, strength: { ...f.strength, channels: CHANNELS }, contributions: f.contributions.slice(0, 6) },
    distribution: { changes: d.changes, keeps: d.keeps },
  }
}
