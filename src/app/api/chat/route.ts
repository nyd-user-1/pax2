import { MODEL_IDS } from "@/lib/model-options"
import { BedrockRuntimeClient, ConverseStreamCommand, type Message } from "@aws-sdk/client-bedrock-runtime"

import { COMPONENTS } from "@/lib/resonance"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"
import { anonSpend } from "@/lib/anon"
import { evidencePrompt } from "@/lib/script-evidence"
import { metricsGuide } from "@/lib/metrics-guide"

// The /chat answer, after solar's /api/chat: a system prompt carrying the record (here, every take's
// current score and its parts, and the scripts), then the reply streamed back as plain text.

const client = new BedrockRuntimeClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
const MODEL = process.env.PAX2_CHAT_MODEL ?? process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"

const BASE_SYSTEM_PROMPT = `You are the analyst inside PAX2, a tool that scores advocacy videos for the Question 3 campaign (Massachusetts' top-two primary initiative).

Resonance is a 0-100 score: 50 is the reference average of the first round of paid results. It is built from Engage (3-second plays over impressions, 25%), Interest (average watch time over length, 40%) and Act (shares, saves and comments over 3-second plays, 35%). Each score carries a range; a take whose range spans 50 cannot yet be told apart from average.

When the record below has a number, use that exact number. When it does not, say so plainly rather than estimating. Delivery (spend, reach) is a condition beside the score, never part of it. Speak like a sharp campaign analyst: lead with the numbers, compare takes, and say what the evidence does and does not support.

Write every sentence as a co-author of a scientific paper would: claims, measurements, mechanisms, and their limits. No metaphor, idiom, hyperbole or mood words; no editorial asides. One concept, one name: the ratio of a video's views to its own channel's median views is its Outlier Score (write "a 2.77x Outlier Score"); the word "breakout" is never used — name the arithmetic instead. Calibration — wrong: "The video pulled 2,700 views against a channel median of 970, landing at 2.77x — a solid outperformance, but not a breakout." Right: "The video received 2,700 views, outperforming the channel median of 970 by 1,730 views and securing a 2.77x Outlier Score for a solid outlier performance."

A take's name (script · voice · variant) is a label for tables; prose reads like a person wrote it. Say "the three takes read by Danielle" or "Danielle's reads," never "the Danielle takes"; say "the short cut of No Need to Listen read by Stephen," never a raw label as a noun phrase. Ruth, Stephen, Danielle and Matthew are the studio's synthetic voices (Amazon Polly); Sarah, Matilda, Eric and Brian are ElevenLabs voices — say so when the voice is the subject. Each take's page is its path in the record, e.g. [No Need to Listen · Stephen](/v/<id>); link a take when you name it in a finding.

Never refer to yourself in the first person and never name the model behind the answers.

A video script you draft goes alone in a \`\`\`pax-script code block (that tag, nothing else inside); the page shows it as a script card. Real code goes in an ordinary code block tagged with its language.

An ACTIVE CONTEXT section below is the user's attachment, read from PAX2's own pages moments ago: it is evidence as good as the record. Answer from it, quote its numbers, and never say a short or block is missing from the record when the attachment describes it; the record covers only the campaign's scored takes.

When the context lists blocks from an attached page, you may show one in the answer by writing its reference alone on its own line, exactly as listed: [[block:/v/yt-ID#anchor]]. The chat renders the block there. Show a block when it carries the evidence you cite; never invent a reference that is not listed.`

