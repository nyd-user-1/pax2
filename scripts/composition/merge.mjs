// Composition table (window C, 2026-10-20): folds the extraction box's raw per-short measurements
// (s3://pax-2-638175140432/composition/raw/, scripts/composition/extract.py) together with the
// word-timed transcripts and the catalog titles into data/generated/model/composition.json, one
// definition per feature (FEATURES below). Measured features only; a short missing an input gets no
// value for the features that need it, never a guess. Coverage counts ride in the file.
//
// Usage: node scripts/composition/merge.mjs          (syncs from S3 first)
//        node scripts/composition/merge.mjs --no-sync
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "./pairs.mjs"

const RAW = path.join(ROOT, "data/raw/composition/raw")
const OUT = path.join(ROOT, "data/generated/model/composition.json")
fs.mkdirSync(RAW, { recursive: true })
if (!process.argv.includes("--no-sync")) {
  execFileSync("aws", ["s3", "sync", "--only-show-errors", "s3://pax-2-638175140432/composition/raw/", RAW, "--region", "us-east-1"], { stdio: "inherit" })
}

// The transcript API's word times are word indices (word n at second n), not timings; measured
// 2026-10-20 on all 1,224 of its entries. Only caption and Whisper word times feed timing features.
const TIMED = new Set(["youtube-captions", "whisper-catalog"])
const AUDIBLE = -50 // LUFS: a second whose momentary loudness clears this is audible
const HOOK = 2 // seconds

export const FEATURES = {
  durationSec: "length in seconds (the media file; the catalog where no media)",
  cutsPerSec: "scene cuts per second (a local peak of the ffmpeg scene score, at least 0.1 and 5x the short's median)",
  firstCutSec: "seconds to the first cut (the duration when there is none)",
  cutsHook: "cuts in the first 2 s",
  visualActivity: "mean frame-to-frame scene score (motion and change)",
  loudnessLufs: "integrated loudness, LUFS",
  loudnessRange: "loudness range, LU",
  hookLoudnessDelta: "loudness of the first 2 s minus the whole short's, LU",
  textWordsPerFrame: "on-screen words per sampled frame (OCR, 1 frame a second)",
  textFrameShare: "share of sampled frames carrying on-screen text (2+ words)",
  textHook: "on-screen words in the first 2 s of frames",
  brightness: "mean frame brightness, 0 to 255",
  saturation: "mean frame saturation, 0 to 255",
  speechWps: "spoken words per second between the first and last word",
  firstWordSec: "seconds to the first spoken word",
  wordsHook: "spoken words in the first 2 s",
  speechShare: "share of audible seconds carrying speech",
  titleChars: "title length in characters",
  titleWords: "title length in words",
  titleQuestion: "title carries a question mark (0/1)",
  titleNumber: "title carries a digit (0/1)",
  titleCapsRun: "longest run of all-caps words of 3+ letters in the title",
  titleEmoji: "title carries an emoji (0/1)",
}

const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100)

function headline(title) {
  const t = title ?? ""
  const words = t.split(/\s+/).filter(Boolean)
  let run = 0
  let best = 0
  for (const w of words) {
    const letters = w.replace(/[^A-Za-z]/g, "")
    if (letters.length >= 3 && letters === letters.toUpperCase()) best = Math.max(best, ++run)
    else run = 0
  }
  return {
    titleChars: [...t].length,
    titleWords: words.length,
    titleQuestion: /\?/.test(t) ? 1 : 0,
    titleNumber: /\d/.test(t) ? 1 : 0,
    titleCapsRun: best,
    titleEmoji: /\p{Extended_Pictographic}/u.test(t) ? 1 : 0,
  }
}

/** A cut is a frame whose scene score is the peak of its ±0.3 s window, at least CUT_MIN, and at least
 *  CUT_X times the short's own median score. At 360p a fixed 0.3 missed visible cuts (rehearsal: a
 *  short with a 0.02 background and four peaks at 0.13). */
const CUT_MIN = 0.1
const CUT_X = 5
function cutTimes(scenes) {
  const s = scenes.filter(([t]) => t > 0.05)
  if (!s.length) return []
  const sorted = s.map(([, v]) => v).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const floor = Math.max(CUT_MIN, median * CUT_X)
  const out = []
  for (let i = 0; i < s.length; i++) {
    const [t, v] = s[i]
    if (v < floor) continue
    let peak = true
    for (let j = i - 1; j >= 0 && t - s[j][0] <= 0.3; j--) if (s[j][1] >= v) peak = false
    for (let j = i + 1; j < s.length && s[j][0] - t <= 0.3; j++) if (s[j][1] > v) peak = false
    if (peak) out.push(t)
  }
  return out
}

