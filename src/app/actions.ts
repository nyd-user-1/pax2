"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import feed from "../../data/generated/home-feed.json"
import channels from "../../data/velocity/channels.json"
import { takeById } from "@/lib/catalog"
import { recommendations } from "@/lib/forecast"
import { nextWeekdayNine } from "@/lib/post-time"
import { read, type Reading } from "@/lib/pax2"
import { FORMULA_V1 } from "@/lib/resonance"
import { board, DATASETS, findings, loadExport, recordForecast, recordPick, recordStep, recordVote, saveFinding, steps, workspace, type LoadResult } from "@/lib/review"

export async function loadDataset(id: string): Promise<LoadResult> {
  const ws = await workspace()
  const d = DATASETS.find((x) => x.id === id)
  if (!d) throw new Error("Unknown dataset")
  const r = await loadExport(ws, d.id, d.text, d.asOf, d.source)
  revalidatePath("/", "layout")
  return r
}

export async function uploadExport(form: FormData): Promise<LoadResult> {
  const ws = await workspace()
  const file = form.get("file") as File | null
  const asOf = String(form.get("asOf") || new Date().toISOString().slice(0, 10))
  if (!file) throw new Error("No file")
  const r = await loadExport(ws, "upload", await file.text(), asOf, "platform")
  revalidatePath("/", "layout")
  return r
}

export type SavedReading = { at: string; reading: Reading; model: string; snapshotId: string; formula: string; reference: string; scoreValue: number | null }

/** Ask PAX2 for a reading of the latest results, and save it with the score version and evidence it used. */
export async function requestReading(takeId: string): Promise<SavedReading> {
  const ws = await workspace()
  const take = takeById(takeId)
  if (!take) throw new Error("Unknown take")
  const { ref, takes } = await board(ws)
  const state = takes.find((t) => t.take.id === takeId)!
  if (!state.latest || !ref) throw new Error("Load results first")
  const earlier = await findings(ws, takeId)
  const decisions = await steps(ws, takeId)
  const prior = earlier.slice(-1).flatMap((f) =>
    ((f.finding as Reading).findings ?? [])
      .filter((x) => x.kind !== "observed")
      .map((x) => ({ finding: `${x.kind}: ${x.text} (said ${f.at.slice(0, 10)}, score ${f.score.value?.toFixed(0) ?? "—"} on ${f.snapshotId.split("~").pop()})`, decided: decisions.filter((d) => d.findingAt === f.at).map((d) => `${d.status}: ${d.change}`).join("; ") || undefined })),
  )
  const { reading, model, raw } = await read(take, state, ref, takes, prior)
  const at = await saveFinding(ws, takeId, { snapshotId: state.latest.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, score: state.latest.score, finding: reading, model, rawOutput: JSON.stringify(raw).slice(0, 20000) })
  revalidatePath(`/v/${takeId}`)
  return { at, reading, model, snapshotId: state.latest.snapshot.id, formula: FORMULA_V1.version, reference: ref.id, scoreValue: state.latest.score.value }
}

export async function decide(input: { takeId: string; stepId: string; status: "approved" | "revised" | "saved" | "made"; change: string; note?: string; prompted?: string; uncertain?: string; measure?: string; snapshotId: string; reference: string; findingAt: string }) {
  const ws = await workspace()
  await recordStep(ws, input.takeId, { stepId: input.stepId, status: input.status, change: input.change, note: input.note, prompted: input.prompted, uncertain: input.uncertain, measure: input.measure, snapshotId: input.snapshotId, formula: FORMULA_V1.version, reference: input.reference, findingAt: input.findingAt })
  revalidatePath(`/v/${input.takeId}`)
  revalidatePath("/evals")
}

export async function callIt(input: { takeId: string; by: string; target: string; predicted: "higher" | "lower" | "same"; component: string; reason: string; baseline: number | null; baselineSnapshot: string }) {
  const ws = await workspace()
  const r = await recordForecast(ws, input.takeId, input)
  revalidatePath(`/v/${input.takeId}`)
  revalidatePath("/evals")
  return r
}

export async function pickScript(scriptId: string, reason: string) {
  const ws = await workspace()
  await recordPick(ws, scriptId, reason, "partner")
  revalidatePath("/scripts")
}

export async function castVote(conversation: string, voter: string, tid: number, vote: 1 | -1 | 0) {
  const ws = await workspace()
  await recordVote(ws, conversation, voter, tid, vote)
  revalidatePath("/scripts")
}

/** Start a fresh review: a new workspace, the old one left intact. */
export async function freshReview() {
  const id = `ws-${Date.now().toString(36)}`
  ;(await cookies()).set("pax2-ws", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 60, path: "/" })
  revalidatePath("/", "layout")
  return id
}

