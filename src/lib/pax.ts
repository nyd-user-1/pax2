import "server-only"

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"

import referenceModel from "../../data/generated/model/reference-model.json"
import { featuresFor, METRIC_LABEL, scriptById, takeLabel, type TakeInfo } from "@/lib/catalog"
import { COMPONENTS, type Reference, type Score } from "@/lib/resonance"
import type { TakeState } from "@/lib/review"
import type { Snapshot } from "@/lib/types"

// PAX: turns a score into a reading a partner can act on. The model sees only the records
// below, must cite one for every claim, and anything it cites that does not exist is removed.

const MODEL = process.env.PAX_MODEL ?? "us.anthropic.claude-sonnet-4-6"
const client = new BedrockRuntimeClient({ region: process.env.PAX_REGION ?? "us-east-1" })

export type Cited = { kind: "observed" | "interpretation" | "hypothesis"; text: string; evidence: string[] }
export type Proposal = { change: string; prompted: string; uncertain: string; measure: string; evidence: string[] }
export type PriorCheck = { finding: string; status: "supported" | "challenged" | "unresolved"; why: string; evidence: string[] }
export type Reading = {
  takeaway: string
  whatHappened: string
  scoreMeaning: string
  findings: Cited[]
  nextSteps: Proposal[]
  insufficient: string[]
  priorChecks: PriorCheck[]
  dropped: number
}

type Ev = { ref: string; label: string; t?: number }

/** Everything PAX may cite, keyed by a short reference. */
export function evidenceIndex(take: TakeInfo, state: TakeState, ref: Reference | null, peers: TakeState[]): Ev[] {
  const out: Ev[] = []
  const latest = state.latest
  if (latest) {
    for (const [m, v] of Object.entries(latest.snapshot.metrics)) if (v.value != null) out.push({ ref: `metric:${m}`, label: `${METRIC_LABEL[m as keyof typeof METRIC_LABEL]}: ${v.value.toLocaleString()} (${v.source})` })
    for (const c of latest.score.components) if (c.score != null) out.push({ ref: `component:${c.key}`, label: `${COMPONENTS.find((x) => x.key === c.key)!.name} ${c.score.toFixed(0)} (rate ${(c.rate! * 100).toFixed(2)}%)` })
  }
  take.lines?.forEach((l, i) => out.push({ ref: `line:${i}`, label: `Script line at ${l.t.toFixed(1)}s: “${l.text}”`, t: l.t }))
  const f = featuresFor(take.id)
  ;(Array.isArray(f?.pegasus?.result?.observations) ? f!.pegasus!.result!.observations! : []).forEach((o, i) => out.push({ ref: `seen:${i}`, label: `At ${o.t}s (AI-assessed): ${o.what}`, t: o.t }))
  if (f?.pegasus?.result?.hook) out.push({ ref: "seen:hook", label: `Opening at ${f.pegasus.result.hook.t}s (AI-assessed): ${f.pegasus.result.hook.text} — ${f.pegasus.result.hook.assessment}`, t: f.pegasus.result.hook.t })
  ;(Array.isArray(f?.audio?.pauses) ? f!.audio!.pauses : []).forEach((p, i) => out.push({ ref: `pause:${i}`, label: `Pause of ${p.sec}s at ${p.t}s (measured)`, t: p.t }))
  if (f?.audio?.loudestSec?.length) out.push({ ref: "audio:loudest", label: `Loudest seconds: ${f.audio.loudestSec.join(", ")} (measured)`, t: f.audio.loudestSec[0] })
  if (f?.audio?.quietestSec?.length) out.push({ ref: "audio:quietest", label: `Quietest seconds: ${f.audio.quietestSec.join(", ")} (measured)`, t: f.audio.quietestSec[0] })
  if (f?.transcript?.wpm) out.push({ ref: "pace", label: `Speaking pace ${f.transcript.wpm} words per minute (measured)` })
  if (f?.onScreenText) out.push({ ref: "text-on-screen", label: `On-screen text in ${f.onScreenText.secondsWithText} of ${Math.round(take.durationSec)} seconds (AI-detected)` })
  for (const p of peers) {
    if (p.take.id === take.id || !p.latest || p.latest.score.value == null) continue
    out.push({ ref: `take:${p.take.id}`, label: `${scriptById(p.take.scriptId)!.title} — ${takeLabel(p.take)}: Resonance ${p.latest.score.value.toFixed(0)} (${p.latest.score.low!.toFixed(0)}–${p.latest.score.high!.toFixed(0)})` })
  }
  const rm = referenceModel as unknown as { outcomes: Record<string, { features: { key: string; label: string; diff: number; low: number; high: number }[] }> }
  for (const ft of rm.outcomes.votechoice?.features ?? []) out.push({ ref: `research:${ft.key}`, label: `Swayable archive, vote choice: ads coded “${ft.label}” moved ${ft.diff >= 0 ? "+" : ""}${ft.diff.toFixed(2)} pts vs. those without (95% CI ${ft.low.toFixed(2)} to ${ft.high.toFixed(2)})` })
  if (ref) out.push({ ref: "reference", label: `Reference scale ref-1, built from ${ref.n} flights in ${ref.dataset} and frozen` })
  return out
}