function media(raw) {
  const f = {}
  const dur = raw.durationSec
  f.durationSec = r2(dur)
  if (raw.scenes && dur) {
    const cuts = cutTimes(raw.scenes)
    f.cutsPerSec = r2(cuts.length / dur)
    f.firstCutSec = r2(cuts.length ? cuts[0] : dur)
    f.cutsHook = cuts.filter((t) => t < HOOK).length
    const sc = raw.scenes.filter(([t]) => t > 0.05).map(([, s]) => s)
    f.visualActivity = sc.length ? Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 1e4) / 1e4 : null
  }
  if (raw.frames?.length) {
    const fr = raw.frames
    f.textWordsPerFrame = r2(fr.reduce((a, x) => a + x.words, 0) / fr.length)
    f.textFrameShare = r2(fr.filter((x) => x.words >= 2).length / fr.length)
    f.textHook = fr.filter((x) => x.t < HOOK).reduce((a, x) => a + x.words, 0)
    f.brightness = r2(fr.reduce((a, x) => a + x.y, 0) / fr.length)
    f.saturation = r2(fr.reduce((a, x) => a + x.sat, 0) / fr.length)
  }
  const L = raw.loudness
  if (L?.perSecond?.length) {
    f.loudnessLufs = L.integrated
    f.loudnessRange = L.range
    const hook = L.perSecond.slice(0, HOOK).filter((v) => v > -120)
    if (hook.length && L.integrated != null && L.integrated > -70) {
      const e = hook.reduce((a, v) => a + 10 ** (v / 10), 0) / hook.length
      f.hookLoudnessDelta = r2(10 * Math.log10(e) - L.integrated)
    }
  }
  return f
}

function speech(tr, raw) {
  if (!tr || !TIMED.has(tr.source) || !tr.words?.length) return {}
  const ts = tr.words.map((w) => w.t).filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
  if (!ts.length) return {}
  const f = { firstWordSec: r2(ts[0]), wordsHook: ts.filter((t) => t < HOOK).length }
  const span = ts[ts.length - 1] - ts[0]
  if (ts.length >= 5 && span >= 2) f.speechWps = r2((ts.length - 1) / span)
  const per = raw?.loudness?.perSecond
  if (per?.length) {
    const spoken = new Set(ts.map((t) => Math.floor(t)))
    const audible = per.map((v, s) => (v > AUDIBLE ? s : -1)).filter((s) => s >= 0)
    if (audible.length) f.speechShare = r2(audible.filter((s) => spoken.has(s)).length / audible.length)
  }
  return f
}

const { pairs: ps, catalog } = pairs()
const transcripts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/transcripts.json"), "utf8"))
const raws = new Map()
for (const file of fs.readdirSync(RAW).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, file), "utf8"))
  raws.set(j.id, j)
}

const shorts = {}
for (const v of catalog.videos) {
  const raw = raws.get(v.id)
  const f = { ...headline(v.title), durationSec: v.durationSec ?? null, ...(raw ? media(raw) : {}), ...speech(transcripts[v.id], raw) }
  if (f.durationSec == null) f.durationSec = v.durationSec ?? null
  for (const k of Object.keys(f)) if (f[k] == null) delete f[k]
  shorts[v.id] = f
}

const pairIds = new Set(ps.flatMap((p) => [p.breakout.id, p.control.id]))
const coverage = { catalog: catalog.videos.length, pairs: ps.length, pairIds: pairIds.size, raw: raws.size, perFeature: {}, perFeaturePairIds: {}, pairsBothSidesVideo: 0, pairsBothSidesAudio: 0 }
for (const k of Object.keys(FEATURES)) {
  coverage.perFeature[k] = Object.values(shorts).filter((f) => f[k] != null).length
  coverage.perFeaturePairIds[k] = [...pairIds].filter((id) => shorts[id]?.[k] != null).length
}
for (const p of ps) {
  const a = raws.get(p.breakout.id)
  const b = raws.get(p.control.id)
  if (a?.scenes && b?.scenes) coverage.pairsBothSidesVideo++
  if (a?.loudness && b?.loudness) coverage.pairsBothSidesAudio++
}

const out = {
  builtAt: new Date().toISOString(),
  version: "composition-1",
  source: "s3://pax-2-638175140432/composition/raw/ (scripts/composition/extract.py), data/generated/transcripts.json, data/velocity/catalog.json",
  notes: [
    "Headline traits cover every catalog short; media features only shorts with media extracted; speech timing only caption and Whisper transcripts (the transcript API's word times are word indices).",
    "Text overlay is OCR at one frame a second, words of 2+ alphanumerics at confidence 60+.",
    "Not measured: emotion, music detection as such (speechShare is the speech-versus-other-sound balance over audible seconds).",
  ],
  features: FEATURES,
  coverage,
  shorts,
}
fs.writeFileSync(OUT, JSON.stringify(out))
console.log(JSON.stringify(coverage, null, 1))
