// The viometric build: one JSON for /viometrics, three videos, each with its normalized
// multi-modal spectrum (the Viometric strip's data) and its content vector (the Embedding
// strip's data). Real values from the same files the variables page reads; the stand-in's
// values are invented and say so. Vectors land in data/generated/model/viometric-vectors.json
// (written from the embed box's output); the stand-in's vector is a seeded pseudo-vector.
//
// Usage: node scripts/viometrics/build.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))

const catalog = read("data/velocity/catalog.json")
const C = Array.isArray(catalog) ? catalog : catalog.videos
const comp = read("data/generated/model/composition.json")
const S = comp.shorts ?? comp.videos
const thumb = read("data/generated/model/thumb-features.json")
const delivery = read("data/generated/delivery.json").videos
const hm = read("data/generated/model/headline-model.json")
let vectors = {}
try { vectors = read("data/generated/model/viometric-vectors.json") } catch {}

/** Each variable: its band, how to normalize the raw value into 0..1, in spectrum order. */
const SPEC = [
  ["Title", "titleChars", (v) => v / 100],
  ["Title", "titleWords", (v) => v / 15],
  ["Title", "titleQuestion", (v) => v],
  ["Title", "titleNumber", (v) => v],
  ["Title", "titleCapsRun", (v) => v],
  ["Title", "titleEmoji", (v) => v],
  ["Title", "digit", (v) => v],
  ["Title", "this", (v) => v],
  ["Title", "question", (v) => v],
  ["Title", "you", (v) => v],
  ["Title", "quote", (v) => v],
  ["Title", "caps", (v) => v],
  ["Title", "whatwhyhow", (v) => v],
  ["Thumbnail", "mem", (v) => v],
  ["Thumbnail", "bright", (v) => v / 255],
  ["Thumbnail", "contrast", (v) => v / 128],
  ["Thumbnail", "color", (v) => v / 128],
  ["Visual", "durationSec", (v) => v / 180],
  ["Visual", "cutsPerSec", (v) => v / 3],
  ["Visual", "firstCutSec", (v) => v / 20],
  ["Visual", "cutsHook", (v) => v / 5],
  ["Visual", "visualActivity", (v) => v / 0.5],
  ["Visual", "brightness", (v) => v / 255],
  ["Visual", "saturation", (v) => v / 255],
  ["On-screen text", "textWordsPerFrame", (v) => v / 5],
  ["On-screen text", "textFrameShare", (v) => v],
  ["On-screen text", "textHook", (v) => v / 10],
  ["Sound", "loudnessLufs", (v) => (v + 40) / 30],
  ["Sound", "loudnessRange", (v) => v / 15],
  ["Sound", "hookLoudnessDelta", (v) => (v + 10) / 20],
  ["Sound", "speechShare", (v) => v],
  ["Sound", "loudnessDb", (v) => (v + 40) / 30],
  ["Sound", "pitchHz", (v) => v / 300],
  ["Sound", "pitchMedianHz", (v) => v / 300],
  ["Sound", "pitchRangeHz", (v) => v / 200],
  ["Sound", "pauses", (v) => v / 20],
  ["Speech", "firstWordSec", (v) => v / 5],
  ["Speech", "wordsHook", (v) => v / 15],
  ["Speech", "speechWps", (v) => v / 5],
  ["Speech", "wpm", (v) => v / 300],
  ["Judgment", "firstPerson", (v) => v],
  ["Judgment", "questionLed", (v) => v],
  ["Judgment", "captions", (v) => v],
  ["Judgment", "callToAction", (v) => v],
]
const clamp = (v) => (v == null || !isFinite(v) ? null : Math.max(0, Math.min(1, v)))

// The universal-curve normalization: where the catalog gives a distribution for a variable, a
// video's value becomes its percentile rank in it — dimensionless, 0.5 = the catalog's median,
// deviation = information. The fixed constants above remain only as fallback for variables
// without 50+ measured examples.
const DIST = {}
for (const rec of Object.values(S)) for (const [k, v] of Object.entries(rec)) {
  if (typeof v === "number" && isFinite(v)) (DIST[k] ??= []).push(v)
}
for (const rec of Object.values(thumb)) if (rec && typeof rec === "object") for (const k of ["mem", "bright", "contrast", "color"]) {
  if (typeof rec[k] === "number") (DIST[k] ??= []).push(rec[k])
}
for (const a of Object.values(DIST)) a.sort((x, y) => x - y)
const BOOLS = new Set(["titleQuestion", "titleNumber", "titleCapsRun", "titleEmoji", "digit", "this", "question", "you", "quote", "caps", "whatwhyhow", "firstPerson", "questionLed", "captions", "callToAction"])
function percentile(key, raw) {
  const a = DIST[key]
  if (!a || a.length < 50 || BOOLS.has(key)) return null
  let lo = 0, hi = a.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < raw) lo = m + 1; else hi = m }
  return lo / a.length
}

