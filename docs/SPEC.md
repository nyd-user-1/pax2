# PAX2 specification

Written 2026-10-17 from Brendan's brief of the same day. The brief is the requirement; this file is its working form: what each requirement means in this codebase, what already stands, what is missing, and the order the gaps close in. Dates are absolute. Update this file when a requirement's status changes, not the brief.

## The loop

Analyze published videos. Help a person make one. Score it before release and say what to change. Publish it. Track it. Rescore it against the forecast. Every step writes to one record, and that record trains a model that makes the next forecast better and the next script sharper.

## Requirements and status

Status words: **Built** works end to end today. **Partial** exists but misses part of the requirement. **Stub** the surface exists, the function does not. **Missing** nothing yet.

### 1. Record a video, or have one made — Built, with a gap

Built: the recording flow. Pick or write a script (`/recording`, `/record/library`, `/record/personal`, `/record/script`), record with the teleprompter or upload (`/record/camera`), the file goes straight to S3 by presigned URL, and the ledger opens an original (`src/lib/originals.ts`). Sign-in by Cognito; owners see their own, admins see all.

Built 2026-10-18: a webm upload becomes an mp4 beside it. The `pax2-transcode` Lambda (Node 22, the `pax2-ffmpeg` layer, ffmpeg 7.0.2) runs on the S3 upload event under `uploads/`, writes `<id>.mp4` and records a `transcoded` event on the original in DynamoDB; a 5-second test clip took 1.8 to 2.1 seconds of ffmpeg, billed under 3 seconds at 2048 MB. The video page plays the mp4 once it exists and lists the conversion in the Recorded tab's History. The Studio's "Use this take" renders the Remotion composition to an H.264 mp4 in the browser (`@remotion/web-renderer`), uploads it to `uploads/<workspace>/<id>.mp4` and submits it through `submitOriginal` like a recording; `submitTake` records that key, the look and motion in `style`.

Gap: the Studio's render has not run in a browser yet (no dev server on the Mac) and goes live with the next push; Remotion's licence wants a ruling, the free licence or a company key in `NEXT_PUBLIC_REMOTION_LICENSE_KEY`.

### 2. Scripts — Built

Built: seven library scripts, each line annotated with the Swayable evidence behind it; a personal script written by Claude from three answers, on the framing scoring best so far; an editor with six research checks; a research prior per script (`data/generated/model/script-codes.json`). Since 2026-10-18 the writer, the editor and the prior also know what travels on the campaigns' own channels, read from one file, `src/lib/organic-evidence.ts` (the within-channel lifts in `data/velocity/metadata-lift.json` and the coded shorts in `organic-patterns.json`): the writer's prompt carries a Swayable section and then "What travels on these channels"; the sixth check names each trait that lifts or sinks on reform channels, its lift and range, and the line that carries it or "not present"; each library script's prior carries a channel half beside the Swayable one (`scripts/script-organic.mjs`), shown per line on the Scripts page. Before and after: `docs/briefs/evidence/brief-6-writer.md`.

Closed 2026-10-18: a seventh editor check codes the draft on Bedrock on request and sets it against the coded reform shorts' delivery patterns (`src/app/draft-actions.ts`, `patternCheck` in `src/lib/organic-evidence.ts`); the writer asks for 45 to 60 words, about 20 seconds, ruled from the reform channels' under-20-second lift of +6.5 points (90% range 1 to 13, 6 channels, 56 shorts).

### 3. A pre-release prediction — Partial, measured

Status 2026-10-18 06:00 UTC: PAX2 Classifier's chance of a Hit and the views to expect show on the Scored tab and in the findings email, with the strength of the model that answered. PAX2 Classifier v2, with transcript features, is not trained yet: `scripts/classifier/when-captions-land.sh` runs detached on the Mac and, when the caption run reaches the 3,465 reform, voting-rights and nonpartisan shorts (about 17:00 UTC on 2026-10-18), merges the captions, rebuilds the Model Training Library, launches one c7i.xlarge (about 5 cents, ceiling $1) and rescores its output on the Mac; its progress is in `data/raw/captions/chain.log`. Originals read v2, with the script as the transcript, only if Gate C passes: pooled leave-one-channel-out AUC at least 0.624 and within-channel AUC not below 0.55. Until then they read the metadata model.