const SYSTEM = `You are PAX, the analyst inside a partner portal for short advocacy videos. Write for a volunteer coordinator, not a statistician.
Rules:
- Use only the records provided. Every claim cites one or more evidence refs exactly as given (e.g. "metric:plays3s", "line:2", "seen:hook").
- Keep three kinds apart: "observed" = what the records show; "interpretation" = a reading of why, clearly marked as a reading; "hypothesis" = something worth testing.
- The score measures paid attention and engagement against a frozen reference. It does not measure persuasion or belief change. Say so if the partner might read it that way.
- Explain the math separately from any claim about why viewers behaved as they did.
- When evidence is thin (limited or unscorable), name the next useful measurement instead of explaining.
- Proposed next steps are testable changes to execution: format, captions, runtime, opening, messenger, framing. For each: what changes, what evidence prompted it, what remains uncertain, what measurement would evaluate it.
- Content observations marked AI-assessed come from a model watching the video; say "the video review notes" rather than stating them as fact.
- The takes are synthetic readings by stand-in voices until the partner's own videos arrive; do not comment on voice quality as if a person recorded it.
- Plain words. No jargon like "posterior" or "logit". Numbers rounded.`

const TOOL = {
  name: "reading",
  description: "Return the reading.",
  inputSchema: {
    json: {
      type: "object",
      required: ["takeaway", "whatHappened", "scoreMeaning", "findings", "nextSteps", "insufficient", "priorChecks"],
      properties: {
        takeaway: { type: "string", description: "One or two sentences, the first thing the partner reads." },
        whatHappened: { type: "string" },
        scoreMeaning: { type: "string", description: "What the number means and does not mean, with the components that drove it." },
        findings: { type: "array", items: { type: "object", required: ["kind", "text", "evidence"], properties: { kind: { enum: ["observed", "interpretation", "hypothesis"] }, text: { type: "string" }, evidence: { type: "array", items: { type: "string" } } } } },
        nextSteps: { type: "array", maxItems: 3, items: { type: "object", required: ["change", "prompted", "uncertain", "measure", "evidence"], properties: { change: { type: "string" }, prompted: { type: "string" }, uncertain: { type: "string" }, measure: { type: "string" }, evidence: { type: "array", items: { type: "string" } } } } },
        insufficient: { type: "array", items: { type: "string" }, description: "Measurements that would settle open questions." },
        priorChecks: { type: "array", items: { type: "object", required: ["finding", "status", "why", "evidence"], properties: { finding: { type: "string" }, status: { enum: ["supported", "challenged", "unresolved"] }, why: { type: "string" }, evidence: { type: "array", items: { type: "string" } } } } },
      },
    },
  },
}

