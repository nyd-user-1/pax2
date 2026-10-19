"use server"

import { createHash } from "node:crypto"

import { linesOf, VOICES, type MusicId, type VoiceId, type WordMark } from "@/lib/studio-style"

// The Studio's audio, made on the server and served back through /api/studio/audio so the browser's
// renderer reads it from the app's own origin (the bucket has no CORS). Narration is Amazon Polly's
// generative engine: one mp3 and the word timings (speech marks) the composition paces its lines by,
// kept under studio/voice/<hash of voice and text> so the same script is never synthesized twice.
// The neural engine, because it returns word marks and the generative engine does not (checked
// 2026-10-18), and the lines must light up with the voice. Cost: a 20-second script is about 300
// characters, under half a cent at the neural rate.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

export type Narration = { url: string; marks: WordMark[]; seconds: number; voice: VoiceId; key: string }

export async function narrate(text: string, voice: VoiceId): Promise<Narration> {
  if (voice === "none" || !VOICES.some((v) => v.id === voice)) throw new Error("Pick a voice first.")
  const lines = linesOf(text)
  const spoken = lines.join("\n")
  if (!spoken || spoken.length > 3000) throw new Error("The script must be between one word and 3,000 characters.")
  const hash = createHash("sha1").update(`${voice}\n${spoken}`).digest("hex").slice(0, 20)
  const key = `studio/voice/${voice}-${hash}`
  const { S3Client, GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const s3 = new S3Client({ region: REGION })
  // Already made for this voice and text.
  try {
    const have = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `${key}.json` }))
    const j = JSON.parse(await have.Body!.transformToString()) as { marks: WordMark[]; seconds: number }
    return { url: `/api/studio/audio?key=${encodeURIComponent(`${key}.mp3`)}`, marks: j.marks, seconds: j.seconds, voice, key }
  } catch {
    // not yet
  }
  const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly")
  const polly = new PollyClient({ region: REGION })
  // Newlines read as pauses: each line is its own sentence to the voice.
  const ssmlText = spoken.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const audio = await polly.send(new SynthesizeSpeechCommand({ Engine: "neural", VoiceId: voice, OutputFormat: "mp3", Text: ssmlText, TextType: "text" }))
  const marksOut = await polly.send(new SynthesizeSpeechCommand({ Engine: "neural", VoiceId: voice, OutputFormat: "json", SpeechMarkTypes: ["word"], Text: ssmlText, TextType: "text" }))
  const mp3 = Buffer.from(await audio.AudioStream!.transformToByteArray())
  const marksText = Buffer.from(await marksOut.AudioStream!.transformToByteArray()).toString("utf8")
  const marks: WordMark[] = marksText
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { time: number; value: string; type: string })
    .filter((m) => m.type === "word")
    .map((m) => ({ t: Math.round(m.time) / 1000, w: m.value }))
  const seconds = Math.round(((marks[marks.length - 1]?.t ?? 0) + 1.2) * 10) / 10
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${key}.mp3`, Body: mp3, ContentType: "audio/mpeg" }))
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${key}.json`, Body: JSON.stringify({ voice, marks, seconds, chars: spoken.length, at: new Date().toISOString() }), ContentType: "application/json" }))
  return { url: `/api/studio/audio?key=${encodeURIComponent(`${key}.mp3`)}`, marks, seconds, voice, key }
}

/** The sound bed's own-origin URL; the files are the ones scripts/studio/music-beds.mjs uploaded. */
export async function musicUrl(id: MusicId): Promise<string | null> {
  if (id === "none") return null
  return `/api/studio/audio?key=${encodeURIComponent(`studio/music/${id}.wav`)}`
}
