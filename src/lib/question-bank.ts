// The question bank: every question the stored measurements already answer, in the reader's voice.
// One definition per question: the chip as shown, the columns its resolver reads, the basis its number
// rests on, and the answer template the resolver fills (src/lib/question-resolver.ts, one function per id).
// No model call answers any of these. Pass-2 questions need a GPU read of the frames; they are registered
// here so the universe is complete, and never shown as chips until a pass-2 resolver exists.
//
// Plain module, no imports: the chips, the resolver, scripts/question-bank.mjs and the universe sketch
// (scripts/question-universe.mjs) all read this one file.

export type Register = "video" | "field" | "action"

/** The stores a resolver reads; each one gates the question for a given video. */
export type Store =
  | "catalog" // data/velocity/catalog.json: views, likes, comments, channel median, ratio, tier
  | "composition" // data/raw/composition/raw/<id>.json + data/generated/model/composition.json: cuts, per-second frames and loudness
  | "speech" // composition's speech timing: caption and Whisper transcripts only (the transcript API's times are word indices)
  | "transcript" // data/generated/transcripts.json: the words, timed where the source is captions or Whisper
  | "census" // data/generated/model/vqa-census.json: the seven read from 13 frames, audited on 100
  | "index" // the serving index (data/raw/composition/index): nearest neighbors, precomputed per baseline short
  | "craft" // data/generated/video-reads.json: within-channel percentiles on 24 craft axes
  | "modes" // data/generated/model/winning-modes.json: the surviving winning mode and each short's mode-match
  | "topics" // video-reads.json topic + encoder-map.json clusters + topic-lift.json measured lifts
  | "findings" // data/generated/model/composition-findings.json: paired splits, overall and per cluster
  | "lengths" // data/generated/model/length-crossing.json: outperform and underperform share by length
  | "registry" // data/generated/model/vqa-registry.json + vqa-lift.json: census traits with the Breakout lift
  | "velocity72" // data/generated/model/velocity-features.json: views at 1, 6, 24 and 72 hours
  | "policy" // data/generated/model/martian-publish-policy.json: posterior over topic x length x hour block
  | "swayable" // data/generated/swayable-patterns.json: each trait's measured difference in vote choice
  | "codebook" // data/generated/codebook.json: Swayable and Wesleyan codes (5,378 baseline transcripts), Upworthy patterns (every title)
  | "frames-gpu" // pass 2: a vision-language read of the frames, not stored

/** Census columns whose audited accuracy rides with the answer, once, quietly. */
export const CENSUS_AUDIT = {
  callToAction: { right: 94, of: 99 },
  ctaSec: { right: 28, of: 28, rule: "within 2 s" },
  captionsBurnedIn: { right: 88, of: 99 },
  setting: { right: 83, of: 90 },
  format: { right: 72, of: 86 },
  thirdPartyWatermark: { right: 83, of: 97 },
  peopleScreenShare: { right: 80, of: 99, rule: "within 0.15" },
} as const
export type CensusColumn = keyof typeof CENSUS_AUDIT

export type Question = {
  id: string
  register: Register
  /** The chip as shown: what a creator or partner would tap. */
  ask: string
  /** Store-qualified columns the resolver reads. */
  reads: string[]
  /** Stores that must hold this video for the question to answer. */
  needs: Store[]
  /** What the answer's number rests on, in one line. */
  basis: string
  /** The answer, scientific voice; {slots} are filled by the resolver. */
  template: string
  /** What the reader does when the data is missing for this video. */
  unlock?: string
  /** Census column whose audit line rides with the answer. */
  census?: CensusColumn
  /** A video's question, or a question about the whole channel the video belongs to. */
  scope?: "video" | "channel"
  /** 2 = needs a GPU read of the frames; registered, not answered here. */
  pass?: 2
}

