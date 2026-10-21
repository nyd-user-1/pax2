"use server"

import { createHash } from "node:crypto"

import { anonSpend } from "@/lib/anon"

// Generated b-roll for the chat's enhance flow, three providers behind one pair of calls: start a
// task, poll it (Higgsfield's SDK polls itself, so it is one blocking call). A finished clip is
// copied into S3 under studio/clip/ and served from /api/studio/clip, because the browser's
// renderer reads the bytes and the provider URLs are hotlink-protected with no CORS headers
// (Kling also clears results after 30 days).
//   Kling:      POST https://api-singapore.klingai.com/text-to-video/kling-3.0-turbo, then GET
//               /tasks?task_ids= (kling.ai/document-api; Authorization: Bearer KLING_API_KEY).
//   ElevenLabs: POST https://api.elevenlabs.io/v1/flows/video with model bytedance-seedance-v2,
//               then GET /v1/flows/video/<id> (xi-api-key; needs a Pro plan with the Image & Video
//               permission, and ByteDance models enabled for the workspace).
//   Higgsfield: the official SDK's subscribe on bytedance/seedance-2.5/text-to-video
//               (docs.higgsfield.ai; HIGGSFIELD_API_KEY is key-id:key-secret).
//   Veo:        POST models/<id>:predictLongRunning on generativelanguage.googleapis.com, then GET
//               the operation; the finished URI downloads with the same x-goog-api-key header
//               (ai.google.dev/gemini-api/docs/veo; VEO_API_KEY is a Gemini API key). The preview
//               model id below is deprecated for shutdown 2026-10-22 — Google's pointer is Gemini
//               Omni Flash — so a dead id surfaces here as the job row's error, and VEO_MODEL is
//               the one constant to move.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const KLING = "https://api-singapore.klingai.com"
const ELEVEN = "https://api.elevenlabs.io"
const GOOGLE = "https://generativelanguage.googleapis.com"
const VEO_MODEL = "veo-3.1-generate-preview"

export type GenProvider = "kling" | "elevenlabs" | "higgsfield" | "veo"
export type GenInput = { prompt: string; seconds: number; aspect: "9:16" | "16:9" }
export type GenStatus = { status: "working" | "done" | "failed"; url?: string; message?: string }

/** The finished clip, copied to S3 and handed back as an own-origin URL. */
async function keep(remote: string, headers?: Record<string, string>): Promise<string> {
  const r = await fetch(remote, headers ? { headers } : undefined)
  if (!r.ok) throw new Error(`Could not fetch the finished clip (${r.status}).`)
  const bytes = Buffer.from(await r.arrayBuffer())
  const key = `studio/clip/${createHash("sha1").update(remote).digest("hex").slice(0, 20)}.mp4`
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  await new S3Client({ region: REGION }).send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: "video/mp4" }))
  return `/api/studio/clip?key=${encodeURIComponent(key)}`
}

const need = (name: string, v: string | undefined): string => {
  if (!v) throw new Error(`${name} is not set on the server.`)
  return v
}

/** Start a Kling or ElevenLabs task; the caller polls generationStatus. */
export async function startGeneration(provider: Exclude<GenProvider, "higgsfield">, input: GenInput): Promise<{ task: string }> {
  await anonSpend("generate")
  if (provider === "kling") {
    const r = await fetch(`${KLING}/text-to-video/kling-3.0-turbo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${need("KLING_API_KEY", process.env.KLING_API_KEY)}` },
      body: JSON.stringify({ prompt: input.prompt.slice(0, 2500), settings: { duration: Math.min(15, Math.max(3, Math.round(input.seconds))), aspect_ratio: input.aspect, resolution: "720p" } }),
    })
    const j = (await r.json().catch(() => null)) as { code?: number; message?: string; data?: { id?: string } } | null
    if (!r.ok || !j?.data?.id) throw new Error(`Kling: ${r.status} ${j?.message ?? ""}`.trim())
    return { task: j.data.id }
  }
  if (provider === "veo") {
    const r = await fetch(`${GOOGLE}/v1beta/models/${VEO_MODEL}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": need("VEO_API_KEY", process.env.VEO_API_KEY) },
      body: JSON.stringify({ instances: [{ prompt: input.prompt }], parameters: { aspectRatio: input.aspect, resolution: "720p", durationSeconds: input.seconds <= 4 ? "4" : input.seconds <= 6 ? "6" : "8" } }),
    })
    const j = (await r.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null
    if (!r.ok || !j?.name) throw new Error(`Veo: ${r.status} ${j?.error?.message ?? ""}`.trim())
    return { task: j.name }
  }
  const r = await fetch(`${ELEVEN}/v1/flows/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": need("ELEVENLABS_API_KEY", process.env.ELEVENLABS_API_KEY) },
    body: JSON.stringify({ model_id: "bytedance-seedance-v2", prompt: input.prompt, duration_secs: Math.min(12, Math.max(3, Math.round(input.seconds))), aspect_ratio: input.aspect, resolution: "720p", generate_audio: false }),
  })
  const j = (await r.json().catch(() => null)) as { id?: string; detail?: { message?: string } | string } | null
  if (!r.ok || !j?.id) throw new Error(`ElevenLabs: ${r.status} ${typeof j?.detail === "string" ? j.detail : j?.detail?.message ?? ""}`.trim())
  return { task: j.id }
}