// What travels on the reform channels, for PAX2GPT's prompt: the ten reform-core shorts with the
// highest iWAR (views over the channel's median) in the home feed.
const REFORM_CORE = new Set((channels as { id: string; group: string }[]).filter((c) => c.group === "reform-core").map((c) => c.id))
const TRAVELLED = (feed as { title: string; channel: string; channelId: string; ratio: number }[])
  .filter((v) => REFORM_CORE.has(v.channelId))
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 10)

/** The top three distribution changes for a video of this script's length posted at the default
 *  time, as constraints for the writer. */
function travelConstraints(title: string, text: string) {
  const seconds = Math.round((text.split(/\s+/).filter(Boolean).length / 130) * 60)
  const { changes } = recommendations({ title, description: text, tags: [], durationSec: seconds, published: nextWeekdayNine(), group: "reform-core", channelMedian: null })
  return changes.slice(0, 3).map((c) => `${c.action![0].toLowerCase()}${c.action!.slice(1)} (${c.points > 0 ? "+" : ""}${c.points} points of breakout rate on ${c.scope})`)
}

/** PAX2GPT writes a volunteer's script from their own answers, on the framing that is scoring best
 *  so far, told what travels on the reform channels. */
export async function writeScript(input: { name: string; role: string; town: string; why: string; moment: string }) {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime")
  const { SCRIPTS } = await import("@/lib/catalog")
  const ws = await workspace()
  const { takes } = await board(ws)
  const mean = (id: string) => {
    const xs = takes.filter((t) => t.take.scriptId === id && t.latest?.score.value != null).map((t) => t.latest!.score.value!)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const ranked = SCRIPTS.map((s) => ({ s, m: mean(s.id) })).sort((a, b) => (b.m ?? -1) - (a.m ?? -1))
  const base = ranked[0].m != null ? ranked[0] : { s: SCRIPTS.find((s) => s.id === "calm")!, m: null }
  const client = new BedrockRuntimeClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
  const prompt = `Write a script a volunteer will read to a phone camera, 80 to 110 words, in the first person, in plain spoken English that sounds like this person, not like a campaign.
Build it on this argument (keep its core claim and framing): "${base.s.title}" — ${base.s.framing}
Reference text of that argument:
${base.s.text}

Observed patterns on the reform channels, not rules: weigh them, don't obey them blindly.
The titles of the ten reform-channel shorts with the highest iWAR (views against their channel's median):
${TRAVELLED.map((v) => `- "${v.title}" (${v.channel}, ${v.ratio.toFixed(1)}x)`).join("\n")}
What measurably travels further for a video like this one:
${travelConstraints(base.s.title, base.s.text).map((c) => `- ${c}`).join("\n") || "- (nothing measured clears zero)"}

About the volunteer, in their words:
- Name: ${input.name || "(not given)"}
- Who they are: ${input.role || "(not given)"}${input.town ? `, ${input.town}` : ""}
- Why this matters to them: ${input.why}
- A moment they felt they had no real choice: ${input.moment || "(not given)"}

Rules: open with one short line that would make someone stop scrolling; use one of their own details; keep any number only if it appears in the reference text; end with "Vote yes on Question 3." Return only the script, line breaks between sentences groups, no title.`
  const r = await client.send(new ConverseCommand({ modelId: process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6", messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 500, temperature: 0.6 } }))
  const text = r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("").trim() ?? ""
  return { text, basedOn: base.s.id, basedOnTitle: base.s.title, why: base.m != null ? `the framing scoring best so far (average Resonance ${base.m.toFixed(0)})` : "the framing with the strongest research prior, until paid results arrive" }
}

/** A short-lived upload link for one recording, straight to S3 (the app server never holds the video). */
export async function uploadUrl(contentType: string) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const ws = await workspace()
  const ext = contentType.includes("mp4") ? "mp4" : contentType.includes("quicktime") ? "mov" : "webm"
  const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const key = `uploads/${ws}/${id}.${ext}`
  const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: process.env.PAX2_BUCKET ?? "pax-2-638175140432", Key: key, ContentType: contentType }), { expiresIn: 900 })
  return { id, key, url }
}

/** Record a sent video with its script and the messenger's own description; PAX2 reviews it next. */
export async function submitTake(input: { id: string; key: string; scriptId?: string; title?: string; text?: string; name?: string; role?: string; town?: string; seconds: number; consent: boolean }) {
  const ws = await workspace()
  const { putOnce, now } = await import("@/lib/ledger")
  await putOnce({ pk: `${ws}#SUBMIT`, sk: input.id, at: now(), status: "awaiting review", ...input })
  revalidatePath("/evals")
  return { ok: true }
}