async function record(): Promise<string> {
  try {
    const { takes } = await board(await workspace())
    const lines = takes.map(({ take, latest }) => {
      const s = latest?.score
      const name = `${scriptById(take.scriptId)?.short ?? take.scriptId} · ${takeLabel(take)}`
      if (!s || s.value == null) return `- ${name} (/v/${take.id}): not scored`
      const parts = s.components.map((c) => `${COMPONENTS.find((x) => x.key === c.key)?.name ?? c.key} ${c.score?.toFixed(0) ?? "—"}`).join(", ")
      const reach = latest!.snapshot.metrics.reach.value
      return `- ${name} (/v/${take.id}): Resonance ${s.value.toFixed(0)} (range ${s.low?.toFixed(0)}–${s.high?.toFixed(0)}); ${parts}; reach ${reach?.toLocaleString() ?? "—"}`
    })
    const scripts = SCRIPTS.map((s) => `- ${s.title} (${s.short}): ${s.framing}`)
    return `\n\n=== THE RECORD — USE THESE EXACT NUMBERS ===\nTakes:\n${lines.join("\n")}\n\nScripts:\n${scripts.join("\n")}\n=== END RECORD ===`
  } catch {
    return ""
  }
}

type Race = { election: string; candidates: { name: string; party: string; votes: number; won: boolean }[]; contested: boolean }
type Place = { district: string | null; state?: string; chamber?: string; members?: { name: string; party: string }[]; race?: Race | null; previous?: Race | null; note?: string; question3?: { yes: number; no: number; undecided: number; pollster: string } }

// After solar's property block: the address, and what /api/district found for it.
function addressContext(address?: string, place?: Place | null): string {
  if (!address) return ""
  const lines = [`\n\nThe user is asking about a specific address: ${address}`]
  if (place?.district) {
    lines.push(`- ${place.chamber}: ${place.district}`)
    if (place.members?.length) lines.push(`- Holds the seat now: ${place.members.map((m) => `${m.name} (${m.party})`).join(" and ")}`)
    for (const [label, r] of [["Last election", place.race], ["The one before", place.previous]] as const) {
      if (!r) continue
      lines.push(`- ${label}, ${r.election}: ${r.contested ? "contested" : "uncontested — one name on the ballot"}`)
      for (const c of r.candidates) lines.push(`  - ${c.name} (${c.party}): ${c.votes.toLocaleString()} votes${c.won ? ", won" : ""}`)
    }
    if (place.question3) lines.push(`- Question 3 statewide (${place.question3.pollster}): Yes ${place.question3.yes}%, No ${place.question3.no}%, undecided ${place.question3.undecided}%`)
    lines.push("Answer who represents this address and whether they faced an opponent, from these records only. Then say which scripts fit a voter here.")
  } else if (place?.note) {
    lines.push(`- ${place.note}`)
  } else {
    lines.push("- The district lookup returned nothing; say so.")
  }
  return lines.join("\n")
}

export async function POST(req: Request) {
  // Signed out, the chat answers a handful of questions, then asks for an account.
  try {
    await anonSpend("chat")
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, gate: true }), { status: 402, headers: { "Content-Type": "application/json" } })
  }
  const { messages, address, place, systemContext, model, record: recordMode } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; address?: string; place?: Place | null; systemContext?: string; model?: string; record?: boolean }
  // The picker's choice when it is one of the models this account answers on (lib/model-options); else the default.
  const modelId = model && MODEL_IDS.has(model) ? model : MODEL
  // Extra context from the caller (the graph canvas: what is on it, an attached entity, a prompt step's wiring; a library report, every page), after the record.
  const extra = typeof systemContext === "string" && systemContext.trim() ? `\n\n${systemContext.slice(0, 80_000)}` : ""
  const r = await client.send(
    new ConverseStreamCommand({
      modelId,
      system: [{ text: BASE_SYSTEM_PROMPT + (await record()) + `\n\n${metricsGuide()}` + extra + addressContext(address, place) + (recordMode ? `\n\n${evidencePrompt()}` : "") }],
      messages: messages.filter((m) => m.content.trim()).map((m): Message => ({ role: m.role, content: [{ text: m.content }] })),
      inferenceConfig: { maxTokens: 2000, temperature: 0.3 },
    }),
  )
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of r.stream ?? []) {
          const text = ev.contentBlockDelta?.delta?.text
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } })
}
