// The composition feature definitions, one place: scripts/composition/merge.mjs derives the
// catalog table from these, and src/lib/take-read.ts derives a submitted take's features from the
// same functions, so a take and a catalog short are always measured by the same arithmetic.
// Pure functions over an extraction box's raw JSON (scripts/composition/extract.py) and a transcript.

// The transcript API's word times are word indices (word n at second n), not timings; measured
// 2026-10-20 on all 1,224 of its entries. Only caption and Whisper word times feed timing features.
export const TIMED = new Set(["youtube-captions", "whisper-catalog"])
export const AUDIBLE = -50 // LUFS: a second whose momentary loudness clears this is audible
export const HOOK = 2 // seconds

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

export function headline(title) {
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
export function cutTimes(scenes) {
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

export function media(raw) {
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

export function speech(tr, raw) {
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
