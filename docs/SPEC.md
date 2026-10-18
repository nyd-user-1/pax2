# PAX2 specification

Written 2026-10-17 from Brendan's brief of the same day. The brief is the requirement; this file is its working form: what each requirement means in this codebase, what already stands, what is missing, and the order the gaps close in. Dates are absolute. Update this file when a requirement's status changes, not the brief.

## The loop

Analyze published videos. Help a person make one. Score it before release and say what to change. Publish it. Track it. Rescore it against the forecast. Every step writes to one record, and that record trains a model that makes the next forecast better and the next script sharper.

## Requirements and status

Status words: **Built** works end to end today. **Partial** exists but misses part of the requirement. **Stub** the surface exists, the function does not. **Missing** nothing yet.

### 1. Record a video, or have one made — Partial

Built: the recording flow. Pick or write a script (`/recording`, `/record/library`, `/record/personal`, `/record/script`), record with the teleprompter or upload (`/record/camera`), the file goes straight to S3 by presigned URL, and the ledger opens an original (`src/lib/originals.ts`). Sign-in by Cognito; owners see their own, admins see all.

Missing: the camera-free Studio (`/record/studio`) previews a Remotion animation but never renders a file; `submitTake` records a ledger row whose key is a style name, not a video. Uploads arrive as webm; nothing converts them.

### 2. Scripts — Built, with a gap

Built: seven library scripts, each line annotated with the Swayable evidence behind it; a personal script written by Claude from three answers, on the framing scoring best so far; an editor with five research checks; a research prior per script (`data/generated/model/script-codes.json`).

Gap: the writer and the editor's checks know only the Swayable persuasion priors. They know nothing of what travels on the campaigns' own channels (the organic lifts in `data/velocity/metadata-lift.json`, the 40 coded shorts in `organic-patterns.json`).

### 3. A pre-release prediction — Partial