Built 2026-10-17: the VAR forecast, Value Above Replacement: the chance of a Hit, at least 3x the channel median. `src/lib/forecast.ts` gives P(views at least 3x the channel's median) from the metadata a video will have at publish, trained on 18,455 settled shorts from 64 channels (`scripts/rig/train_var.py`, `data/generated/model/var-model.json`).

Built before: `src/lib/evaluate.ts` codes the script on Swayable's traits and sums their leans (persuasion), and reads the title against Upworthy's headline tests (virality). It runs when an original is scored.

Measured strength of the metadata forecast, leave-one-channel-out:

| Measure | Value |
|---|---|
| AUC, all channels | 0.60 (0.56 knowing only the channel's family and size) |
| AUC within a channel | 0.55 (0.50 is chance) |
| Top decile breakout rate | 21% against a 14.8% base, 1.4x |
| Reform family AUC | 0.47 on 1,196 shorts |

Measured again 2026-10-19 with 3,424 transcripts from YouTube's captions (PAX2 Classifier v2, `scripts/classifier/train_v2.py`): TF-IDF of the words, speaking rate and the title's overlap with the opening added nothing, pooled AUC 0.597 against 0.604 for the metadata alone, Gate C failed, the app keeps v1. Reading: metadata is a weak prior and, within one channel, nearly none. The signal has to come from the video (requirement 4b) and from the first hours of the curve. Resonance as built is a paid-attention score that needs impressions from Ads Manager; it cannot be forecast for an organic short and is not the pre-release target. The targets, in order: P(breakout), then expected views (built 2026-10-18 as the channel's median times p of a Hit's median ratio, 5.8, plus 1 - p of the rest's, 0.86; the breakout probability times the median alone would put a typical video far below its channel's median), then the paid Resonance components once a video has a flight.

### 4. Every available factor — Partial

a. Tracking and polling. Built: the velocity poller (`lambda/velocity`), 15-minute readings for 72 hours per short, 65 channels, daily baselines, the 18-month catalog with breakout labels, each video's tags, category, topics, captions and length (`meta.json`). The EventBridge rule is ENABLED again since 2026-10-17 (Brendan: it never goes off again); verified 2026-10-19 03:44 UTC, the day's poll file freshly written, 60 MB of readings in the bucket. Within-channel lifts for 23 pre-publish traits are computed (`scripts/metadata-lift.mjs`). Since 2026-10-18 the readings are joined to the Model Training Library as views at 1, 6, 24 and 72 hours (`scripts/velocity-features.mjs`; 815 shorts, 236 settled rows), and PAX2 Velocity Classifier's chance of a Hit shows on `/live-tracking` for every watched short.

b. Content analysis. Built: the worker (`worker/analyze_organic.py`) measured the 40 campaign shorts and 11 synthetic takes (Transcribe, Pegasus notes, loudness, pitch, pauses, delivery coding, Swayable coding); since 2026-10-18 every new upload is measured by the `pax2-analyze` chain (Whisper, the same audio measures, CLIP frames, memorability) on a box that starts itself and stops itself. Since 08:23 UTC the same chain reads the video through Pegasus 1.2 on Bedrock with the worker's prompt, so an upload carries its hook, energy, tone, frame and pace as the 40 shorts do. Missing: the content model needs hundreds of analyzed shorts, which wait on the catalog's audio and video through the proxy.

c. The library. Built: Swayable reference model, Upworthy headline patterns, Wesleyan 2022 Meta coding, Google and Meta ad library spend, Coppock 2020, emotional-ads replication data, Polis, MA district returns, polling. Shown per video on the Swayable, Upworthy and Wesleyan blocks of the video page. Gap: these inform display and the persuasion lean; none of them feeds one combined prediction.

### 5. Automatic on save — Built

Built: every submit scores the original the moment the button is pressed (since 2026-10-18; `PAX2_AUTOSCORE=0` turns it off for a dev session), and emails the admins. Since 2026-10-18: the upload's webm becomes an mp4 (`pax2-transcode`), the mp4 starts one self-terminating c7i.large through `pax2-analyze` (`lambda/analyze`, `scripts/rig/analyze_upload.py`), and four minutes later the original carries an `analyzed` event: Whisper transcript with word timings, loudness, pitch, pauses, CLIP frame embeddings and memorability, about a cent a video; the video page shows them and the next score reads the measured transcript. Tested on a real original at 08:04 UTC.

### 6. Specific recommendations — Built

Built: per original, up to three persuasion changes (add or drop a Swayable trait, with the line to change) and a retitle; per synthetic take with paid results, PAX2's cited findings and one to three next tests with what prompted each, what stays uncertain and how to measure it.

Built today, not on screen: `recommendations()` in `src/lib/forecast.ts` turns every measured within-channel lift for the video's family into a concrete change or a trait to keep: posting day and hour, length, description call to action and link, tags, title traits.

Done 2026-10-17, confirmed 2026-10-18: the findings email carries each change with its measured range, points of vote choice or of the chance of a Hit, and no promised uplift; the old `upliftPct` line is gone.

### 7. Publish — Built, connected, awaiting its first video

Built 2026-10-18 (`src/lib/youtube.ts`, `src/app/api/youtube/oauth/route.ts`): an admin opens the grant route, the channel's owner or an Editor signs in once, the refresh token goes to SSM and the channel to the DynamoDB table; approving a video then uploads its mp4 to that channel and writes the YouTube id to the watch list the same minute.

Connected 2026-10-19: Brendan created the channel PAX (@PAX-DEV-TEST, UCXQimTA5x32Ne9fvyJEYK1g), the OAuth client and production-mode consent screen went up (project pax2-512104), the push deployed green (Amplify job 7), and his consent click wrote the refresh token to SSM at 05:39 UTC. What remains is the first approved video; requirement 9 closes with it.

Ruled by Brendan 2026-10-19: the Voter Freedom back catalog (however many videos it is) predates PAX2 — it is scored as originals from its files and transcripts, and never enters the poller's watch list: its early windows are long past, so polling it would measure staleness, not content, and a re-upload would mint a fresh id with a reset publish date and masquerade as a new publish. It does not need re-uploading to PAX at all; if any of it lands there for display, it stays off the watch list. The unlisted-never-private rule applies only to genuinely new publishes, where publish time is now and the early window is real.

### 8. Versions and A/B — Built

Built: version, parent and replaced-by in the ledger; re-record from the findings email as version N+1; the Enrichment Engine's upload as the next version.

Built 2026-10-17, confirmed 2026-10-18: the Versions card compares the chain, lean, chance of a Hit and the 72-hour reading per version with version delta between neighbors; every version keeps its place in the queues, so two versions can both be published and tracked.

### 9. Tracked on publish — Built, dormant

`addToWatch` writes the id to `velocity/watch.json` and the poller reads it beside the channels' uploads. The file does not exist yet because no video has reached that step, and the poller is off.

### 10. The Model Training Library and the model — Started today

Built: `scripts/training-set.mjs` assembles one row per settled short: raw inputs, pre-publish features, outcome, and the content features where a short has them. 18,455 rows, 2,739 breakouts, 35 with content. The manifest documents every field. The first model trains in 1.4 seconds on a laptop.

Published 2026-10-18: the training set and the frozen benchmark on Hugging Face under NYSgpt, private, with their cards (`NYSgpt/pax2-shorts-training-set`, `NYSgpt/pax2-breakout-benchmark`), the way `/Code/nsr` published NSR-CPT. Missing: content features for hundreds of shorts; model weights go up the same way when a model passes its gate. Script writing stays Claude on Bedrock with this dataset as its evidence; a fine-tune is a later question once there are enough scored originals to learn from.

### 11. Platform usage — Built

Since 2026-10-17 every reader act writes one row to the DynamoDB table `pax2-ledger` under `USAGE#<day>` (`src/lib/usage.ts`): open, play, watched75, search, filter, sort, boost, bookmark, share, queue, and Teach a Model's course events. The first row landed 2026-10-18 04:46 UTC. The Readers block on `/dashboard` reads them. Nothing left to build; the rows accumulate.

### 12. Platform data trains the model — Missing

Depends on 11.

### 13. Per-user recommendations — Missing

The home feed is one static file for everyone (`scripts/home-feed.mjs`). Depends on 11.

## The state of the infrastructure, 2026-10-17

| Piece | State |
|---|---|
| Amplify app `pax-2` | live, last build 2026-10-15 |
| Ledger `pax2-ledger` | 316 items; zero originals; zero mail |
| Velocity poller | rule ENABLED since 2026-10-17, every 15 minutes; 60 MB of readings as of 2026-10-19 |
| Worker box | gone; the pipeline run button on `/dashboard` will fail |
| S3 `pax-2-638175140432` | 63 videos, 51 feature files, 0 uploads |
| SES | sandbox; verified addresses only |

No real person's video has gone through the loop yet. Making that true once, by hand if need be, comes before every refinement.

## Model names (ruled 2026-10-17)

One convention, no exceptions: the project name and the kind of model. PAX2 Classifier (the VAR model, the chance of a Hit), PAX2 Encoder, PAX2 Reranker, PAX2 Audio Encoder, PAX2 Vision Encoder (borrowed: CLIP and ResMem), PAX2 Feed Ranker, PAX2 Velocity Classifier, PAX2 Retention Regressor, PAX2 Headline Ranker, PAX2 Platform Simulator, PAX2 Trait Labeler (the language model that labels videos on Swayable's traits), PAX2GPT (a retrieval-grounded language model, rented: Claude on Bedrock behind PAX2's prompts and records; the script writer and the chat). Version delta is a computation, not a model. These names go on every card, page, file comment and commit; no nicknames.

## Decisions for Brendan

1. Done 2026-10-17: the poller is back on, and Brendan's word is it never goes off again.
2. The worker's replacement: a Lambda (ffmpeg layer plus Transcribe and Pegasus calls) fired by the S3 upload event, or a new self-stopping box. The Lambda is the fit for one-video-at-a-time uploads. Needs approval to deploy.
3. Done 2026-10-19: the channel PAX, the OAuth client, and the grant — publishing is connected.
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
