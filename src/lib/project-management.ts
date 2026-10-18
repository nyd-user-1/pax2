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
  { id: "2", name: "2. Scripts", start: "2026-10-03", end: "2026-10-24", progress: 100, next: "",
    note: "The writer, the editor's six checks and each library script's prior read the reform channels' lifts and the coded shorts' patterns; the editor codes a draft on Bedrock on request and sets it against the coded shorts' delivery; the writer's length is 45 to 60 words, ruled 2026-10-18 from the under-20-second lift.",
    steps: [    ] },
  { id: "3", name: "3. A pre-release prediction", start: "2026-10-17", end: "2026-11-07", progress: 72, next: "Resume the caption run, then Brief 7's chain trains PAX2 Classifier v2 on one c7i.xlarge, about 10 cents; both were stopped at Brendan's word at 08:33 UTC on 2026-10-18 with 2,211 of 3,465 priority shorts fetched.",
    note: "The chance of a Hit and the views to expect are on the Scored tab and in the findings email with the model's strength stated; v2 with transcripts waits on the caption run.",
    steps: [
      { what: "Resume the captions: ./scripts/yt-captions.sh on the ids not yet fetched (2,149 caption files are on disk; done.txt is written from now on), then nohup ./scripts/classifier/when-captions-land.sh, which merges, rebuilds the training set and launches the box.", share: 60, effort: "about 4 hours of fetching, then 30 minutes and 10 cents" },
      { what: "Gate C read: pooled LOCO AUC at least 0.624 and within-channel not below 0.55; the Scored tab shows v2 if it passes.", share: 40, effort: "automatic in the chain; 30 minutes to read" },
    ] },
  { id: "4", name: "4. Every available factor", start: "2026-10-06", end: "2026-11-30", progress: 92, next: "Audio and frames for the catalog through the proxy, Brendan's account.",
    note: "Tracking and polling run, the readings are in the Model Training Library, every upload is measured by the pax2-analyze chain since 2026-10-18 (Whisper, audio, CLIP frames, memorability, Pegasus reading the video), and the library's archives feed the forecast and the writer.",
    steps: [
      { what: "The residential proxy on an EC2 box, then yt-dlp for the catalog's audio and 360p video, then the same measurements for thousands of shorts.", share: 100, effort: "Brendan opens the account; then a day and about $30 to $70 of bandwidth", blocker: true },
    ] },
  { id: "5", name: "5. Automatic on save", start: "2026-10-10", end: "2026-11-14", progress: 100, next: "", note: "Submit scores the script on Bedrock at once; the upload's webm becomes an mp4, the mp4 starts a box, and four minutes later the original carries its transcript, audio measures, frames and memorability; the next score reads the measured transcript. Proven on two real originals 2026-10-18.",
    steps: [] },
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
  { id: "10", name: "10. The Model Training Library and the model", start: "2026-10-17", end: "2026-11-30", progress: 75, next: "Transcripts joined after the caption merge; content features for hundreds of shorts after the proxy.",
    steps: [
      { what: "Transcripts joined for the 3,465 priority shorts, then the rest of the 18,455.", share: 55, effort: "after the caption merge; about four days for all" },
      { what: "Content features for hundreds of shorts.", share: 45, effort: "after the proxy" },
    ] },
  { id: "11", name: "11. Platform usage", start: "2026-10-17", end: "2026-10-31", progress: 100, next: "", note: "Every reader act writes one row to the DynamoDB table; the first landed 2026-10-18 04:46 UTC and the Readers block on /dashboard reads them.",
    steps: [] },
  { id: "12", name: "12. Platform data trains the model", start: "2026-11-01", end: "2026-12-15", progress: 40, next: "Retrain PAX2 Classifier with the usage feature once a few thousand reader acts exist; the join runs today.", waits: ["11"],
    note: "scripts/usage-features.mjs counts every reader act per video from the DynamoDB table and scripts/training-set.mjs joins them as each row's usage; built 2026-10-18 on the rows so far.",
    steps: [
      { what: "A few thousand reader acts in the table.", share: 50, effort: "readers; nothing to build", blocker: true },
      { what: "PAX2 Classifier retrained with the usage feature.", share: 30, effort: "an hour and a c7i box" },
      { what: "Measure whether it adds to the held-out AUC.", share: 20, effort: "30 minutes" },
    ] },
  { id: "13", name: "13. Per-user recommendations", start: "2026-11-15", end: "2026-12-31", progress: 30, next: "PAX2 Feed Ranker v0 pretrains on KuaiRand today; the reader's own plays join the For you sort when rows exist.", waits: ["11", "12"],
    note: "The feed's For you sort already ranks by recency, ratio to the channel's median and PAX2 readers' opens and plays (src/lib/feed-rank.ts); it is one ranking for every reader until the rows exist to tell readers apart.",
    steps: [
      { what: "The reader's own opens and plays weigh their feed: a per-reader affinity by channel and family, the shape PAX2 Feed Ranker v0 learned on KuaiRand.", share: 50, effort: "half a day once rows exist" },
      { what: "PAX2 Feed Ranker trained on PAX2's rows.", share: 40, effort: "a day at a few thousand rows" },
      { what: "A holdout of readers to measure it.", share: 10, effort: "an hour" },
    ] },
]

