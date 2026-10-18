import { MEMORABLE } from "@/lib/recipes/memorable"

// The schedule behind /project-management. Requirements are Brendan's thirteen from docs/SPEC.md,
// each with the day its work began (from the commit history), the day it is planned to close, how
// much of it stands, and the steps that close the gap, each step's share of what remains and a
// rough effort. Models take their name, progress and next step from the Memorable recipe, the one
// model inventory, and add here their dates, steps and three ratings on a 1 to 5 scale: importance
// to the loop, utility of what exists today, and ease of finishing. An item that others wait on is
// a blocker, and so is the step inside it that they wait on. Dates are absolute; finish dates and
// efforts are estimates, not measurements. Updated 2026-10-18.

export type Step = { what: string; share: number; effort: string; blocker?: boolean }
export type Item = {
  id: string
  name: string
  start: string
  end: string
  progress: number
  next: string
  steps: Step[]
  /** Ids in the same list this item waits on. */
  waits?: string[]
  /** Things outside this list it waits on, in words. */
  waitsOn?: string
  note?: string
  importance?: number
  utility?: number
  ease?: number
}

export const REQUIREMENTS: Item[] = [
  { id: "1", name: "1. Record a video, or have one made", start: "2026-10-03", end: "2026-10-31", progress: 90, next: "The Studio's render checked in Chrome and Safari, then live with the next push, an hour.",
    note: "Since 2026-10-18 a webm upload becomes an mp4 beside it (the pax2-transcode Lambda on the S3 upload event), the Studio renders its composition to an mp4 in the browser and submits it like a recording, and submitTake records the video's key with the style beside it.",
    steps: [
      { what: "The Studio's in-browser render checked in Chrome and Safari, then live on Amplify with the next push.", share: 70, effort: "an hour" },
      { what: "A ruling on Remotion's licence: the free licence, or a company key in NEXT_PUBLIC_REMOTION_LICENSE_KEY.", share: 30, effort: "a decision" },
    ] },
  { id: "2", name: "2. Scripts", start: "2026-10-03", end: "2026-10-24", progress: 90, next: "The editor's sixth check reads the coded shorts' delivery patterns too, the draft coded on Bedrock the way the library scripts were, half a day.",
    note: "Since 2026-10-18 the writer's prompt, a sixth editor check and each library script's prior read the reform channels' lifts and the coded shorts' patterns from one file, src/lib/organic-evidence.ts.",
    steps: [
      { what: "The editor's sixth check reads the delivery patterns of the coded reform shorts, which need the draft coded on Swayable's features; today it reads only what a script's words and length carry.", share: 70, effort: "half a day, a Bedrock call per check" },
      { what: "A ruling on the writer's 80-to-110-word rule, about 37 to 51 seconds, against the 20-seconds-or-shorter lift on reform channels.", share: 30, effort: "a decision" },
    ] },
  { id: "3", name: "3. A pre-release prediction", start: "2026-10-17", end: "2026-11-07", progress: 72, next: "The chain in scripts/classifier/when-captions-land.sh fires when the caption run reaches the 3,465 priority shorts, about 17:00 UTC on 2026-10-18, and launches PAX2 Classifier v2's box; Gate C decides whether originals read it.",
    steps: [
      { what: "The chain merges the captions and reruns scripts/training-set.mjs so transcripts join the Model Training Library; running detached on the Mac since 05:50 UTC on 2026-10-18.", share: 43, effort: "automatic, about 17:00 UTC on 2026-10-18" },
      { what: "PAX2 Classifier v2 with transcript features on one c7i.xlarge box, leave-one-channel-out, Gate C at pooled AUC 0.624 and within-channel 0.55, rescored on the Mac.", share: 57, effort: "automatic after the merge; about 15 minutes and 5 cents, ceiling $1" },
    ] },
  { id: "4", name: "4. Every available factor", start: "2026-10-06", end: "2026-11-30", progress: 60, next: "The worker's replacement on the S3 upload event; audio and frames through the proxy.",
    steps: [
      { what: "The worker's replacement: a Lambda on the S3 upload event running ffmpeg, Transcribe and the Pegasus call, writing features for every original.", share: 44, effort: "a day; needs approval to deploy", blocker: true },
      { what: "The residential proxy on an EC2 box, then yt-dlp for the catalog's audio and 360p video.", share: 37, effort: "Brendan opens the account; then a day" },
      { what: "The library's archives feed one combined prediction instead of separate displays.", share: 19, effort: "after PAX2 Classifier v2" },
    ] },
  { id: "5", name: "5. Automatic on save", start: "2026-10-10", end: "2026-11-14", progress: 50, next: "The S3 upload event starts the analysis; the same Lambda as 4.", waits: ["4"],
    steps: [
      { what: "The S3 upload event starts the analysis, the same Lambda as requirement 4.", share: 60, effort: "comes with 4" },
      { what: "The score runs again once the content features land, so the Scored tab shows both.", share: 30, effort: "2 hours" },
      { what: "The findings email carries the content result.", share: 10, effort: "an hour" },
    ] },
  { id: "6", name: "6. Specific recommendations", start: "2026-10-17", end: "2026-10-24", progress: 100, next: "", note: "Every change in the findings email carries its measured range, points of vote choice or of the chance of a Hit, and no promised uplift; confirmed 2026-10-18.",
    steps: [] },
  { id: "7", name: "7. Publish", start: "2026-10-08", end: "2026-11-07", progress: 10, next: "Brendan creates the YouTube channel and OAuth client; then the upload wiring, half a day.",
    steps: [
      { what: "A PAX2 YouTube channel, a Google Cloud OAuth client with the upload scope, and a refresh token in SSM.", share: 40, effort: "Brendan, an hour", blocker: true },
      { what: "videos.insert from the publish step; the returned id stored on the original.", share: 40, effort: "half a day" },
      { what: "The id written to the watch list automatically.", share: 20, effort: "an hour" },
    ] },
  { id: "8", name: "8. Versions and A/B", start: "2026-10-17", end: "2026-10-31", progress: 100, next: "", note: "Every version keeps its place in the three queues as v2 of 3, any version waiting on its owner can be published, and the Versions card sets each version's lean, chance and 72-hour reading beside the next; confirmed 2026-10-18.",
    steps: [] },
  { id: "9", name: "9. Tracked on publish", start: "2026-10-15", end: "2026-11-07", progress: 90, next: "Nothing to build; closes with the first publish.", waits: ["7"],
    steps: [
      { what: "The first publish writes velocity/watch.json.", share: 70, effort: "comes with 7" },
      { what: "The poller reads it on its next run.", share: 30, effort: "nothing to build" },
    ] },
  { id: "10", name: "10. The Model Training Library and the model", start: "2026-10-17", end: "2026-11-30", progress: 60, next: "Transcripts joined after the caption merge; Hugging Face once a new token is in SSM.",
    steps: [
      { what: "Transcripts joined for the 3,465 priority shorts, then the rest of the 18,455.", share: 33, effort: "after the caption merge; about four days for all" },
      { what: "The dataset and benchmark published to Hugging Face under NYSgpt, private, with their cards.", share: 40, effort: "a new token in SSM from Brendan, then publish.sh twice" },
      { what: "Content features for hundreds of shorts.", share: 27, effort: "after the proxy" },
    ] },
  { id: "11", name: "11. Platform usage", start: "2026-10-17", end: "2026-10-31", progress: 85, next: "Nothing to build; rows accumulate as people use the feed and the courses.",
    steps: [
      { what: "The Readers block on /dashboard shows real rows as they arrive; the first landed 2026-10-18 04:46 UTC.", share: 100, effort: "nothing to build" },
    ] },
  { id: "12", name: "12. Platform data trains the model", start: "2026-11-01", end: "2026-12-15", progress: 0, next: "Usage events accumulate first.", waits: ["11"],
    steps: [
      { what: "A usage feature per video, opens, plays and finishes, joined to the training set.", share: 50, effort: "2 hours once events exist", blocker: true },
      { what: "PAX2 Classifier retrained with it.", share: 30, effort: "an hour and a c7i box" },
      { what: "Measure whether it adds to the held-out AUC.", share: 20, effort: "30 minutes" },
    ] },
  { id: "13", name: "13. Per-user recommendations", start: "2026-11-15", end: "2026-12-31", progress: 0, next: "PAX2 Feed Ranker over usage events.", waits: ["11", "12"],
    steps: [
      { what: "PAX2 Feed Ranker v0, learning to rank over usage events.", share: 50, effort: "a day once events exist" },
      { what: "The home feed built per reader instead of one static file.", share: 40, effort: "half a day" },
      { what: "A holdout of readers to measure it.", share: 10, effort: "an hour" },
    ] },
]

