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
  /** Models only: what the model does, in plain words. */
  func?: string
  /** Models only: why it matters to the loop. */
  value?: string
  /** Models only: the checkpoint training began from, bare (as it reads on Hugging Face), or "from scratch". */
  base?: string
  /** Models only: task tags the way a model hub tags them (what kind of model this is). */
  tags?: string[]
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
  { id: "1", name: "1. Record a video, or have one made", start: "2026-10-03", end: "2026-10-31", progress: 95, next: "The Studio's render checked in Chrome and Safari, then live with the next push, an hour.",
    note: "Since 2026-10-18 a webm upload becomes an mp4 beside it (the pax2-transcode Lambda on the S3 upload event), the Studio renders its composition to an mp4 in the browser and submits it like a recording, and submitTake records the video's key with the style beside it. Remotion stays on the free licence, ruled 2026-10-19; revisit at scale.",
    steps: [
      { what: "The Studio's in-browser render checked in Chrome and Safari, then live on Amplify with the next push.", share: 100, effort: "an hour" },
    ] },
  { id: "2", name: "2. Scripts", start: "2026-10-03", end: "2026-10-24", progress: 100, next: "",
    note: "The writer, the editor's six checks and each library script's prior read the reform channels' lifts and the coded shorts' patterns; the editor codes a draft on Bedrock on request and sets it against the coded shorts' delivery; the writer's length is 45 to 60 words, ruled 2026-10-18 from the under-20-second lift.",
    steps: [    ] },
  { id: "3", name: "3. A pre-release prediction", start: "2026-10-17", end: "2026-11-07", progress: 85, next: "The embedding model passed its gate at 5,232 transcripts (0.608 against stock 0.578); its neighbors become the forecast feature next, and the fleet is landing audio and frames.",
    note: "The chance of a Hit and the views to expect are on the Scored tab and in the findings email with the model's strength stated. PAX2 Classifier v2 trained 2026-10-19 on 3,424 transcripts and failed Gate C: the words, read as a linear model reads them, added nothing to the title, length and posting time (pooled AUC 0.597 against 0.604), so the app keeps v1 by rule.",
    steps: [
      { what: "PAX2 Classifier v3 reads each original's PAX2 Encoder embedding with its transcript (Gate C passed 2026-10-20, 0.648 on held-out channels); the forecast uses it once an upload's neighbors step has run.", share: 40, effort: "done 2026-10-20" },
      { what: "Audio and frame features; the fleet is landing the catalog's files this morning.", share: 40, effort: "a measurement run after the fleet" },
      { what: "The forecast at hour 1, 3 and 6 after publish, the velocity model's call, shown on the video page beside the pre-release number.", share: 20, effort: "half a day, no spend" },
    ] },
  { id: "4", name: "4. Every available factor", start: "2026-10-06", end: "2026-11-30", progress: 94, next: "The fleet is downloading the catalog now; the content measurements run once the files land.",
    note: "Tracking and polling run, the readings are in the Model Training Library, every upload is measured by the pax2-analyze chain since 2026-10-18 (Whisper, audio, CLIP frames, memorability, Pegasus reading the video), and the library's archives feed the forecast and the writer. The residential proxy account opened 2026-10-19: 20 static residential IPs at $6 a month, 14 of them past YouTube's wall, credentials in SSM.",
    steps: [
      { what: "The 20-box residential-IP fleet is fetching the catalog's audio and 360p video now (2,936 of 5,498 pairs at 09:52 UTC); then the same measurements for thousands of shorts.", share: 100, effort: "about $0.25 of EC2 for the pair set; the measurement boxes after" },
    ] },
  { id: "5", name: "5. Automatic on save", start: "2026-10-10", end: "2026-11-14", progress: 100, next: "", note: "Submit scores the script on Bedrock at once; the upload's webm becomes an mp4, the mp4 starts a box, and four minutes later the original carries its transcript, audio measures, frames and memorability; the next score reads the measured transcript. Proven on two real originals 2026-10-18.",
    steps: [] },
  { id: "6", name: "6. Specific recommendations", start: "2026-10-17", end: "2026-10-24", progress: 100, next: "", note: "Every change in the findings email carries its measured range, points of vote choice or of the chance of a Hit, and no promised uplift; confirmed 2026-10-18.",
    steps: [] },
  { id: "7", name: "7. Publish", start: "2026-10-08", end: "2026-11-07", progress: 90, next: "The first approved video goes out to the connected channel; requirement 9 closes with it.",
    note: "Connected end to end 2026-10-19: Brendan created the channel PAX (@PAX-DEV-TEST), the Google OAuth client and consent screen went up in production mode, the build deployed green, and the channel's refresh token reached SSM at 05:39 UTC with the consent click. Approving a video now uploads its mp4 to PAX and puts the YouTube id on the poller's watch list the same minute.",
    steps: [
      { what: "The first approved video published and watched; requirement 9 closes with it.", share: 100, effort: "one approval" },
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
  { id: "13", name: "13. Per-user recommendations", start: "2026-11-15", end: "2026-12-31", progress: 50, next: "PAX2 Feed Ranker trained on PAX2's own reader rows at a few thousand; the affinity term is live and waiting for them.", waits: ["11", "12"],
    note: "The feed's For you sort ranks by recency, ratio to the channel's median, PAX2 readers' opens and plays, and since 2026-10-18 the reader's own opens and plays by channel (src/lib/feed-rank.ts), the reader-by-channel affinity PAX2 Feed Ranker v0 measured on public logs; one ranking for every reader until the rows exist to tell readers apart.",
    steps: [
      { what: "A few thousand reader rows, so the affinity term has history to read.", share: 40, effort: "readers; nothing to build", blocker: true },
      { what: "PAX2 Feed Ranker trained on PAX2's rows; beat 0.595 within reader.", share: 45, effort: "a day at a few thousand rows" },
      { what: "A holdout of readers to measure it.", share: 15, effort: "an hour" },
    ] },
]

// importance: how much the loop depends on it. utility: what it delivers today, at its measured
// strength. ease: how little stands between today and a finished version (data, compute, approvals).
type Plan = { start: string; end: string; importance: number; utility: number; ease: number; steps: Step[]; waits?: string[]; waitsOn?: string; func: string; value: string; base: string; tags: string[] }
const MODEL_PLAN: Record<string, Plan> = {
  "m-velocity": { start: "2026-10-17", end: "2026-11-30", importance: 4, utility: 5, ease: 5,
    func: "Reads a short's first hours of views and calls whether it will break out.",
    value: "The earliest warning after publish; drives /live-tracking and the hour-1/3/6 forecast.",
    base: "from scratch", tags: ["Tabular classification"],
    steps: [
    { what: "v1 at about 1,000 settled curves; 332 qualify today, the poller adds about 180 shorts a week; the refresh runs with MODE=full PREFIX=model/<name>/ JOBS=velocity ./scripts/rig/launch-cpu.sh.", share: 100, effort: "weeks of polling, then 3 cents and ten minutes" },
  ] },
  "m-classifier": { start: "2026-10-17", end: "2026-11-07", importance: 5, utility: 3, ease: 4,
    func: "Scores a video before release: the chance of a Hit from title, length and posting time.",
    value: "The pre-release number on the Scored tab and in the findings email.",
    base: "from scratch", tags: ["Tabular classification"],
    steps: [
    { what: "v3 passed Gate C 2026-10-20: 14,438 transcripts and 32 PAX2 Encoder components, 0.648 AUC on the encoder's 10 held-out channels against the metadata arm's 0.596 on the same rows, within-channel 0.630, top-decile lift 2.03x; serving beside each original's embedding, published private.", share: 62, effort: "done 2026-10-20, about 2 cents" },
    { what: "v3b with composition failed Gate C (0.589): media features exist only on the label-picked pair set. Composition waits on media for the whole catalog.", share: 38, effort: "after the media fleet" },
  ] },
  "m-headline": { start: "2026-10-17", end: "2026-11-07", importance: 3, utility: 3, ease: 4,
    func: "Scores a headline on its own; two scores pick the stronger title.",
    value: "Title choice before publish, measured 0.61 held out.",
    base: "bert-base-uncased", tags: ["Text ranking"],
    steps: [] },
  "m-labeler": { start: "2026-10-10", end: "2026-12-15", importance: 4, utility: 3, ease: 3,
    func: "Codes a video's traits (hook, tone, delivery) the way trained labelers do.",
    value: "Scales human trait-reading to the whole catalog once a few hundred labels exist.",
    base: "unchosen", tags: ["Multi-label classification"],
    steps: [
    { what: "Three labelers per video from Teach a Model, 40 videos.", share: 40, effort: "weeks of learners" },
    { what: "Agreement between the labelers and the Bedrock codes, per trait.", share: 20, effort: "the script exists; run it" },
    { what: "A trained multi-label classifier at a few hundred labeled videos.", share: 40, effort: "an hour and a c7i box, once the labels exist" },
  ] },
  "m-encoder": { start: "2026-10-17", end: "2026-11-21", importance: 4, utility: 3, ease: 4,
    func: "Embeds title, description and transcript so that similar means performs similarly, not talks alike.",
    value: "A draft script borrows the measured track record of the videos it most resembles.",
    base: "BAAI/bge-m3", tags: ["Text embeddings"],
    steps: [
    { what: "Gate E PASSED 2026-10-19 at 5,232 transcripts (pooled 0.608 against stock 0.578, +0.0305 of the +0.02 required; within +0.0216); published private on Hugging Face as NYSgpt/pax2-encoder.", share: 50, effort: "done 2026-10-19" },
    { what: "Retrain 2026-10-20 at 9,289 transcripts missed Gate E by 0.0002 (pooled 0.602 against stock 0.582, +0.0198; within +0.0186; holdout split rebuilt 07:06 UTC, same 10 channels); the 2026-10-19 model keeps serving. The full-corpus retrain the same day (14,855 transcripts, same split) missed further: +0.0123 pooled, as both stock and the encoder fell with more transcript text. Next: a corpus recipe that keeps title and description inside the cap.", share: 0, effort: "about $1.48 a run" },
    { what: "Its neighbors become the forecast feature on requirement 3.", share: 50, effort: "half a day" },
  ] },
  "m-vision": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 2, ease: 3,
    func: "Embeds thumbnails, and frames once the videos exist, as visual features.",
    value: "Visual signal into the hit predictor beyond words and metadata.",
    base: "CLIP ViT-B-32 (openai)", tags: ["Image embeddings", "borrowed as-is"],
    steps: [
    { what: "Frames from downloaded video, not only the thumbnail.", share: 62, effort: "after the proxy" },
    { what: "Frame embeddings as features of PAX2 Classifier.", share: 38, effort: "an hour and a c7i box" },
  ] },
  "m-retention": { start: "2026-10-17", end: "2026-12-31", importance: 3, utility: 2, ease: 2, waitsOn: "requirement 7",
    func: "Predicts where viewers drop off through a video's run.",
    value: "Edit guidance: cut where the predicted curve falls.",
    base: "from scratch", tags: ["Curve regression"],
    steps: [
    { what: "Retention curves from YouTube Analytics on a connected PAX2 channel.", share: 50, effort: "after requirement 7" },
    { what: "Fine-tune v0 on PAX2's own retention.", share: 40, effort: "an hour and a c7i box" },
    { what: "On the video page.", share: 10, effort: "an hour" },
  ] },
  "m-reranker": { start: "2026-10-17", end: "2026-11-21", importance: 2, utility: 1, ease: 2, waits: ["m-encoder"],
    func: "Rereads the embedding model's top 50 matches as full text pairs and reorders them.",
    value: "Sharper neighbors for the same forecast; its gate is already passed.",
    base: "gte-reranker-modernbert-base", tags: ["Text ranking", "cross-encoder"],
    steps: [
    { what: "Gate R FAILED on the 5,232-transcript run (0.596 pooled against the passing encoder's 0.608): the earlier edge did not survive the stronger neighbors. Retrain against them, or retire. On the 2026-10-20 run it scored 0.610 pooled over an encoder that missed Gate E, so it waits on a passing encoder.", share: 100, effort: "a retrain ride-along on the next encoder run, or a ruling" },
  ] },
  "m-simulator": { start: "2026-10-17", end: "2026-12-15", importance: 2, utility: 1, ease: 2,
    func: "Fits a seed-and-test model to view curves and plays a short's path forward from hour one.",
    value: "What-if before and just after publish, beside the measured curve on /live-tracking.",
    base: "from scratch", tags: ["Curve simulation"],
    steps: [
    { what: "Fit a seed-test model to the velocity curves; sim-0 describes 442 today.", share: 60, effort: "a day, after about 1,000 curves" },
    { what: "Simulate a short's path from its first hour.", share: 30, effort: "half a day" },
    { what: "On /live-tracking beside the measured curve.", share: 10, effort: "2 hours" },
  ] },
  "m-cpc": { start: "2026-11-01", end: "2026-12-15", importance: 3, utility: 1, ease: 1,
    func: "Learns audio features from the catalog's sound alone, no labels needed.",
    value: "Delivery and sound signal into the hit predictor.",
    base: "from scratch", tags: ["Audio embeddings", "self-supervised"],
    steps: [
    { what: "The catalog's audio through the proxy, about 9 GB.", share: 40, effort: "Brendan opens the account; then a day" },
    { what: "Self-supervised training on a GPU box.", share: 40, effort: "a few GPU hours, estimate $5 to $10" },
    { what: "Its features into PAX2 Classifier.", share: 20, effort: "an hour and a c7i box" },
  ] },
  "m-ranker": { start: "2026-10-18", end: "2026-12-31", importance: 3, utility: 1, ease: 2, waitsOn: "reader rows",
    func: "Ranks the home feed for each reader from their opens and plays.",
    value: "Per-reader recommendations once reader rows exist.",
    base: "from scratch", tags: ["Recommendation"],
    steps: [
    { what: "A few thousand reader rows in the DynamoDB table.", share: 40, effort: "readers; nothing to build", blocker: true },
    { what: "PAX2 Feed Ranker trained on PAX2's rows with v0's reader-feature recipe; beat 0.595 within reader.", share: 40, effort: "a day and a c7i box" },
    { what: "Serve the home feed from it.", share: 20, effort: "half a day" },
  ] },
}

export const MODELS: Item[] = Object.entries(MODEL_PLAN).map(([id, d]) => {
  const node = MEMORABLE.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`project-management: no model ${id} in the Memorable recipe`)
  const f = node.fields
  return { id, name: f.name, start: d.start, end: d.end, progress: Number(f.progress ?? 0), next: f.next ?? "", note: f.metrics, steps: d.steps, waits: d.waits, waitsOn: d.waitsOn, importance: d.importance, utility: d.utility, ease: d.ease, func: d.func, value: d.value, base: d.base, tags: d.tags }
})

/** The names of the items in the same list that wait on this one. */
export const blockedBy = (list: Item[], id: string) => list.filter((x) => x.waits?.includes(id)).map((x) => x.name.replace(/^\d+\. /, "").replace(/^PAX2 /, ""))