// importance: how much the loop depends on it. utility: what it delivers today, at its measured
// strength. ease: how little stands between today and a finished version (data, compute, approvals).
type Plan = { start: string; end: string; importance: number; utility: number; ease: number; steps: Step[]; waits?: string[]; waitsOn?: string }
const MODEL_PLAN: Record<string, Plan> = {
  "m-velocity": { start: "2026-10-17", end: "2026-11-30", importance: 4, utility: 5, ease: 5, steps: [
    { what: "v1 at about 1,000 settled curves; 332 qualify today, the poller adds about 180 shorts a week; the refresh runs with MODE=full PREFIX=model/<name>/ JOBS=velocity ./scripts/rig/launch-cpu.sh.", share: 100, effort: "weeks of polling, then 3 cents and ten minutes" },
  ] },
  "m-classifier": { start: "2026-10-17", end: "2026-11-07", importance: 5, utility: 3, ease: 4, steps: [
    { what: "v2 with transcript features from the caption run; its chain is running and launches the box itself when the priority families land.", share: 62, effort: "automatic, about 17:00 UTC on 2026-10-18; about 5 cents" },
    { what: "Audio and frame features once files exist.", share: 38, effort: "after the proxy" },
  ] },
  "m-headline": { start: "2026-10-17", end: "2026-11-07", importance: 3, utility: 3, ease: 4, steps: [] },
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
    { what: "Frames from downloaded video, not only the thumbnail.", share: 62, effort: "after the proxy" },
    { what: "Frame embeddings as features of PAX2 Classifier.", share: 38, effort: "an hour and a c7i box" },
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
    { what: "Fit a seed-test model to the velocity curves; sim-0 describes 442 today.", share: 60, effort: "a day, after about 1,000 curves" },
    { what: "Simulate a short's path from its first hour.", share: 30, effort: "half a day" },
    { what: "On /live-tracking beside the measured curve.", share: 10, effort: "2 hours" },
  ] },
  "m-cpc": { start: "2026-11-01", end: "2026-12-15", importance: 3, utility: 1, ease: 1, steps: [
    { what: "The catalog's audio through the proxy, about 9 GB.", share: 40, effort: "Brendan opens the account; then a day" },
    { what: "Self-supervised training on a GPU box.", share: 40, effort: "a few GPU hours, estimate $5 to $10" },
    { what: "Its features into PAX2 Classifier.", share: 20, effort: "an hour and a c7i box" },
  ] },
  "m-ranker": { start: "2026-10-18", end: "2026-12-31", importance: 3, utility: 1, ease: 2, waitsOn: "reader rows", steps: [
    { what: "A few thousand reader rows in the DynamoDB table.", share: 40, effort: "readers; nothing to build", blocker: true },
    { what: "PAX2 Feed Ranker trained on PAX2's rows with v0's reader-feature recipe; beat 0.595 within reader.", share: 40, effort: "a day and a c7i box" },
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