const RUN_FLASK = "Run the flask: the file's cuts, loudness and on-screen text are measured from the media"
const ADD_CAPTIONS = "Add captions: word timings come from captions or a Whisper pass"
const RUN_CENSUS = "Run the census on this video: the seven frame questions are read from 13 frames"
const TRACK = "Connect the channel: new publishes are polled from their first hour, so the 72-hour curve fills"
const RUN_CODEBOOK = "Run the codebook on this video: the Swayable, Upworthy and Wesleyan codes land with it"

export const QUESTIONS: Question[] = [
  // ── The video in hand ──────────────────────────────────────────────────────────────────────────
  {
    id: "first-two-seconds",
    register: "video",
    ask: "What happens in the first two seconds?",
    reads: ["composition.cutsHook", "composition.textHook", "composition.wordsHook", "composition.hookLoudnessDelta", "raw.frames[0..2].words"],
    needs: ["composition"],
    basis: "the media file: scene cuts, OCR at one frame a second, the loudness curve, the timed transcript",
    template: "In the first 2 s: {cuts} cuts, {spoken} spoken words, {onscreen} on-screen words. The opening is {delta} LU {louderQuieter} than the short as a whole.",
    unlock: RUN_FLASK,
  },
  {
    id: "first-word",
    register: "video",
    ask: "When does my first word land?",
    reads: ["composition.firstWordSec", "transcript.words[0]"],
    needs: ["speech", "transcript"],
    basis: "word timings from the captions or Whisper",
    template: "The first spoken word, “{word}”, lands at {sec} s. {fieldPct} of baseline shorts speak sooner.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "before-first-word",
    register: "video",
    ask: "What happens before my first word lands?",
    reads: ["composition.firstWordSec", "raw.cuts", "raw.frames[].words", "raw.loudness.perSecond"],
    needs: ["composition", "speech"],
    basis: "the media file's cuts, OCR and loudness up to the first timed word",
    template: "Before the first word at {sec} s: {cuts} cuts, {textSeconds} seconds with on-screen text, loudness {lufs} LUFS on average.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "hook-opens-on",
    register: "video",
    ask: "Does my hook open on a face, on text, or on b-roll?",
    reads: ["census.format", "census.peopleScreenShare", "raw.frames[0..2].words"],
    needs: ["census", "composition"],
    basis: "the census's format read and OCR on the first three sampled frames",
    template: "The first three sampled seconds carry {words} on-screen words. The census reads the format as {format}, with people in {share} of the frame.",
    census: "format",
    unlock: RUN_CENSUS,
  },
  {
    id: "cta-when",
    register: "video",
    ask: "Is there a call to action, and when does it show?",
    reads: ["census.callToAction", "census.ctaSec"],
    needs: ["census"],
    basis: "the census's on-screen call-to-action read; the timestamp within 2 s on 28 of 28",
    template: "An on-screen call to action shows at {sec} s. | No on-screen call to action in the sampled frames.",
    census: "callToAction",
    unlock: RUN_CENSUS,
  },
  {
    id: "on-mute",
    register: "video",
    ask: "What does this look like on mute?",
    reads: ["census.captionsBurnedIn", "composition.textFrameShare", "composition.textWordsPerFrame"],
    needs: ["composition", "census"],
    basis: "OCR at one frame a second and the census's captions read",
    template: "{share}% of seconds carry on-screen text, {wpf} words a frame on average. Captions {are} burned in.",
    census: "captionsBurnedIn",
    unlock: RUN_FLASK,
  },
  {
    id: "text-moments",
    register: "video",
    ask: "Show me every moment with on-screen text.",
    reads: ["raw.frames[].t", "raw.frames[].words"],
    needs: ["composition"],
    basis: "OCR at one frame a second; a moment is a run of seconds with 2+ words",
    template: "{n} stretches carry on-screen text: {spans}.",
    unlock: RUN_FLASK,
  },
  {
    id: "shots",
    register: "video",
    ask: "How many shots do I use, and where's the longest?",
    reads: ["raw.cuts", "raw.durationSec"],
    needs: ["composition"],
    basis: "scene cuts from the ffmpeg scene score",
    template: "{shots} shots over {duration} s. The longest runs {longest} s, from {from} s to {to} s.",
    unlock: RUN_FLASK,
  },
  {
    id: "first-cut",
    register: "video",
    ask: "How long before the first cut?",
    reads: ["composition.firstCutSec", "craft.firstCutSec"],
    needs: ["composition"],
    basis: "scene cuts; the percentile is within the channel",
    template: "The first cut comes at {sec} s, the {pct} percentile of the channel's shorts.",
    unlock: RUN_FLASK,
  },
  {
    id: "pace",
    register: "video",
    ask: "How fast is it cut?",
    reads: ["composition.cutsPerSec", "craft.cutsPerSec"],
    needs: ["composition"],
    basis: "scene cuts per second; the percentile is within the channel",
    template: "{rate} cuts a second, one every {every} s on average: the {pct} percentile of the channel's shorts.",
    unlock: RUN_FLASK,
  },
  {
    id: "loudest-moment",
    register: "video",
    ask: "What's happening at the loudest moment?",
    reads: ["raw.loudness.perSecond", "raw.cuts", "raw.frames[].words", "transcript.words"],
    needs: ["composition"],
    basis: "the per-second loudness curve, with the cuts, OCR and words at that second",
    template: "The loudest second is {sec} s at {lufs} LUFS, {over} LU over the integrated level. {context}",
    unlock: RUN_FLASK,
  },
  {
    id: "quiet-spots",
    register: "video",
    ask: "Where does the sound drop out?",
    reads: ["raw.loudness.perSecond", "raw.loudness.integrated"],
    needs: ["composition"],
    basis: "seconds 10 LU or more under the integrated level",
    template: "{n} drops of 10 LU or more: {spans}. | No second falls 10 LU under the integrated level.",
    unlock: RUN_FLASK,
  },
  {
    id: "loud-enough",
    register: "video",
    ask: "Is it loud enough?",
    reads: ["composition.loudnessLufs", "composition.loudnessRange"],
    needs: ["composition"],
    basis: "integrated loudness against the 5,379-short baseline",
    template: "Integrated loudness {lufs} LUFS; the baseline median is {median} LUFS ({pct} percentile). Loudness range {range} LU.",
    unlock: RUN_FLASK,
  },
  {
    id: "talk-speed",
    register: "video",
    ask: "How fast do I talk?",
    reads: ["composition.speechWps", "craft.speechWps"],
    needs: ["speech"],
    basis: "spoken words per second between the first and last timed word",
    template: "{wps} words a second, the {pct} percentile of the channel's shorts; the baseline median is {median}.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "talk-share",
    register: "video",
    ask: "How much of it is talking?",
    reads: ["composition.speechShare"],
    needs: ["speech"],
    basis: "share of audible seconds carrying speech",
    template: "Speech fills {share}% of the audible seconds; the baseline median is {median}%.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "script-length",
    register: "video",
    ask: "How many words is the script?",
    reads: ["transcript.words", "composition.durationSec"],
    needs: ["transcript"],
    basis: "the transcript's word count over the file's length",
    template: "{words} words over {duration} s.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "said-at-first-text",
    register: "video",
    ask: "What am I saying when text first appears?",
    reads: ["raw.frames[].words", "transcript.words[].t"],
    needs: ["composition", "speech", "transcript"],
    basis: "the first OCR second with 2+ words, matched to the timed words around it",
    template: "On-screen text first appears at {sec} s, over the words “{words}”.",
    unlock: ADD_CAPTIONS,
  },
  {
    id: "ending",
    register: "video",
    ask: "How does it end?",
    reads: ["raw.frames[-3..].words", "raw.loudness.perSecond[-3..]", "census.ctaSec", "transcript.words[-8..]"],
    needs: ["composition"],
    basis: "the last 3 seconds of OCR, loudness and words",
    template: "The last 3 s: {text}, loudness {lufs} LUFS{cta}. Last words: “{words}”.",
    unlock: RUN_FLASK,
  },
  {
    id: "captions",
    register: "video",
    ask: "Are my captions burned in?",
    reads: ["census.captionsBurnedIn"],
    needs: ["census"],
    basis: "the census: on-screen text that changes with the speech",
    template: "Captions {are} burned in.",
    census: "captionsBurnedIn",
    unlock: RUN_CENSUS,
  },
  {
    id: "format",
    register: "video",
    ask: "What kind of video is this?",
    reads: ["census.format"],
    needs: ["census"],
    basis: "the census's format read",
    template: "Format: {format}.",
    census: "format",
    unlock: RUN_CENSUS,
  },
  {
    id: "setting",
    register: "video",
    ask: "Where was this shot?",
    reads: ["census.setting"],
    needs: ["census"],
    basis: "the census's setting read",
    template: "Setting: {setting}.",
    census: "setting",
    unlock: RUN_CENSUS,
  },
  {
    id: "people-share",
    register: "video",
    ask: "How much of the frame do people fill?",
    reads: ["census.peopleScreenShare"],
    needs: ["census"],
    basis: "the census's screen-share read; counts only, no identity",
    template: "People fill about {share} of the frame.",
    census: "peopleScreenShare",
    unlock: RUN_CENSUS,
  },
  {
    id: "others-logo",
    register: "video",
    ask: "Is anyone else's logo on screen?",
    reads: ["census.thirdPartyWatermark"],
    needs: ["census"],
    basis: "the census's third-party watermark read; precision 0.64, so a yes deserves a look",
    template: "A third-party watermark or chyron {is} read in the sampled frames.",
    census: "thirdPartyWatermark",
    unlock: RUN_CENSUS,
  },
  {
    id: "motion",
    register: "video",
    ask: "How much does the picture move?",
    reads: ["composition.visualActivity", "craft.visualActivity"],
    needs: ["composition"],
    basis: "mean frame-to-frame scene score; the percentile is within the channel",
    template: "Visual activity {value}, the {pct} percentile of the channel's shorts.",
    unlock: RUN_FLASK,
  },
  {
    id: "brightness",
    register: "video",
    ask: "Is it too dark?",
    reads: ["composition.brightness", "composition.saturation"],
    needs: ["composition"],
    basis: "mean frame brightness and saturation, 0 to 255, against the baseline",
    template: "Brightness {y} of 255 (baseline median {median}), saturation {sat}.",
    unlock: RUN_FLASK,
  },
  {
    id: "title",
    register: "video",
    ask: "What does my title do?",
    reads: ["composition.titleChars", "composition.titleWords", "composition.titleQuestion", "composition.titleNumber", "composition.titleCapsRun", "composition.titleEmoji"],
    needs: ["catalog"],
    basis: "the title's measured traits against the baseline",
    template: "{words} words, {chars} characters (baseline median {median}). {traits}.",
  },
  {
    id: "persuasion-traits",
    register: "video",
    ask: "Which persuasion techniques does it use?",
    reads: ["codebook.swayable", "swayable.traits"],
    needs: ["codebook"],
    basis: "the codebook's Swayable coding of the transcript; 82% agreement with a second coder over 20 videos",
    template: "{n} of Swayable's 28 traits: {traits}.",
    unlock: RUN_CODEBOOK,
  },
  {
    id: "ad-goal",
    register: "video",
    ask: "Is this trying to persuade?",
    reads: ["codebook.wesleyan"],
    needs: ["codebook"],
    basis: "the codebook's Wesleyan goal coding of the transcript; two coders agreed on 16 of 20",
    template: "Wesleyan goal: {goal}.",
    unlock: RUN_CODEBOOK,
  },

  // ── Against the field ─────────────────────────────────────────────────────────────────────────
  {
    id: "outlier-score",
    register: "field",
    ask: "How did this do against my usual?",
    reads: ["catalog.views", "catalog.channelMedian", "catalog.ratio", "catalog.tier"],
    needs: ["catalog"],
    basis: "views over the channel's median views (the Outlier Score)",
    template: "{views} views against a channel median of {median}: an Outlier Score of {ratio}×. {verdict}",
  },
  {
    id: "why-outperformed",
    register: "field",
    ask: "Why might this one have outperformed?",
    reads: ["catalog.ratio", "registry.rows[measured]", "topics.lift", "modes.score", "lengths.bins"],
    needs: ["catalog", "census"],
    basis: "the traits it carries that have a measured Breakout lift, within the same channels",
    template: "Outlier Score {ratio}×. Of the traits measured to move the outperform rate, it carries: {traits}. These are associations measured across channels, not causes of this one result.",
    unlock: RUN_CENSUS,
  },
  {
    id: "channel-rank",
    register: "field",
    ask: "Where does this rank on my channel?",
    reads: ["catalog.ratio", "catalog.channelId"],
    needs: ["catalog"],
    basis: "Outlier Score rank among the channel's catalog shorts",
    template: "{rank} of {n} on the channel by Outlier Score; {outperformed} of the {n} outperformed 3x.",
  },
  {
    id: "best-video-diff",
    register: "field",
    ask: "What's different about my best video?",
    reads: ["catalog.ratio", "craft.*"],
    needs: ["catalog", "craft"],
    basis: "the channel's top Outlier Score short, compared axis by axis in within-channel percentiles",
    template: "The channel's best is “{title}” at {ratio}×. The widest gaps: {gaps}.",
    unlock: RUN_FLASK,
  },
  {
    id: "neighbors",
    register: "field",
    ask: "Show me videos like this one.",
    reads: ["index.neighbors[0..5]", "catalog.ratio"],
    needs: ["index"],
    basis: "nearest neighbors in the serving index (cosine on the 1,024-dimension embedding)",
    template: "Nearest in the index: {list}.",
    unlock: "Embed the transcript: neighbors come from the serving-index embedding",
  },
  {
    id: "like-this-differently",
    register: "field",
    ask: "What do videos like this one do differently?",
    reads: ["index.neighbors[0..20]", "catalog.tier", "composition.*"],
    needs: ["index", "composition"],
    basis: "the 20 nearest neighbors split by whether they outperformed 3x, compared on measured craft",
    template: "Of its 20 nearest neighbors, {k} outperformed 3x. Against the rest they {diffs}.",
    unlock: "Embed the transcript: neighbors come from the serving-index embedding",
  },
  {
    id: "topic",
    register: "field",
    ask: "What's this about, and how does that topic do?",
    reads: ["topics.cluster", "topics.lift"],
    needs: ["topics"],
    basis: "the encoder map's 40 clusters; the topic lift where measured in 5+ channels",
    template: "Topic: {label} ({n} shorts). {lift}",
  },
  {
    id: "good-length",
    register: "field",
    ask: "Is this a good length?",
    reads: ["catalog.durationSec", "lengths.bins", "lengths.crossing"],
    needs: ["catalog"],
    basis: "outperform and underperform share by length, within channels, 18,544 shorts",
    template: "At {sec} s it sits in the {bin} bin: {out}% outperformed 3x, {under}% fell to half the median or less. Past {crossing} s the underperform share exceeds the outperform share.",
  },
  {
    id: "mode-match",
    register: "field",
    ask: "Does this match the craft of the winners?",
    reads: ["modes.scores", "modes.full.modes[survived]"],
    needs: ["modes"],
    basis: "the one winning mode that re-measured above base on held-out channels",
    template: "Mode-match {score} of 100 against “{mode}”, which outperformed 3x at {lift}% against a base of {base}% on held-out channels.",
    unlock: RUN_FLASK,
  },
  {
    id: "craft-extremes",
    register: "field",
    ask: "Where does this stand out on my channel?",
    reads: ["craft.*"],
    needs: ["craft"],
    basis: "within-channel percentiles on 24 craft axes",
    template: "Furthest from the channel's usual: {extremes}.",
    unlock: RUN_FLASK,
  },
  {
    id: "hook-vs-winners",
    register: "field",
    ask: "How does my opening compare with ones that outperformed?",
    reads: ["composition.cutsHook", "composition.textHook", "composition.wordsHook", "composition.firstWordSec", "findings.overall"],
    needs: ["composition"],
    basis: "2,770 within-channel pairs, outperformer against a same-channel control",
    template: "{rows}",
    unlock: RUN_FLASK,
  },
  {
    id: "format-field",
    register: "field",
    ask: "How does this format do elsewhere?",
    reads: ["census.format", "registry.rows[format=*]"],
    needs: ["census"],
    basis: "the Breakout lift for the format, 4,396 settled shorts in 57 channels",
    template: "{format} shorts outperform 3x {points} points {moreLess} often than others in the same channels (90% range {low} to {high}, {channels} channels). Descriptive: the format read is below the 0.85 accuracy a recommendation needs.",
    census: "format",
    unlock: RUN_CENSUS,
  },
  {
    id: "engagement",
    register: "field",
    ask: "Are people liking and commenting more than usual?",
    reads: ["catalog.likes", "catalog.comments", "craft.likeRate", "craft.commentRate"],
    needs: ["catalog", "craft"],
    basis: "likes and comments per view, as within-channel percentiles",
    template: "Like rate {likeRate}% ({likePct} percentile on the channel); comment rate {commentRate}% ({commentPct} percentile).",
  },
  {
    id: "first-72h",
    register: "field",
    ask: "How fast did it pick up views?",
    reads: ["velocity72.views1h", "velocity72.views6h", "velocity72.views24h", "velocity72.views72h"],
    needs: ["velocity72"],
    basis: "the polled view counts, read at 1, 6, 24 and 72 hours after publish",
    template: "{h1} views at 1 h, {h6} at 6 h, {h24} at 24 h, {h72} at 72 h.",
    unlock: TRACK,
  },
  {
    id: "curve-vs-channel",
    register: "field",
    ask: "Is it ahead of where my videos usually are?",
    reads: ["velocity72.*", "velocity72.byChannel"],
    needs: ["velocity72"],
    basis: "the channel's tracked shorts at the same hour since publish",
    template: "At {hour} h it had {views} views; the channel's tracked median at that hour is {median} ({n} shorts).",
    unlock: TRACK,
  },
  {
    id: "topic-splits",
    register: "field",
    ask: "What separates winners from the rest on this topic?",
    reads: ["topics.cluster", "findings.clusters[].splits", "findings.findings"],
    needs: ["topics"],
    basis: "paired splits in the topic's cluster, Benjamini-Hochberg q < 0.1 over 721 tests",
    template: "{finding} | No craft split in this cluster clears q < 0.1 ({pairs} pairs); the strongest is {top}.",
  },
  {
    id: "channel-format-winners",
    register: "field",
    scope: "channel",
    ask: "Do my videos that outperformed share a format?",
    reads: ["census.format", "catalog.tier", "catalog.channelId"],
    needs: ["census", "catalog"],
    basis: "the census format of every baseline short on the channel, split by tier",
    template: "Of the channel's {n} outperformers, {top}. Among the rest: {rest}.",
    census: "format",
    unlock: RUN_CENSUS,
  },
  {
    id: "channel-captions",
    register: "field",
    scope: "channel",
    ask: "How many of my shorts have captions?",
    reads: ["census.captionsBurnedIn", "catalog.channelId"],
    needs: ["census"],
    basis: "the census's captions read across the channel's baseline shorts",
    template: "{k} of {n} of the channel's shorts carry burned-in captions.",
    census: "captionsBurnedIn",
    unlock: RUN_CENSUS,
  },
  {
    id: "channel-opens",
    register: "field",
    scope: "channel",
    ask: "How many of my shorts open on text?",
    reads: ["composition.textHook", "catalog.channelId"],
    needs: ["composition"],
    basis: "OCR on the first 2 s of each of the channel's measured shorts",
    template: "{k} of {n} open with on-screen words in the first 2 s; of those, {out} outperformed 3x, against {outRest} of the rest.",
    unlock: RUN_FLASK,
  },

  {
    id: "persuade",
    register: "field",
    ask: "Will this change minds?",
    reads: ["codebook.swayable", "swayable.traits"],
    needs: ["codebook"],
    basis: "Swayable's randomized tests (575 ads): the summed difference of the traits the script carries; no single trait's 90% range clears zero",
    template: "Persuasion lean {lean} points of vote choice against a placebo, summed over the {n} traits it carries; the archive's median ad moved {median}. Largest contributions: {traits}.",
    unlock: RUN_CODEBOOK,
  },
  {
    id: "title-patterns",
    register: "field",
    ask: "Is my title built like headlines that win?",
    reads: ["codebook.upworthy.patterns", "upworthy-top.patterns"],
    needs: ["catalog"],
    basis: "Upworthy's 32,487 randomized headline tests: each pattern's share among winning and losing headlines",
    template: "It carries {patterns}. {rows} | It carries none of the ten Upworthy patterns.",
    unlock: RUN_CODEBOOK,
  },

  // ── What to do ────────────────────────────────────────────────────────────────────────────────
  {
    id: "should-ask-onscreen",
    register: "action",
    ask: "Should I put a call to action on screen?",
    reads: ["census.callToAction", "census.ctaSec", "registry.rows[callToAction]"],
    needs: ["census", "registry"],
    basis: "the registry's one recommendation: the Breakout lift for an on-screen call to action",
    template: "Shorts with an on-screen call to action outperformed 3x {points} points less often than others in the same channels (90% range {low} to {high}, {channels} channels). {here}",
    census: "callToAction",
    unlock: RUN_CENSUS,
  },
  {
    id: "when-ask",
    register: "action",
    ask: "When should I ask viewers to act?",
    reads: ["census.ctaSec", "registry.rows[callToAction]", "composition.durationSec"],
    needs: ["census", "registry"],
    basis: "the on-screen call-to-action lift; spoken asks carry no measurement",
    template: "{here} The measured lift is for asks shown on screen, mostly subscribe overlays and end cards: {points} points (90% range {low} to {high}). Asks in the spoken script are not measured.",
    census: "callToAction",
    unlock: RUN_CENSUS,
  },
  {
    id: "closer-to-mode",
    register: "action",
    ask: "How do I get closer to the winning craft?",
    reads: ["modes.full.modes[survived].center", "craft.*"],
    needs: ["modes", "craft"],
    basis: "the surviving mode's held-out lift; the gaps are this short's percentiles against the mode's center",
    template: "The furthest from the mode: {gaps}. Shorts on the mode outperformed 3x at {lift}% against {base}% on held-out channels.",
    unlock: RUN_FLASK,
  },
  {
    id: "one-change",
    register: "action",
    ask: "What one change would help most?",
    reads: ["registry.rows[recommendation]", "modes.*", "findings.findings"],
    needs: ["census", "modes"],
    basis: "the largest measured lift among changes that apply to this short",
    template: "{change} | No measured lift applies: every trait this short carries is descriptive or already on the measured side.",
    unlock: RUN_CENSUS,
  },
  {
    id: "when-post",
    register: "action",
    ask: "When should I post the next one like this?",
    reads: ["policy.mean", "policy.precision", "topics.cluster", "catalog.durationSec", "channels.family"],
    needs: ["policy", "topics"],
    basis: "the publish policy's posterior for this topic, length and channel family, fitted on 18,307 settled shorts",
    template: "Best block: {block} ET, {p}% chance to outperform 3x against {worst}% for {worstBlock}.",
  },
  {
    id: "next-length",
    register: "action",
    ask: "What length should the next one be?",
    reads: ["policy.mean", "topics.cluster", "channels.family"],
    needs: ["policy", "topics"],
    basis: "the publish policy's posterior over the four length arms for this topic and family",
    template: "{best} scores highest for this topic: {p}% chance to outperform 3x, against {worst}% at {worstLen}.",
  },
  {
    id: "next-topic",
    register: "action",
    ask: "What should my next one be about?",
    reads: ["topics.lift"],
    needs: ["topics"],
    basis: "topic lifts measured in 5+ channels, 90% range clear of zero",
    template: "Measured topics that outperform within channels: {top}. This short's topic: {mine}.",
  },
  {
    id: "more-persuasive",
    register: "action",
    ask: "What would make it more persuasive?",
    reads: ["codebook.swayable", "swayable.traits"],
    needs: ["codebook"],
    basis: "Swayable trait differences with 25+ ads; a change is recommended only where the 90% range clears zero",
    template: "{change} | No Swayable trait's 90% range clears zero, so no change is recommended. The largest point estimates this script could move: {candidates}.",
    unlock: RUN_CODEBOOK,
  },

  // ── Pass 2: a GPU read of the frames; registered, not answered here ──────────────────────────
  { id: "thumb-in-video", register: "video", pass: 2, ask: "Is my thumbnail frame actually in the video?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "a frame match of the thumbnail against the file", template: "" },
  { id: "screen-vs-said", register: "video", pass: 2, ask: "Does anything on screen contradict what's said?", reads: ["frames-gpu", "transcript.words"], needs: ["frames-gpu"], basis: "the on-screen words read against the transcript", template: "" },
  { id: "second-three-muted", register: "video", pass: 2, ask: "What would someone know by second three with the sound off?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "the text and picture of the first three seconds, read", template: "" },
  { id: "captions-readable", register: "video", pass: 2, ask: "Are my captions readable on a phone?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "caption size and contrast at phone scale", template: "" },
  { id: "speaker-first-second", register: "video", pass: 2, ask: "Am I on screen in the first second?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "a person in the frames at 0, 0.5 and 1 s", template: "" },
  { id: "paid-for-by", register: "video", pass: 2, ask: "Is the paid-for-by line on screen?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "the disclaimer read from the frames", template: "" },
  { id: "third-party-footage", register: "video", pass: 2, ask: "Does this show a news clip or someone else's footage?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "footage source read from the frames", template: "" },
  { id: "branding-seconds", register: "field", scope: "channel", pass: 2, ask: "How long is our logo on screen in each video?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "the channel's branding located frame by frame", template: "" },
  { id: "reusable-broll", register: "field", scope: "channel", pass: 2, ask: "Which of our videos have voting footage we could reuse?", reads: ["frames-gpu"], needs: ["frames-gpu"], basis: "polling places and ballots located in the frames", template: "" },
]

export const REGISTERS: { id: Register; label: string }[] = [
  { id: "video", label: "The video in hand" },
  { id: "field", label: "Against the field" },
  { id: "action", label: "What to do" },
]

export const questionById = (id: string) => QUESTIONS.find((q) => q.id === id)
/** The questions that can render as chips today: everything but pass 2. */
export const CHIP_QUESTIONS = QUESTIONS.filter((q) => q.pass !== 2)

/** The audit line, once and quietly: "read from the frames, 94 of 99 right in audit". */
export function auditLine(col: CensusColumn): string {
  const a = CENSUS_AUDIT[col]
  return `read from the frames, ${a.right} of ${a.of} right in audit${"rule" in a ? ` (${a.rule})` : ""}`
}
