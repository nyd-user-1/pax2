"use server"

import { createHash } from "node:crypto"

import { generateHiggsfield, generationStatus, startGeneration, type GenStatus } from "@/app/video-gen-actions"
import { anonSpend } from "@/lib/anon"
import { currentUser } from "@/lib/auth"
import type { FootagePlan, Graphics, Shot } from "@/lib/footage"
import { fallbackChain, type VideoProvider } from "@/lib/video-model-options"

// A script's footage plan and its banked shots, in S3 under studio/footage/v2/<key>/: plan.json (written
// by one model call the first time anyone opens that script, then edited in place by signed-in users)
// and shot-<id>.json (one per finished clip). The key is the script text's hash, so the same script
// reaches the same plan and clips. v2 holds the comprehension checklist and the lower third.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const MODEL = process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"

export type BankedShot = { url: string; provider: VideoProvider; at: string }

const at = (key: string, file: string) => `studio/footage/v2/${key}/${file}`
const keyOf = (script: string) => createHash("sha256").update(script.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 20)
const checkKey = (key: string) => {
  if (!/^[a-f0-9]{20}$/.test(key)) throw new Error("Unknown script.")
}

async function s3() {
  const m = await import("@aws-sdk/client-s3")
  return { m, c: new m.S3Client({ region: REGION }) }
}

async function getJson<T>(Key: string): Promise<T | null> {
  const { m, c } = await s3()
  try {
    const r = await c.send(new m.GetObjectCommand({ Bucket: BUCKET, Key }))
    return JSON.parse(await r.Body!.transformToString()) as T
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null
    throw e
  }
}

async function putJson(Key: string, value: unknown) {
  const { m, c } = await s3()
  await c.send(new m.PutObjectCommand({ Bucket: BUCKET, Key, Body: JSON.stringify(value), ContentType: "application/json" }))
}

const prompt = (script: string) => `You plan the footage for a vertical political short about election reform. Read the script and reply with JSON only.

SCRIPT:
${script}

"shots": first one opening shot (5 seconds) showing the problem the script's first sentence names; then one b-roll shot per remaining sentence, at most 6, each 4 or 5 seconds, in script order. Each shot: {"kind": "opening" | "broll", "line": the sentence it sits behind (omit for the opening), "prompt": a text-to-video prompt, "seconds": 4 or 5}. Every prompt: vertical 9:16, photoreal, natural light, no text or captions on screen, no logos, no recognizable faces, no politicians or candidates real or invented — places, objects, documents, hands, crowds from behind, buildings, landscapes.

"graphics", every string taken from the script's own words where it can be, uppercase only where marked:
- "checklist": the card that explains what the measure does, for a viewer to understand it: {"title": the measure's name as the script says it, UPPERCASE, 1-3 words (for example "QUESTION 3"), "items": exactly 3, each 2-4 words in Title Case, saying what the measure changes (for example "One Primary Ballot", "For Every Voter", "With Every Candidate"), "footer": at most 7 words stating how the result is decided (for example "Top two advance to November.")}
- "callout": {"text": a phrase of 2-5 words from the script, UPPERCASE, "highlight": the one word of it to color}
- "stat": {"value": a number that appears in the script, "label": at most 6 words saying what it counts} — if the script has no number, both ""
- "quote": {"text": the strongest sentence verbatim, at most 16 words, "by": ""}
- "intro": {"title": at most 5 words, "sub": at most 8 words}
- "end": {"ask": the script's ask, at most 8 words, "handle": ""}
- "lowerThird": {"name": "", "role": ""}

Reply: {"shots": [...], "graphics": {...}}`

/** The script's plan: read from S3, or written once by the model and kept for everyone after. */
export async function footagePlan(script: string): Promise<FootagePlan> {
  const text = script.trim()
  if (!text) throw new Error("No script.")
  const key = keyOf(text)
  const kept = await getJson<FootagePlan>(at(key, "plan.json"))
  if (kept) return kept
  await anonSpend("write")
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime")
  const r = await new BedrockRuntimeClient({ region: REGION }).send(new ConverseCommand({ modelId: MODEL, messages: [{ role: "user", content: [{ text: prompt(text) }] }], inferenceConfig: { maxTokens: 3000 } }))
  const raw = r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? ""
  const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { shots: Omit<Shot, "id">[]; graphics: Graphics }
  let b = 0
  const shots: Shot[] = (j.shots ?? []).slice(0, 7).map((s) => ({
    id: s.kind === "opening" ? "opening" : `broll-${++b}`,
    kind: s.kind === "opening" ? "opening" : "broll",
    ...(s.line ? { line: s.line } : {}),
    prompt: s.prompt,
    seconds: s.seconds <= 4 ? 4 : 5,
  }))
  const plan: FootagePlan = { key, shots, graphics: { ...j.graphics, lowerThird: j.graphics?.lowerThird ?? { name: "", role: "" } } }
  await putJson(at(key, "plan.json"), plan)
  return plan
}