function profile(id) {
  const v = C.find((x) => x.id === id)
  const c = S[id] ?? {}
  const t = thumb[id] ?? {}
  const d = delivery["yt-" + id] ?? {}
  const flags = {}
  for (const [k, p] of Object.entries(hm.patterns)) flags[k] = new RegExp(p.source, p.flags).test(v.title) ? 1 : 0
  const raw = {
    ...c,
    textFrameShare: c.textFrameShare, speechShare: c.speechShare,
    mem: t.mem, bright: t.bright, contrast: t.contrast, color: t.color,
    ...flags,
    firstPerson: d.firstPerson != null ? (d.firstPerson ? 1 : 0) : null,
    questionLed: d.questionLed != null ? (d.questionLed ? 1 : 0) : null,
    captions: null, callToAction: null,
  }
  return raw
}

/** A deterministic pseudo-vector for the invented stand-in, seeded so it never changes. */
function seededVector(n) {
  let s = 1234567
  const out = []
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    out.push(Math.round(((s / 2147483648) * 2 - 1) * 0.08 * 1e5) / 1e5)
  }
  return out
}

const STANDIN_RAW = {
  titleChars: 38, titleWords: 7, titleQuestion: 0, titleNumber: 0, titleCapsRun: 0, titleEmoji: 0,
  digit: 0, this: 0, question: 1, you: 1, quote: 0, caps: 1, whatwhyhow: 1,
  mem: 0.74, bright: 118, contrast: 54, color: 61,
  durationSec: 42, cutsPerSec: 1.8, firstCutSec: 1.9, cutsHook: 3, visualActivity: 0.21, brightness: 112, saturation: 96,
  textWordsPerFrame: 2.4, textFrameShare: 0.64, textHook: 5,
  loudnessLufs: -14.2, loudnessRange: 7.9, hookLoudnessDelta: 2.6, speechShare: 0.78,
  loudnessDb: -13.8, pitchHz: 142, pitchMedianHz: 139, pitchRangeHz: 88, pauses: 6,
  firstWordSec: 0.6, wordsHook: 7, speechWps: 3.1, wpm: 186,
  firstPerson: 1, questionLed: 1, captions: 1, callToAction: 1,
}

const VIDEOS = [
  { id: "Eg8mPYYr9OU", label: "Unite America", invented: false },
  { id: "jLD6UwGvldg", label: "Voter Freedom", invented: false },
  { id: "zz-standin01", label: "Stand-in", invented: true },
]

/** The dense per-frame series for the composite chart, from the extraction box's raw file. */
function dense(id) {
  try {
    const r = read(`data/raw/composition/raw/${id}.json`)
    const step = Math.max(1, Math.ceil(r.scenes.length / 1600))
    return {
      duration: r.durationSec,
      scenes: r.scenes.filter((_, i) => i % step === 0).map(([t, s]) => [Math.round(t * 100) / 100, Math.round(s * 1e4) / 1e4]),
      cuts: r.cuts,
      frames: r.frames.map((f) => ({ t: f.t, y: f.y, sat: f.sat, words: f.words })),
      loudness: (Array.isArray(r.loudness) ? r.loudness : (r.loudness?.perSecond ?? [])).map((v, i) => (Array.isArray(v) ? v : [i, v])),
    }
  } catch {
    return null
  }
}

/** The stand-in's invented dense series, seeded so it never changes. */
function seededDense() {
  let s = 424242
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const duration = 42
  const cuts = []
  for (let t = 1.9; t < duration; t += 0.3 + rnd() * 0.6) cuts.push(Math.round(t * 100) / 100)
  const scenes = []
  for (let i = 0; i < 1260; i++) {
    const t = (i / 1260) * duration
    const nearCut = cuts.some((c) => Math.abs(c - t) < 0.04)
    scenes.push([Math.round(t * 100) / 100, Math.round((nearCut ? 0.3 + rnd() * 0.5 : rnd() * 0.03) * 1e4) / 1e4])
  }
  const frames = []
  for (let t = 0; t < duration; t++) frames.push({ t, y: 100 + Math.sin(t / 5) * 25 + rnd() * 12, sat: 90 + Math.cos(t / 7) * 20 + rnd() * 10, words: rnd() < 0.6 ? Math.floor(rnd() * 5) : 0 })
  const loudness = frames.map((f) => [f.t, -14.2 + Math.sin(f.t / 3) * 3 + rnd() * 2 - (f.t < 2 ? -2.6 : 0)]) // already [t, lufs] pairs
  return { duration, scenes, cuts, frames, loudness }
}

const out = { builtAt: new Date().toISOString(), videos: [] }
for (const vd of VIDEOS) {
  const raw = vd.invented ? STANDIN_RAW : profile(vd.id)
  const title = vd.invented ? "What They Won't Say About Your Ballot" : C.find((x) => x.id === vd.id).title
  const spectrum = SPEC.map(([band, key, norm]) => {
    const r = raw[key] ?? null
    const v = r == null ? null : (percentile(key, r) ?? clamp(norm(r)))
    return { band, key, raw: r, v: clamp(v) }
  })
  const vector = vd.invented ? seededVector(512) : (vectors[vd.id]?.vector ?? null)
  out.videos.push({ id: vd.id, label: vd.label, title, invented: vd.invented, spectrum, vector, dense: vd.invented ? seededDense() : dense(vd.id) })
}
fs.writeFileSync(path.join(ROOT, "data/generated/viometrics.json"), JSON.stringify(out))
console.log("viometrics.json:", out.videos.map((v) => `${v.label} spectrum ${v.spectrum.filter((s) => s.v != null).length}/${v.spectrum.length} vector ${v.vector ? v.vector.length : "pending"}`).join(" · "))