// importance: how much the loop depends on it. utility: what it delivers today, at its measured
// strength. ease: how little stands between today and a finished version (data, compute, approvals).
type Plan = { start: string; end: string; importance: number; utility: number; ease: number; steps: Step[]; waits?: string[]; waitsOn?: string }
const MODEL_PLAN: Record<string, Plan> = {
  "m-writer": { start: "2026-10-03", end: "2026-10-17", importance: 5, utility: 5, ease: 5, steps: [] },
  "m-velocity": { start: "2026-10-17", end: "2026-11-30", importance: 4, utility: 5, ease: 5, steps: [
    { what: "v1 at about 1,000 settled curves; 442 today, the poller adds about 180 shorts a week.", share: 83, effort: "weeks of polling, then an hour" },
    { what: "A retrain script that reads the S3 readings directly.", share: 17, effort: "an hour" },
  ] },
  "m-classifier": { start: "2026-10-17", end: "2026-11-07", importance: 5, utility: 3, ease: 4, steps: [
    { what: "v2 with transcript features from the caption run; its chain is running and launches the box itself when the priority families land.", share: 62, effort: "automatic, about 17:00 UTC on 2026-10-18; about 5 cents" },
    { what: "Audio and frame features once files exist.", share: 38, effort: "after the proxy" },
  ] },
  "m-headline": { start: "2026-10-17", end: "2026-11-07", importance: 3, utility: 3, ease: 4, waitsOn: "a serving Lambda, Brendan's call", steps: [
    { what: "Serve v1 at request time: a Lambda with ONNX Runtime reading model-v1.onnx from S3, or a SageMaker endpoint.", share: 50, effort: "half a day; new infrastructure, Brendan's call", blocker: true },
    { what: "In the script editor: the title and opening line scored as written.", share: 35, effort: "2 hours once served" },
    { what: "The retitle suggestion in the findings scored by it.", share: 15, effort: "an hour" },
  ] },
  "m-labeler": { start: "2026-10-10", end: "2026-12-15", importance: 4, utility: 3, ease: 3, steps: [
    { what: "Three labelers per video from Teach a Model, 40 videos.", share: 40, effort: "weeks of learners" },
    { what: "Agreement between the labelers and the Bedrock codes, per trait.", share: 20, effort: "the script exists; run it" },
    { what: "A trained multi-label classifier at a few hundred labeled videos.", share: 40, effort: "an hour and a c7i box, once the labels exist" },
  ] },
  "m-encoder": { start: "2026-10-17", end: "2026-11-21", importance: 4, utility: 2, ease: 2, steps: [
    { what: "Transcripts into the corpus; 35 of 18,455 documents had one.", share: 30, effort: "30 minutes after the caption merge" },
    { what: "Retrain on one g6e.xlarge and benchmark on the same held-out channels.", share: 50, effort: "about 35 minutes and $1", blocker: true },
    { what: "Gate E again; publish the weights if it passes.", share: 20, effort: "an hour" },
  ] },
  "m-vision": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 2, ease: 3, steps: [
    { what: "Frames from downloaded video, not only the thumbnail.", share: 50, effort: "after the proxy" },
    { what: "Frame embeddings as features of PAX2 Classifier.", share: 30, effort: "an hour and a c7i box" },
    { what: "ResMem memorability measured for lift on its own.", share: 20, effort: "an hour" },
  ] },
  "m-retention": { start: "2026-10-17", end: "2026-12-31", importance: 3, utility: 2, ease: 2, waitsOn: "requirement 7", steps: [
    { what: "Retention curves from YouTube Analytics on a connected PAX2 channel.", share: 50, effort: "after requirement 7" },
    { what: "Fine-tune v0 on PAX2's own retention.", share: 40, effort: "an hour and a c7i box" },
    { what: "On the video page.", share: 10, effort: "an hour" },
  ] },
  "m-reranker": { start: "2026-10-17", end: "2026-11-21", importance: 2, utility: 1, ease: 2, waits: ["m-encoder"], steps: [
    { what: "PAX2 Encoder passes its gate first.", share: 60, effort: "waits on the encoder" },
    { what: "Retrain on the new pairs, same box.", share: 30, effort: "about 20 minutes and under $1" },
    { what: "Gate R again.", share: 10, effort: "30 minutes" },
  ] },
  "m-simulator": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 1, ease: 2, steps: [
    { what: "Fit a seed-test model to the velocity curves.", share: 60, effort: "a day, after about 1,000 curves" },
    { what: "Simulate a short's path from its first hour.", share: 30, effort: "half a day" },
    { what: "On /live-tracking beside the measured curve.", share: 10, effort: "2 hours" },
  ] },
  "m-cpc": { start: "2026-11-01", end: "2026-12-15", importance: 3, utility: 1, ease: 1, steps: [
    { what: "The catalog's audio through the proxy, about 9 GB.", share: 40, effort: "Brendan opens the account; then a day" },
    { what: "Self-supervised training on a GPU box.", share: 40, effort: "a few GPU hours, estimate $5 to $10" },
    { what: "Its features into PAX2 Classifier.", share: 20, effort: "an hour and a c7i box" },
  ] },
  "m-ranker": { start: "2026-11-15", end: "2026-12-31", importance: 3, utility: 1, ease: 2, waitsOn: "requirement 11", steps: [
    { what: "Usage events accumulate.", share: 40, effort: "after requirement 11" },
    { what: "v0, learning to rank over them.", share: 40, effort: "a day" },
    { what: "Serve the home feed from it.", share: 20, effort: "half a day" },
  ] },
}

export const MODELS: Item[] = Object.entries(MODEL_PLAN).map(([id, d]) => {
  const node = MEMORABLE.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`project-management: no model ${id} in the Memorable recipe`)
  const f = node.fields
  return { id, name: f.name, start: d.start, end: d.end, progress: Number(f.progress ?? 0), next: f.next ?? "", note: f.metrics, steps: d.steps, waits: d.waits, waitsOn: d.waitsOn, importance: d.importance, utility: d.utility, ease: d.ease }
})

/** The names of the items in the same list that wait on this one. */
export const blockedBy = (list: Item[], id: string) => list.filter((x) => x.waits?.includes(id)).map((x) => x.name.replace(/^\d+\. /, "").replace(/^PAX2 /, ""))
