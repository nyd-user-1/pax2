"use server"

import { createHash } from "node:crypto"

import { isWord, linesOf, VOICES, type MusicId, type VoiceId, type WordMark } from "@/lib/studio-style"
import { anonSpend } from "@/lib/anon"

// The Studio's audio, made on the server and served back through /api/studio/audio so the browser's
// renderer reads it from the app's own origin (the bucket has no CORS). Narration is Amazon Polly:
// one mp3 and the word timings (speech marks) the composition paces its lines by,
// kept under studio/voice/<hash of voice and text> so the same script is never synthesized twice.
// The neural engine, because it returns word marks and the generative engine does not (checked
// 2026-10-18), and the lines must light up with the voice. Cost: a 20-second script is about 300
// characters, under half a cent at the neural rate.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

export type Narration = { url: string; marks: WordMark[]; seconds: number; voice: VoiceId; key: string }

/** Amazon Polly's neural engine: the mp3 and its word marks, two calls on the same text. */
async function polly(voice: string, text: string): Promise<{ mp3: Buffer; marks: WordMark[] }> {
  const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly")
  const client = new PollyClient({ region: REGION })
  // Plain text, not SSML: nothing is escaped, and a newline reads as a pause between lines.
  const audio = await client.send(new SynthesizeSpeechCommand({ Engine: "neural", VoiceId: voice as "Ruth", OutputFormat: "mp3", Text: text, TextType: "text" }))
  const marksOut = await client.send(new SynthesizeSpeechCommand({ Engine: "neural", VoiceId: voice as "Ruth", OutputFormat: "json", SpeechMarkTypes: ["word"], Text: text, TextType: "text" }))
  const mp3 = Buffer.from(await audio.AudioStream!.transformToByteArray())
  const marks = Buffer.from(await marksOut.AudioStream!.transformToByteArray())
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { time: number; value: string; type: string })
    .filter((m) => m.type === "word")
    .map((m) => ({ t: Math.round(m.time) / 1000, w: m.value }))
  return { mp3, marks }
}

/** ElevenLabs with character timings in one call; the words are read off the characters, the same
 *  tokens src/lib/studio-style.ts counts, so the marks and the lines agree. */
async function elevenLabs(voiceId: string, text: string): Promise<{ mp3: Buffer; marks: WordMark[] }> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error("ElevenLabs voices need ELEVENLABS_API_KEY on the server; pick a Polly voice meanwhile.")
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  })
  if (!r.ok) throw new Error(`ElevenLabs: ${r.status} ${(await r.text()).slice(0, 200)}`)
  const j = (await r.json()) as { audio_base64: string; alignment?: { characters: string[]; character_start_times_seconds: number[] } }
  const al = j.alignment
  const marks: WordMark[] = []
  if (al) {
    let word = ""
    let start = 0
    const flush = () => {
      if (word && isWord(word)) marks.push({ t: Math.round(start * 1000) / 1000, w: word })
      word = ""
    }
    al.characters.forEach((ch, i) => {
      if (/\s/.test(ch)) flush()
      else {
        if (!word) start = al.character_start_times_seconds[i]
        word += ch
      }
    })
    flush()
  }
  return { mp3: Buffer.from(j.audio_base64, "base64"), marks }
}

export async function narrate(text: string, voice: VoiceId): Promise<Narration> {
  await anonSpend("voice")
  if (voice === "none" || !VOICES.some((v) => v.id === voice)) throw new Error("Pick a voice first.")
  const lines = linesOf(text)
  const spoken = lines.join("\n")
  if (!spoken || spoken.length > 3000) throw new Error("The script must be between one word and 3,000 characters.")
  const hash = createHash("sha1").update(`${voice}\n${spoken}`).digest("hex").slice(0, 20)
  const key = `studio/voice/${voice.replace(/[^\w-]/g, "_")}-${hash}`
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
  const { mp3, marks } = voice.startsWith("el:") ? await elevenLabs(voice.slice(3), spoken) : await polly(voice, spoken)
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
