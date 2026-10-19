import ratios from "../../data/generated/model/outcome-ratios.json"
import model from "../../data/generated/model/var-model.json"
import modelV2 from "../../data/generated/model/var-model-v2.json"
import lift from "../../data/velocity/metadata-lift.json"
import { transcriptFeatures, type Vocabulary } from "@/lib/transcript-features"
import { extract, familyOf, type VideoInput } from "@/lib/video-features"

// The pre-publish forecast: before a video is posted, how likely it is to be pushed past its
// channel's median (the breakout label on /outliers), from PAX2 Classifier
// (data/generated/model/var-model.json, scripts/rig/train_var.py), with every input's pull on
// the number shown. The metadata model by default; the transcript model (PAX2 Classifier with
// transcript features, data/generated/model/var-model-v2.json, scripts/classifier/train_v2.py) when a
// transcript is supplied and Gate C passed; the image model, which adds the thumbnail's
// PAX2 Vision Encoder features, when those features are supplied and its gate passed. Beside it, the distribution recommendations: each pre-publish trait whose within-channel
// lift (data/velocity/metadata-lift.json) is measurably above or below zero for the video's family,
// read against what this video has, as a concrete change or a trait to keep.
//
// What it is not: a reading of the video itself. The transcript model reads the words only; the image
// model has seen only the thumbnail. Its strength is reported with the number so no screen can overstate it.

export type { VideoInput } from "@/lib/video-features"

type ModelFeature = { key: string; label: string; kind: string; coef: number; mean: number; sd: number; prevalence: number | null }
type Model = {
  version: string
  n: number
  positives: number
  baseRate: number
  intercept: number
  features: ModelFeature[]
  metrics: { leaveOneChannelOut: { auc: number; aucChannelOnly: number; withinChannelAuc: number | null; topDecileLift: number; perFamily: { family: string; n: number; baseRate: number; auc: number | null }[] }; timeSplit: { auc: number | null } }
  checks: { input: VideoInput; image?: ImageFeatures; p: number }[]
}
type Models = { builtAt: string; metadata: Model; image: Model; gates: { image: { passed: boolean } }; caveats: string[] }
const MODELS = model as unknown as Models
const M = MODELS.metadata
// A placeholder until the v2 run lands: { status, gates: { transcript: { passed: false } } }.
type ModelsV2 = { builtAt?: string; transcript?: Model & { transcriptFeatures: { vocab: Vocabulary } }; gates: { transcript: { passed: boolean } } }
const V2 = modelV2 as unknown as ModelsV2
const RATIOS = ratios as { hit: { n: number; medianRatio: number }; rest: { n: number; medianRatio: number } }

export type ModelKind = "metadata" | "image" | "transcript"

/** A thumbnail's PAX2 Vision Encoder features, as scripts/rig/encode_images.py computes them. */
export type ImageFeatures = { mem: number | null; bright: number; contrast: number; color: number; pca: number[] }

/** The model a forecast reads: the transcript model when a transcript is supplied and Gate C passed,
 *  else the image model when image features are supplied and its gate passed, else the metadata model. */
export function modelFor(image?: ImageFeatures | null, transcript?: string | null): { model: Model; kind: ModelKind; builtAt: string } {
  if (transcript?.trim() && V2.gates.transcript.passed && V2.transcript) return { model: V2.transcript, kind: "transcript", builtAt: V2.builtAt ?? MODELS.builtAt }
  return image && MODELS.gates.image.passed ? { model: MODELS.image, kind: "image", builtAt: MODELS.builtAt } : { model: M, kind: "metadata", builtAt: MODELS.builtAt }
}

function imageX(image: ImageFeatures): Record<string, number> {
  const x: Record<string, number> = { bright: image.bright, contrast: image.contrast, color: image.color }
  if (image.mem != null) x.mem = image.mem
  image.pca.forEach((v, k) => (x[`pca${k}`] = v))
  return x
}

export type Contribution = { key: string; label: string; value: number; pull: number }