/** One poll; on success the clip is already copied to S3 and `url` is own-origin. */
export async function generationStatus(provider: Exclude<GenProvider, "higgsfield">, task: string): Promise<GenStatus> {
  if (provider === "kling") {
    const r = await fetch(`${KLING}/tasks?task_ids=${encodeURIComponent(task)}`, { headers: { Authorization: `Bearer ${need("KLING_API_KEY", process.env.KLING_API_KEY)}` } })
    const j = (await r.json().catch(() => null)) as { data?: { status?: string; message?: string; outputs?: { type?: string; url?: string }[] }[] } | null
    const t = j?.data?.[0]
    if (!r.ok || !t) return { status: "failed", message: `Kling: ${r.status}` }
    if (t.status === "failed") return { status: "failed", message: t.message ?? "failed" }
    if (t.status !== "succeeded") return { status: "working" }
    const remote = t.outputs?.find((o) => o.type === "video")?.url ?? t.outputs?.[0]?.url
    if (!remote) return { status: "failed", message: "Kling finished without a video output." }
    return { status: "done", url: await keep(remote) }
  }
  if (provider === "veo") {
    const apiKey = need("VEO_API_KEY", process.env.VEO_API_KEY)
    const r = await fetch(`${GOOGLE}/v1beta/${task}`, { headers: { "x-goog-api-key": apiKey } })
    const j = (await r.json().catch(() => null)) as { done?: boolean; error?: { message?: string }; response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } } } | null
    if (!r.ok || !j) return { status: "failed", message: `Veo: ${r.status}` }
    if (j.error) return { status: "failed", message: j.error.message ?? "failed" }
    if (!j.done) return { status: "working" }
    const remote = j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    if (!remote) return { status: "failed", message: "Veo finished without a video URI." }
    return { status: "done", url: await keep(remote, { "x-goog-api-key": apiKey }) }
  }
  const r = await fetch(`${ELEVEN}/v1/flows/video/${encodeURIComponent(task)}`, { headers: { "xi-api-key": need("ELEVENLABS_API_KEY", process.env.ELEVENLABS_API_KEY) } })
  const j = (await r.json().catch(() => null)) as { status?: string; content_url?: string; failure_reason?: string; error_message?: string } | null
  if (!r.ok || !j) return { status: "failed", message: `ElevenLabs: ${r.status}` }
  if (j.status === "failed") return { status: "failed", message: j.error_message ?? j.failure_reason ?? "failed" }
  if (j.status !== "completed") return { status: "working" }
  if (!j.content_url) return { status: "failed", message: "ElevenLabs finished without a content URL." }
  return { status: "done", url: await keep(j.content_url) }
}

/** Runway Aleph (gen4_aleph), the video-to-video pass: the recorded take itself is the input —
 *  steadying, relighting, reframing — by way of a presigned read of its S3 object, since Runway
 *  fetches the video from a URL. POST /v1/video_to_video, then the shared /v1/tasks poll
 *  (docs.dev.runwayml.com; Authorization: Bearer RUNWAY_API_KEY, X-Runway-Version: 2024-11-06). */
const RUNWAY = "https://api.dev.runwayml.com"
const runwayHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${need("RUNWAY_API_KEY", process.env.RUNWAY_API_KEY)}`, "X-Runway-Version": "2024-11-06" })

export async function startCleanup(key: string, prompt: string): Promise<{ task: string }> {
  await anonSpend("generate")
  if (!/^uploads\//.test(key)) throw new Error("Only an uploaded take can be cleaned up.")
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const videoUri = await getSignedUrl(new S3Client({ region: REGION }), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 })
  const r = await fetch(`${RUNWAY}/v1/video_to_video`, {
    method: "POST",
    headers: runwayHeaders(),
    body: JSON.stringify({ model: "gen4_aleph", videoUri, promptText: prompt, ratio: "720:1280" }),
  })
  const j = (await r.json().catch(() => null)) as { id?: string; error?: string } | null
  if (!r.ok || !j?.id) throw new Error(`Runway: ${r.status} ${j?.error ?? ""}`.trim())
  return { task: j.id }
}

export async function cleanupStatus(task: string): Promise<GenStatus> {
  const r = await fetch(`${RUNWAY}/v1/tasks/${encodeURIComponent(task)}`, { headers: runwayHeaders() })
  const j = (await r.json().catch(() => null)) as { status?: string; output?: string[]; failure?: string; failureCode?: string } | null
  if (!r.ok || !j) return { status: "failed", message: `Runway: ${r.status}` }
  if (j.status === "FAILED" || j.status === "CANCELED") return { status: "failed", message: j.failure ?? j.failureCode ?? j.status }
  if (j.status !== "SUCCEEDED") return { status: "working" }
  if (!j.output?.[0]) return { status: "failed", message: "Runway finished without an output URL." }
  return { status: "done", url: await keep(j.output[0]) }
}

/** Higgsfield in one blocking call: the SDK submits and polls until the clip is done. */
export async function generateHiggsfield(input: GenInput): Promise<{ url: string }> {
  await anonSpend("generate")
  const credentials = need("HIGGSFIELD_API_KEY", process.env.HIGGSFIELD_API_KEY)
  const mod = (await import("@higgsfield/client/v2")) as unknown as {
    config: (o: { credentials: string }) => void
    higgsfield: { subscribe: (model: string, opts: { input: Record<string, unknown>; withPolling: boolean }) => Promise<{ status?: string; video?: { url?: string } | string }> }
  }
  mod.config({ credentials })
  const result = await mod.higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: { prompt: input.prompt, duration: Math.min(30, Math.max(4, Math.round(input.seconds))), resolution: "720p", aspect_ratio: input.aspect, output_format: "mp4", generate_audio: false },
    withPolling: true,
  })
  if (result?.status !== "completed") throw new Error(`Higgsfield: ${result?.status ?? "no response"}.`)
  const remote = typeof result.video === "string" ? result.video : result.video?.url
  if (!remote) throw new Error("Higgsfield completed without a video field.")
  return { url: await keep(remote) }
}