Built today (2026-10-17): the VAR forecast, Value Above Replacement: the chance of a Hit, at least 3x the channel median. `src/lib/forecast.ts` gives P(views at least 3x the channel's median) from the metadata a video will have at publish, trained on 18,455 settled shorts from 64 channels (`scripts/train-var.py`, `data/generated/model/var-model.json`). Not yet on any screen.

Built before: `src/lib/evaluate.ts` codes the script on Swayable's traits and sums their leans (persuasion), and reads the title against Upworthy's headline tests (virality). It runs when an original is scored.

Measured strength of the metadata forecast, leave-one-channel-out:

| Measure | Value |
|---|---|
| AUC, all channels | 0.60 (0.56 knowing only the channel's family and size) |
| AUC within a channel | 0.55 (0.50 is chance) |
| Top decile breakout rate | 21% against a 14.8% base, 1.4x |
| Reform family AUC | 0.47 on 1,196 shorts |

Reading: metadata is a weak prior and, within one channel, nearly none. The signal has to come from the video (requirement 4b) and from the first hours of the curve. Resonance as built is a paid-attention score that needs impressions from Ads Manager; it cannot be forecast for an organic short and is not the pre-release target. The targets, in order: P(breakout), then expected views as the breakout probability times the channel's median, then the paid Resonance components once a video has a flight.

### 4. Every available factor — Partial

a. Tracking and polling. Built: the velocity poller (`lambda/velocity`), 15-minute readings for 72 hours per short, 65 channels, daily baselines, the 18-month catalog with breakout labels, each video's tags, category, topics, captions and length (`meta.json`). Ten days of readings sit in S3 (2026-10-06 to 10-15). The EventBridge rule is DISABLED as of 2026-10-15 13:25 UTC. Within-channel lifts for 23 pre-publish traits are computed (`scripts/metadata-lift.mjs`).

b. Content analysis. Built: the worker (`worker/analyze_organic.py`): Transcribe word timings, Pegasus timestamped notes, measured loudness, pitch, pauses; delivery coding (energy, tone, mode, frame); Swayable coding of transcripts. 40 campaign shorts and 11 synthetic takes have it. Missing: the worker box `i-029959fd31bba9a75` no longer exists; nothing analyzes a new upload; the content model needs hundreds of analyzed shorts, not 40.

c. The library. Built: Swayable reference model, Upworthy headline patterns, Wesleyan 2022 Meta coding, Google and Meta ad library spend, Coppock 2020, emotional-ads replication data, Polis, MA district returns, polling. Shown per video on the Swayable, Upworthy and Wesleyan blocks of the video page. Gap: these inform display and the persuasion lean; none of them feeds one combined prediction.

### 5. Automatic on save — Partial

Built: `PAX2_AUTOSCORE=1` scores an original the moment it is submitted, and emails the admins. Missing: the scoring is script-only; no video analysis runs; no S3 event starts anything; the box it would start is gone.

### 6. Specific recommendations — Partial

Built: per original, up to three persuasion changes (add or drop a Swayable trait, with the line to change) and a retitle; per synthetic take with paid results, PAX2's cited findings and one to three next tests with what prompted each, what stays uncertain and how to measure it.

Built today, not on screen: `recommendations()` in `src/lib/forecast.ts` turns every measured within-channel lift for the video's family into a concrete change or a trait to keep: posting day and hour, length, description call to action and link, tags, title traits.

Missing: the findings email claims "as much as N% increase" from the best persuasion change (`upliftPct`). The reference model's own leave-one-study-out R² is about 0, as the paper found, so that line overstates. Recommendations should carry their range, not a promised uplift.

### 7. Publish — Stub

The admin's Approved, and the owner's "publish it", record a published event with three destinations and null links, and email the owner. No PAX2 channel exists; nothing uploads. `watchOnYouTube` takes a pasted link.

Needs: a PAX2 YouTube channel, a Google Cloud OAuth client with the upload scope, and a stored refresh token; then `videos.insert` from the publish step, the returned id written to the watch list.

### 8. Versions and A/B — Partial

Built: version, parent and replaced-by in the ledger; re-record from the findings email as version N+1; the Enrichment Engine's upload as the next version.

Missing: a comparison of versions side by side (evaluation deltas now, polled curves later); the queues hide a replaced parent, so two versions cannot both be published and tracked against each other.

### 9. Tracked on publish — Built, dormant

`addToWatch` writes the id to `velocity/watch.json` and the poller reads it beside the channels' uploads. The file does not exist yet because no video has reached that step, and the poller is off.

### 10. The Model Training Library and the model — Started today

Built: `scripts/training-set.mjs` assembles one row per settled short: raw inputs, pre-publish features, outcome, and the content features where a short has them. 18,455 rows, 2,739 breakouts, 35 with content. The manifest documents every field. The first model trains in 1.4 seconds on a laptop.

Missing: velocity curves joined as early-hour features (the data is in S3); content features for hundreds of shorts; the dataset and model published to Hugging Face under NYSgpt with a card and a frozen benchmark, the way `/Code/nsr` published NSR-CPT (`docs/NSR-CPT-REPORT.md` there is the template: pre-registered gates, held-out benchmark, private repos until redistribution terms are clear). Script writing stays Claude on Bedrock with this dataset as its evidence; a fine-tune is a later question once there are enough scored originals to learn from.

### 11. Platform usage — Missing

No event is recorded when someone opens a video, plays it, searches, filters, boosts or bookmarks. The feed's Boost, queue, playlist and share controls are built and unwired. The ledger pattern for it exists (`putOnce`); 44b's `answer_usage` and `chat_usage` tables are the metering shape to copy.

### 12. Platform data trains the model — Missing

Depends on 11.

### 13. Per-user recommendations — Missing

The home feed is one static file for everyone (`scripts/home-feed.mjs`). Depends on 11.

## The state of the infrastructure, 2026-10-17

| Piece | State |
|---|---|
| Amplify app `pax-2` | live, last build 2026-10-15 |
| Ledger `pax2-ledger` | 316 items; zero originals; zero mail |
| Velocity poller | rule DISABLED; last run 2026-10-15 13:25 UTC; 10 days of readings, 41 MB |
| Worker box | gone; the pipeline run button on `/dashboard` will fail |
| S3 `pax-2-638175140432` | 63 videos, 51 feature files, 0 uploads |
| SES | sandbox; verified addresses only |

No real person's video has gone through the loop yet. Making that true once, by hand if need be, comes before every refinement.

## Model names (ruled 2026-10-17)

One convention, no exceptions: the project name and the kind of model. PAX2 Classifier (the VAR model, the chance of a Hit), PAX2 Encoder, PAX2 Reranker, PAX2 Audio Encoder, PAX2 Vision Encoder (borrowed: CLIP and ResMem), PAX2 Feed Ranker, PAX2 Velocity Classifier, PAX2 Retention Regressor, PAX2 Headline Ranker, PAX2 Platform Simulator, PAX2 Trait Labeler (the language model that labels videos on Swayable's traits), PAX2GPT (a retrieval-grounded language model, rented: Claude on Bedrock behind PAX2's prompts and records; the script writer and the chat). Version delta is a computation, not a model. These names go on every card, page, file comment and commit; no nicknames.

## Decisions for Brendan

1. Turn the poller back on. It costs cents a day and the velocity data only grows while it runs. Off since 2026-10-15.
2. The worker's replacement: a Lambda (ffmpeg layer plus Transcribe and Pegasus calls) fired by the S3 upload event, or a new self-stopping box. The Lambda is the fit for one-video-at-a-time uploads. Needs approval to deploy.
3. The YouTube channel and OAuth client for publishing. Only Brendan can create these.
4. SES production access, so the findings and publish emails reach real owners.
5. Whether the findings email keeps its best-change gain line or carries the range instead.
6. The forecast on the Scored tab: show P(breakout) with its stated strength beside the persuasion lean, or hold it until the content model exists.

## Execution order

Each tranche leaves the app working. No spend without permission; no infrastructure change without a word.

1. **Spec and model** (done 2026-10-17): this file; the feature extractor; the training set; breakout model v0 with its validation; the forecast and recommendations library; parity check.
2. **Forecast on screen**: `evaluate()` calls `forecast()` and `recommendations()` on the original's title, script, length and planned publish time; the Scored tab and the findings email show them with the strength stated; the uplift line goes.
3. **Versions**: a Versions block on the video page comparing the chain; both versions publishable; the queues show the chain, not only its head.
4. **Usage events**: a `USAGE` key in the ledger, a client beacon for open, play, search, filter, boost, bookmark, and a dashboard block reading it.
5. **Publishing**: YouTube upload from the publish step once the channel and client exist; the watch list written automatically.
6. **Analysis on upload**: the worker's replacement; webm to mp4; features written for every original; the content model trained once there are enough.
7. **Velocity features**: readings from S3 joined to the training set as views at 1, 6, 24 and 72 hours; the Velocity forecast on `/live-tracking`.
8. **Publish the dataset and model**: Hugging Face under NYSgpt, private, with cards and the frozen benchmark.
9. **Per-user feed**: ranking from usage events and the model.
