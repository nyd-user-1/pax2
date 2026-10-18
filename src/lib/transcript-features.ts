// PAX2 Classifier's transcript features, one definition (rig rule 15). scripts/classifier/
// transcript-features.mjs runs it over the catalog's captions for training, and src/lib/forecast.ts
// runs it over an original's script at scoring time; the box only fits the regression on the numbers
// this file produced.
//
//   tfidf         unigrams and bigrams, sublinear term frequency (1 + ln count) times the vocabulary's
//                 idf, L2-normalized over the vocabulary's terms
//   logWords      ln(1 + words)
//   wordRate      words per second of the video
//   titleOverlap  share of the title's words of three letters or more said in the first ten seconds
//   noTranscript  1 when there is no transcript; every other transcript feature is then 0
//
// A caption track carries each word's time, so its first ten seconds are the words before 10 s. A
// script has no times, so its first ten seconds are its first words at its own rate (words over
// seconds), or at 2.5 words a second when the length is unknown.

export type TimedWord = { t: number; w: string }
export type Vocabulary = { terms: string[]; idf: number[] }

const FALLBACK_RATE = 2.5

/** Lower-case words, with bracketed cues like [Music] and punctuation dropped; apostrophes kept inside words. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
}

/** Unigrams and adjacent bigrams ("a b"), each once per occurrence. */
export function terms(words: string[]): string[] {
  const out = words.slice()
  for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`)
  return out
}

/** The first ten seconds' words: timed when the words carry times, else by the rate. */
export function firstTenSeconds(words: string[], timed: TimedWord[] | null, durationSec: number | null): string[] {
  if (timed && timed.length) return tokens(timed.filter((x) => x.t < 10).map((x) => x.w).join(" "))
  const rate = durationSec && durationSec > 0 && words.length ? words.length / durationSec : FALLBACK_RATE
  return words.slice(0, Math.max(1, Math.round(10 * rate)))
}

export type TranscriptInput = { text: string | null; timed?: TimedWord[] | null; title: string; durationSec: number | null }

/** Every transcript feature, keyed as the model file keys them: `noTranscript`, `logWords`, `wordRate`, `titleOverlap`, and `tf:<term>` for each vocabulary term present. */
export function transcriptFeatures(input: TranscriptInput, vocab: Vocabulary): Record<string, number> {
  const words = input.text ? tokens(input.text) : []
  if (!words.length) return { noTranscript: 1, logWords: 0, wordRate: 0, titleOverlap: 0 }
  const counts = new Map<string, number>()
  for (const t of terms(words)) counts.set(t, (counts.get(t) ?? 0) + 1)
  const x: Record<string, number> = {}
  let norm = 0
  vocab.terms.forEach((t, i) => {
    const c = counts.get(t)
    if (!c) return
    const v = (1 + Math.log(c)) * vocab.idf[i]
    x[`tf:${t}`] = v
    norm += v * v
  })
  norm = Math.sqrt(norm)
  if (norm > 0) for (const k of Object.keys(x)) x[k] /= norm
  const head = new Set(firstTenSeconds(words, input.timed ?? null, input.durationSec))
  const titleWords = [...new Set(tokens(input.title).filter((w) => w.length >= 3))]
  return {
    ...x,
    noTranscript: 0,
    logWords: Math.log(1 + words.length),
    wordRate: input.durationSec && input.durationSec > 0 ? words.length / input.durationSec : 0,
    titleOverlap: titleWords.length ? titleWords.filter((w) => head.has(w)).length / titleWords.length : 0,
  }
}
