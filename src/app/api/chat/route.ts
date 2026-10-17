import { BedrockRuntimeClient, ConverseStreamCommand, type Message } from "@aws-sdk/client-bedrock-runtime"

import { COMPONENTS } from "@/lib/resonance"
import { SCRIPTS, scriptById, takeLabel } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

// The /chat answer, after solar's /api/chat: a system prompt carrying the record (here, every take's
// current score and its parts, and the scripts), then the reply streamed back as plain text.

const client = new BedrockRuntimeClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
const MODEL = process.env.PAX2_CHAT_MODEL ?? process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"

const BASE_SYSTEM_PROMPT = `You are the analyst inside PAX2, a tool that scores advocacy videos for the Question 3 campaign (Massachusetts' top-two primary initiative).

Resonance is a 0-100 score: 50 is the reference average of the first round of paid results. It is built from Engage (3-second plays over impressions, 25%), Interest (average watch time over length, 40%) and Act (shares, saves and comments over 3-second plays, 35%). Each score carries a range; a take whose range spans 50 cannot yet be told apart from average.

When the record below has a number, use that exact number. When it does not, say so plainly rather than estimating. Delivery (spend, reach) is a condition beside the score, never part of it. Speak like a sharp campaign analyst: lead with the numbers, compare takes, and say what the evidence does and does not support.

Never refer to yourself in the first person and never name the model behind the answers.`

async function record(): Promise<string> {
  try {
    const { takes } = await board(await workspace())
    const lines = takes.map(({ take, latest }) => {
      const s = latest?.score
      const name = `${scriptById(take.scriptId)?.short ?? take.scriptId} · ${takeLabel(take)}`
      if (!s || s.value == null) return `- ${name}: not scored`
      const parts = s.components.map((c) => `${COMPONENTS.find((x) => x.key === c.key)?.name ?? c.key} ${c.score?.toFixed(0) ?? "—"}`).join(", ")
      const reach = latest!.snapshot.metrics.reach.value
      return `- ${name}: Resonance ${s.value.toFixed(0)} (range ${s.low?.toFixed(0)}–${s.high?.toFixed(0)}); ${parts}; reach ${reach?.toLocaleString() ?? "—"}`
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
  const { messages, address, place, systemContext } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; address?: string; place?: Place | null; systemContext?: string }
  // Extra context from the caller (the graph canvas: what is on it, an attached entity, a prompt step's wiring), after the record.
  const extra = typeof systemContext === "string" && systemContext.trim() ? `\n\n${systemContext.slice(0, 40_000)}` : ""
  const r = await client.send(
    new ConverseStreamCommand({
      modelId: MODEL,
      system: [{ text: BASE_SYSTEM_PROMPT + (await record()) + extra + addressContext(address, place) }],
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