export type Forecast = {
  /** Probability of a breakout: at least 3x the channel's median. */
  p: number
  logit: number
  /** The catalog's rate and the family's, for "against what". */
  base: { all: number; family: number | null; familyName: string | null }
  /** The channel's median and what 3x of it is, so the probability has a number in views beside it. */
  anchor: { median: number | null; breakoutViews: number | null }
  /** Views to expect: the median times p of a Hit's median ratio plus (1 - p) of the rest's
   *  (data/generated/model/outcome-ratios.json); null without a median. */
  expected: { views: number; hitRatio: number; restRatio: number } | null
  /** Every input's pull on the log-odds, strongest first; families and channel size included. */
  contributions: Contribution[]
  /** How much to trust it: the model's own out-of-sample numbers. */
  strength: { auc: number; withinChannelAuc: number | null; topDecileLift: number; familyAuc: number | null; n: number; version: string; builtAt: string }
  /** Which of PAX2 Classifier's models produced it. */
  model: ModelKind
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function forecast(input: VideoInput, image?: ImageFeatures | null, transcript?: string | null): Forecast {
  const { model: Mx, kind, builtAt } = modelFor(image, transcript)
  const x =
    kind === "transcript" && V2.transcript
      ? { ...extract(input), ...transcriptFeatures({ text: transcript ?? null, title: input.title, durationSec: input.durationSec }, V2.transcript.transcriptFeatures.vocab) }
      : kind === "image" && image
        ? { ...extract(input), ...imageX(image) }
        : extract(input)
  const fam = familyOf(input.group)
  const contributions: Contribution[] = Mx.features.map((f) => {
    const value = x[f.key] ?? 0
    return { key: f.key, label: f.label, value, pull: f.coef * ((value - f.mean) / f.sd) }
  })
  const logit = Mx.intercept + contributions.reduce((t, c) => t + c.pull, 0)
  const perFamily = Mx.metrics.leaveOneChannelOut.perFamily.find((p) => p.family === fam)
  const p = sigmoid(logit)
  const { hit, rest } = RATIOS
  return {
    p,
    logit,
    base: { all: Mx.baseRate, family: perFamily?.baseRate ?? null, familyName: fam },
    anchor: { median: input.channelMedian, breakoutViews: input.channelMedian ? Math.round(input.channelMedian * 3) : null },
    expected: input.channelMedian ? { views: Math.round(input.channelMedian * (p * hit.medianRatio + (1 - p) * rest.medianRatio)), hitRatio: hit.medianRatio, restRatio: rest.medianRatio } : null,
    contributions: contributions.filter((c) => Math.abs(c.pull) > 1e-9).sort((a, b) => Math.abs(b.pull) - Math.abs(a.pull)),
    strength: { auc: Mx.metrics.leaveOneChannelOut.auc, withinChannelAuc: Mx.metrics.leaveOneChannelOut.withinChannelAuc, topDecileLift: Mx.metrics.leaveOneChannelOut.topDecileLift, familyAuc: perFamily?.auc ?? null, n: Mx.n, version: Mx.version, builtAt },
    model: kind,
  }
}

// ---------- Distribution recommendations from the measured within-channel lifts ----------

type Effect = { points: number; low: number; high: number; channels: number; videos: number; basePushed: number } | null
type LiftRow = { key: string; label: string; prevalence: number; all: Effect; byGroup: Record<string, Effect> }
const LIFT = lift as unknown as { builtAt: string; method: string; videos: number; channels: number; pushedShare: number; rows: LiftRow[] }

/** How to say each trait as a change: [add it, drop it]. */
const PHRASE: Record<string, [string, string]> = {
  question: ["Ask a question in the title", "Drop the question from the title"],
  exclaim: ["Add an exclamation mark to the title", "Drop the exclamation mark"],
  number: ["Put a number in the title", "Take the number out of the title"],
  firstPerson: ["Write the title in the first person", "Take the first person out of the title"],
  you: ["Address the viewer in the title", "Stop addressing the viewer in the title"],
  caps: ["Put one word of the title in all caps", "Drop the all-caps word"],
  anger: ["Use a combative word in the title", "Drop the combative word from the title"],
  quote: ["Quote someone in the title", "Drop the quotation from the title"],
  shortTitle: ["Cut the title to six words or fewer", "Lengthen the title past six words"],
  longTitle: ["Lengthen the title to fifteen words or more", "Cut the title under fifteen words"],
  emoji: ["Add an emoji to the title", "Drop the emoji from the title"],
  hashtagTitle: ["Add a hashtag to the title", "Drop the hashtag from the title"],
  trump: ["Name Trump in the title", "Leave Trump out of the title"],
  under20: ["Cut it to 20 seconds or shorter", "Run it longer than 20 seconds"],
  under35: ["Cut it to 35 seconds or shorter", "Run it longer than 35 seconds"],
  over60: ["Run it longer than a minute", "Keep it under a minute"],
  weekend: ["Post on a weekend", "Post on a weekday"],
  morning: ["Post between 6 and 11am Eastern", "Post outside 6 to 11am Eastern"],
  evening: ["Post between 6 and 11pm Eastern", "Post outside 6 to 11pm Eastern"],
  cta: ["Put a call to action in the description", "Take the call to action out of the description"],
  link: ["Put a link in the description", "Take the link out of the description"],
  noDescription: ["Leave the description empty", "Write a description"],
  tags: ["Add tags", "Remove the tags"],
}

export type Recommendation = {
  key: string
  label: string
  /** The change to make, or null when the video already sits on the right side of the trait. */
  action: string | null
  has: boolean
  /** Percentage points of breakout rate, within channel, with its 90% range. */
  points: number
  low: number
  high: number
  /** Whose channels the lift was measured on. */
  scope: string
  channels: number
  videos: number
}

/** Every trait whose measured lift for this family (or, failing that, all channels) excludes zero,
 *  strongest first: the ones to change, then the ones already in place. */
export function recommendations(input: VideoInput): { changes: Recommendation[]; keeps: Recommendation[]; method: string; measured: { videos: number; channels: number; pushedShare: number; builtAt: string } } {
  const x = extract(input)
  const fam = familyOf(input.group)
  const out: Recommendation[] = []
  for (const row of LIFT.rows) {
    const own = fam ? row.byGroup[fam] : null
    const e = own ?? row.all
    if (!e || !(e.low > 0 || e.high < 0)) continue
    const has = (x[row.key] ?? 0) > 0
    const wantIt = e.points > 0
    const phrase = PHRASE[row.key]
    const action = has === wantIt ? null : phrase ? (wantIt ? phrase[0] : phrase[1]) : wantIt ? `Add: ${row.label.toLowerCase()}` : `Avoid: ${row.label.toLowerCase()}`
    out.push({ key: row.key, label: row.label, action, has, points: e.points, low: e.low, high: e.high, scope: own ? `${fam} channels` : "all channels", channels: e.channels, videos: e.videos })
  }
  out.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
  return { changes: out.filter((a) => a.action), keeps: out.filter((a) => !a.action), method: LIFT.method, measured: { videos: LIFT.videos, channels: LIFT.channels, pushedShare: LIFT.pushedShare, builtAt: LIFT.builtAt } }
}

export const modelCaveats = () => MODELS.caveats
