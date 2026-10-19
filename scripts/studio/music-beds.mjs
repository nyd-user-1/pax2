// Three sound beds for the Studio, synthesized here so no license question travels with them: slow
// chords from detuned triangle and sine partials with a gentle one-pole low-pass, 32 seconds each and
// loopable, 44.1 kHz 16-bit mono WAV. Uploaded to s3://pax-2-638175140432/studio/music/<id>.wav and
// served to the composition by /api/studio/audio. Usage: node scripts/studio/music-beds.mjs [--upload]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const SR = 44100
const SECONDS = 32
const BEDS = {
  calm: { bpm: 0, chords: [[0, 4, 7, 11], [-5, -1, 2, 7], [-3, 0, 4, 7], [-7, -3, 0, 4]], base: 220 / 2, gain: 0.16, cutoff: 900, pulse: 0 },
  pulse: { bpm: 84, chords: [[0, 7, 12], [-5, 2, 7], [-3, 4, 7], [-7, 0, 4]], base: 220 / 2, gain: 0.14, cutoff: 1400, pulse: 0.35 },
  bright: { bpm: 0, chords: [[0, 4, 7, 12], [5, 9, 12, 16], [-3, 0, 4, 12], [-5, -1, 2, 7]], base: 220, gain: 0.12, cutoff: 2400, pulse: 0 },
}
const note = (base, semis) => base * Math.pow(2, semis / 12)

function render(spec) {
  const n = SR * SECONDS
  const out = new Float32Array(n)
  const chordLen = SECONDS / spec.chords.length
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const ci = Math.min(spec.chords.length - 1, Math.floor(t / chordLen))
    const into = (t - ci * chordLen) / chordLen
    const env = Math.min(1, into * 6) * Math.min(1, (1 - into) * 6 + 0.15) // soft attack and release inside each chord
    let s = 0
    for (const semi of spec.chords[ci]) {
      const f = note(spec.base, semi)
      for (const [mult, amp, det] of [[1, 1, 0], [1, 0.6, 1.003], [2, 0.25, 0.998], [3, 0.08, 1]]) {
        const ph = 2 * Math.PI * f * mult * det * t
        s += amp * (0.7 * Math.sin(ph) + 0.3 * (2 / Math.PI) * Math.asin(Math.sin(ph)))
      }
    }
    s /= spec.chords[ci].length * 3
    if (spec.pulse) {
      const beat = (t * spec.bpm) / 60
      const p = Math.exp(-((beat % 1) * 7)) * spec.pulse
      s *= 1 - spec.pulse * 0.5 + p
    }
    out[i] = s * env * spec.gain
  }
  // one-pole low-pass, then a short crossfade so the loop seam is quiet
  const a = 1 - Math.exp((-2 * Math.PI * spec.cutoff) / SR)
  let y = 0
  for (let i = 0; i < n; i++) { y += a * (out[i] - y); out[i] = y }
  const fade = SR * 0.4
  for (let i = 0; i < fade; i++) { const g = i / fade; out[i] *= g; out[n - 1 - i] *= g }
  return out
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8)
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2)
  return buf
}

const outDir = path.join(root, "data", "studio", "music")
fs.mkdirSync(outDir, { recursive: true })
const files = []
for (const [id, spec] of Object.entries(BEDS)) {
  const b = wav(render(spec))
  const p = path.join(outDir, `${id}.wav`)
  fs.writeFileSync(p, b)
  files.push(p)
  console.log(`${id}.wav ${(b.length / 1e6).toFixed(1)} MB, ${SECONDS}s`)
}
if (process.argv.includes("--upload")) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const s3 = new S3Client({ region: "us-east-1" })
  for (const p of files) {
    await s3.send(new PutObjectCommand({ Bucket: "pax-2-638175140432", Key: `studio/music/${path.basename(p)}`, Body: fs.readFileSync(p), ContentType: "audio/wav" }))
    console.log(`uploaded studio/music/${path.basename(p)}`)
  }
}
