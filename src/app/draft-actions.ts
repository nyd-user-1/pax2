"use server"

import { CAMPAIGN_FAMILY, organicEvidence, type OrganicFamily } from "@/lib/organic-evidence"
import { TRAIT_DEFINITIONS } from "@/lib/trait-definitions"

// Codes a draft script on the delivery patterns of the coded reform shorts (data/generated/
// organic-patterns.json), the way the 40 shorts and the library scripts were coded: PAX2 Trait Labeler,
// Claude on Bedrock reading the words alone. One call per press of the editor's button, cents each;
// the draft must be between 20 and 600 words. Returns present or absent per pattern key, for
// patternCheck() in src/lib/organic-evidence.ts.

const MODEL = process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"
const EXTRA: Record<string, string> = { question_hook: "The first sentence is a question put to the viewer." }

export type DraftCodes = { codes: Record<string, boolean>; quotes: Record<string, string>; model: string; at: string }

export async function codeDraft(text: string, family: OrganicFamily = CAMPAIGN_FAMILY): Promise<DraftCodes> {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words < 20 || words > 600) throw new Error("Write between 20 and 600 words first.")
  const patterns = organicEvidence(family).patterns
  if (!patterns.length) throw new Error("No coded shorts for this family yet.")
  const prompt = `You are coding a short political video script on the traits below, reading the words alone. A trait is present only when the script clearly shows it. Quote the shortest line that shows each present trait.

SCRIPT:
${text.trim()}

TRAITS (key: meaning):
${patterns.map((p) => `${p.key}: ${TRAIT_DEFINITIONS[p.key] ?? EXTRA[p.key] ?? p.label}`).join("\n")}

Reply with JSON only: {"traits": [{"key": "...", "present": true, "quote": "..."}]} with one entry per key above.`
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime")
  const client = new BedrockRuntimeClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
  const r = await client.send(new ConverseCommand({ modelId: MODEL, messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 1500, temperature: 0 } }))
  const raw = r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? ""
  const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { traits?: { key: string; present?: boolean; quote?: string }[] }
  const codes: Record<string, boolean> = {}
  const quotes: Record<string, string> = {}
  for (const p of patterns) {
    const t = parsed.traits?.find((x) => x.key === p.key)
    codes[p.key] = !!t?.present
    if (t?.present && t.quote) quotes[p.key] = String(t.quote).slice(0, 160)
  }
  return { codes, quotes, model: MODEL, at: new Date().toISOString() }
}

/** PAX2 Headline Ranker v1 on a draft's opening line: its score read against the held-out Upworthy
 *  headlines as a percentile; null when the serving Lambda is absent. */
export async function scoreOpeningLine(text: string): Promise<{ percentile: number; accuracy: number } | null> {
  const first = (text.trim().split(/(?<=[.!?])\s+/)[0] ?? "").trim()
  if (first.split(/\s+/).filter(Boolean).length < 3) return null
  const { scoreHeadlinesV1 } = await import("@/lib/headline-v1")
  const r = await scoreHeadlinesV1([first])
  return r?.[0] ? { percentile: r[0].percentile, accuracy: r[0].accuracy } : null
}