export async function read(take: TakeInfo, state: TakeState, ref: Reference | null, peers: TakeState[], prior: { finding: string; decided?: string }[]): Promise<{ reading: Reading; evidence: Ev[]; model: string }> {
  const evidence = evidenceIndex(take, state, ref, peers)
  const script = scriptById(take.scriptId)!
  const s: Score | undefined = state.latest?.score
  const snap: Snapshot | undefined = state.latest?.snapshot
  const f = featuresFor(take.id)
  const context = {
    take: { id: take.id, script: script.title, framing: script.framing, messenger: take.voice, captions: take.captions, shortCut: take.cut, seconds: take.durationSec },
    reportingWindow: snap ? `${snap.windowStart} to ${snap.windowEnd}, reported ${snap.asOf} (${snap.dataset})` : "no results loaded",
    score: s ? { status: s.status, value: s.value && Math.round(s.value), range: s.low != null ? [Math.round(s.low), Math.round(s.high!)] : null, reasons: s.reasons, components: s.components.map((c) => ({ name: c.key, score: c.score && Math.round(c.score), rate: c.rate, weight: c.weight })), deliveryConditions: s.conditions } : null,
    history: state.history.map((h) => ({ asOf: h.snapshot.asOf, value: h.score.value && Math.round(h.score.value), range: h.score.low != null ? [Math.round(h.score.low), Math.round(h.score.high!)] : null })),
    videoReview: f?.pegasus?.result ? { summary: f.pegasus.result.summary, characteristics: f.pegasus.result.characteristics, accessibility: f.pegasus.result.accessibility } : "not analyzed yet",
    earlierFindings: prior,
    evidence: evidence.map((e) => `${e.ref} — ${e.label}`),
  }
  const r = await client.send(
    new ConverseCommand({
      modelId: MODEL,
      system: [{ text: SYSTEM }],
      messages: [{ role: "user", content: [{ text: `Read this take for the partner.\n\n${JSON.stringify(context, null, 1)}` }] }],
      toolConfig: { tools: [{ toolSpec: TOOL as never }], toolChoice: { tool: { name: "reading" } } },
      inferenceConfig: { maxTokens: 2500, temperature: 0.2 },
    }),
  )
  const block = r.output?.message?.content?.find((c) => "toolUse" in c && c.toolUse)
  const input = (block && "toolUse" in block ? block.toolUse?.input : null) as Record<string, unknown> | null
  if (!input) throw new Error("PAX returned no reading")
  // Nested arrays sometimes arrive as JSON text; accept either.
  const arr = <T,>(x: unknown): T[] => {
    if (Array.isArray(x)) return x as T[]
    if (typeof x === "string") {
      try {
        const p = JSON.parse(x)
        return Array.isArray(p) ? (p as T[]) : []
      } catch {
        return x.trim() ? ([x] as T[]) : []
      }
    }
    return []
  }
  const withEv = <T extends { evidence?: unknown }>(xs: T[]) => xs.map((x) => ({ ...x, evidence: arr<string>(x.evidence) }))
  const raw = {
    takeaway: String(input.takeaway ?? ""),
    whatHappened: String(input.whatHappened ?? ""),
    scoreMeaning: String(input.scoreMeaning ?? ""),
    findings: withEv(arr<Cited>(input.findings)),
    nextSteps: withEv(arr<Proposal>(input.nextSteps)),
    insufficient: arr<string>(input.insufficient),
    priorChecks: withEv(arr<PriorCheck>(input.priorChecks)),
  }
  // Remove any citation that does not exist; a finding left with none is dropped.
  const known = new Set(evidence.map((e) => e.ref))
  let dropped = 0
  const clean = <T extends { evidence: string[] }>(xs: T[]) =>
    xs
      .map((x) => ({ ...x, evidence: (x.evidence ?? []).filter((e) => known.has(e)) }))
      .filter((x) => {
        const keep = x.evidence.length > 0
        if (!keep) dropped++
        return keep
      })
  const reading: Reading = {
    takeaway: raw.takeaway,
    whatHappened: raw.whatHappened,
    scoreMeaning: raw.scoreMeaning,
    findings: clean(raw.findings ?? []),
    nextSteps: clean(raw.nextSteps ?? []),
    insufficient: raw.insufficient ?? [],
    priorChecks: (raw.priorChecks ?? []).map((p) => ({ ...p, evidence: (p.evidence ?? []).filter((e) => known.has(e)) })),
    dropped,
  }
  return { reading, evidence, model: MODEL }
}