/** Every clip already made for this script, by shot id. */
export async function bankedShots(key: string): Promise<Record<string, BankedShot>> {
  checkKey(key)
  const { m, c } = await s3()
  const r = await c.send(new m.ListObjectsV2Command({ Bucket: BUCKET, Prefix: at(key, "shot-") }))
  const out: Record<string, BankedShot> = {}
  for (const o of r.Contents ?? []) {
    const id = o.Key!.slice(o.Key!.lastIndexOf("/shot-") + 6, -5)
    const s = await getJson<BankedShot>(o.Key!)
    if (s) out[id] = s
  }
  return out
}

/** The clips banked for a script, with the line each sits behind; no plan is written by asking. */
export async function bankedForScript(script: string): Promise<{ id: string; url: string; line?: string; seconds: number }[]> {
  const key = keyOf(script.trim())
  const plan = await getJson<FootagePlan>(at(key, "plan.json"))
  if (!plan) return []
  const banked = await bankedShots(key)
  return plan.shots.filter((s) => banked[s.id]).map((s) => ({ id: s.id, url: banked[s.id].url, ...(s.line ? { line: s.line } : {}), seconds: s.seconds }))
}

const bank = (key: string, shotId: string, url: string, provider: VideoProvider) => putJson(at(key, `shot-${shotId}.json`), { url, provider, at: new Date().toISOString() } satisfies BankedShot)

/** Start one shot: a banked clip comes straight back; otherwise the chosen model first, then the others
 *  down the fallback list, skipping any that already failed this shot. Higgsfield answers in one call. */
export async function startShot(key: string, shotId: string, first: VideoProvider, skip: VideoProvider[] = []): Promise<{ provider: VideoProvider; task?: string; url?: string }> {
  checkKey(key)
  const kept = await getJson<BankedShot>(at(key, `shot-${shotId}.json`))
  if (kept) return { provider: kept.provider, url: kept.url }
  const plan = await getJson<FootagePlan>(at(key, "plan.json"))
  const shot = plan?.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error("Unknown shot.")
  const input = { prompt: shot.prompt, seconds: shot.seconds, aspect: "9:16" as const }
  const errors: string[] = []
  for (const p of fallbackChain(first).filter((p) => !skip.includes(p))) {
    try {
      if (p === "higgsfield") {
        const { url } = await generateHiggsfield(input)
        await bank(key, shotId, url, p)
        return { provider: p, url }
      }
      const { task } = await startGeneration(p, input)
      return { provider: p, task }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  throw new Error(errors.join(" · ") || "No video model is available.")
}

/** One poll; a finished clip is banked for everyone before it comes back. */
export async function shotStatus(key: string, shotId: string, provider: Exclude<VideoProvider, "higgsfield">, task: string): Promise<GenStatus> {
  checkKey(key)
  const s = await generationStatus(provider, task)
  if (s.status === "done" && s.url) await bank(key, shotId, s.url, provider)
  return s
}

/** A signed-in edit to the shared plan: one shot's prompt (before it is generated), or one graphic's
 *  words. Everyone who opens the script afterward reads the edited plan. */
export async function updatePlan(key: string, edit: { shotId: string; prompt: string } | { kind: keyof Graphics; fields: Graphics[keyof Graphics] }): Promise<FootagePlan> {
  checkKey(key)
  if (!(await currentUser())) throw new Error("Sign in to save edits.")
  const plan = await getJson<FootagePlan>(at(key, "plan.json"))
  if (!plan) throw new Error("Unknown script.")
  if ("shotId" in edit) {
    const s = plan.shots.find((x) => x.id === edit.shotId)
    if (!s) throw new Error("Unknown shot.")
    s.prompt = edit.prompt.trim().slice(0, 1500)
  } else {
    if (!(edit.kind in plan.graphics) && edit.kind !== "lowerThird") throw new Error("Unknown graphic.")
    ;(plan.graphics as Record<string, unknown>)[edit.kind] = edit.fields
  }
  await putJson(at(key, "plan.json"), plan)
  return plan
}
