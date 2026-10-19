# Handoff, 2026-10-18 morning, written at 08:30 UTC

For Brendan and the next lead window. Read `docs/SPEC.md`, then `docs/LEAD-LOOP.md` (its current-state section is kept current), then this. Everything below is measured unless marked estimate. The boards at `/project-management` carry each row's state; this is the night in one place.

## Overnight, by requirement

| | Was | Now | What closed it |
|---|---|---|---|
| 1 Record | 60 | 90 | Brief 5: `pax2-transcode` (webm to mp4, Lambda with the ffmpeg layer), `submitTake` fixed; the Studio render is built and waits on a browser check and the push |
| 2 Scripts | 80 | 100 | Brief 6 plus the lead: the writer, six checks and the priors read the organic lifts and the coded shorts; a seventh check codes a draft on Bedrock; the writer asks for 45 to 60 words, ruled from the under-20-second lift |
| 3 Prediction | 60 | 72 | Brief 7: the app reads v2 with its strength and expected views; the chain waits on the captions |
| 4 Every factor | 50 | 92 | Velocity readings joined; the `pax2-analyze` chain measures every upload (Whisper, audio, CLIP frames, memorability, Pegasus); the proxy remains |
| 5 Automatic on save | 50 | 100 | Submit scores at once; the upload's mp4 starts a box; four minutes later the original carries its content |
| 6 Recommendations | 85 | 100 | Confirmed: every change carries its range, no promised uplift |
| 7 Publish | 10 | 10 | Your channel and OAuth client |
| 8 Versions | 70 | 100 | Confirmed: queues show every version, any can publish, the Versions card compares |
| 9 Tracked | 90 | 90 | Closes with the first publish |
| 10 Training Library | 55 | 75 | Velocity and usage joined; both datasets on Hugging Face; transcripts join tonight |
| 11 Usage | 70 | 100 | First row landed 04:46 UTC; every act wired |
| 12 Platform data trains | 0 | 40 | The join exists (`scripts/usage-features.mjs`); rows to come |
| 13 Per-user | 0 | 30 | The For you sort stands; PAX2 Feed Ranker v0 pretrained |

## Overnight, by model

- PAX2 Headline Ranker v1: trained on one L4 in 13.5 minutes, held-out pairwise 0.672 against v0's 0.610, Gate H passed, published private as `NYSgpt/pax2-headline-ranker`, served from the `pax2-headline` Lambda (ONNX Runtime), scoring the editor's opening line as it is typed against 10,452 held-out Upworthy headlines, and the findings' retitle. 100.
- PAX2 Velocity Classifier: on `/live-tracking` for every watched short; refreshed on 332 curves, AUC 0.877 at six hours, 0.903 within channel. 75; v1 waits for about 1,000 curves.
- PAX2 Platform Simulator: sim-0 refreshed on 442 curves. 30.
- PAX2 Feed Ranker v0: pretrained on KuaiRand-1K; reader history lifts the pooled AUC to 0.697 and lowers within-reader to 0.553; the number to beat is 0.595. 30.
- PAX2 Vision Encoder: memorability alone measured at AUC 0.484, below chance. 52.
- PAX2 Classifier: v2 trains tonight from the caption chain. PAX2 Encoder and PAX2 Reranker: retrain after the merge, about $1.40.
- Datasets: `NYSgpt/pax2-breakout-benchmark` and `NYSgpt/pax2-shorts-training-set`, private, every file checked against the source.

## Stopped at 08:33 UTC, at Brendan's word

The caption run (2,211 of 3,465 extracted, 2,149 files on disk), Brief 7's chain, the lead's waiter, the watchdog and caffeinate were all stopped; no AWS box is running. The encoder retrain and PAX2 Classifier v2 wait on a resumed caption run. Resume steps are in `docs/LEAD-LOOP.md`.

## What was running until then

- The caption run on this Mac: 1,473 of 3,465 priority shorts, about 3.7 a minute, done about 17:30 UTC. Brief 7's chain (`data/raw/captions/chain.log`) then merges, rebuilds the training set, launches one c7i.xlarge for PAX2 Classifier v2 and re-scores.
- The lead's waiter on that log starts the PAX2 Encoder retrain after the merge; the hourly launchd fork is the fallback.
- `caffeinate` and the watchdog under `~/Library/LaunchAgents/com.pax2.*`.

## New standing pieces in AWS

`pax2-transcode` (Brief 5), `pax2-analyze` (one c7i.large per uploaded mp4, about a cent plus Pegasus about 4 cents), `pax2-headline` (ONNX Runtime, idle costs nothing), the `pax2-ffmpeg` and `pax2-onnxruntime` layers, the `pax2-analyze` and `pax2-headline` roles, and two S3 notifications on `uploads/`. Every box self-terminates.

## Spend, measured from run times

Lead: two L4 runs $0.31; five c7i.xlarge CPU boxes about $0.08; three t3.small publishes under 3 cents; three analysis boxes about 3 cents plus one Pegasus call about 4 cents; the feed box about 2 cents. About $0.50. Brief 5's two t3.small about 2 cents; Brief 7's box tonight about 10 cents; the encoder retrain about $1.40. The weekend including Brief 3's $1.39 and Brief 1's $0.25: about $2.3 so far, about $3.8 after tonight, of the $10.

## Evening, 2026-10-18

Pushed at 23:46 UTC; Amplify job 6 built clean in 3 minutes 37 seconds; production runs 4237af2. Brendan recorded on the live site through the teleprompter and the flow worked end to end up to Send. Since then, committed and not pushed: the teleprompter paces the reader word by word (space or tap pauses); requirement 7's publish step is written (grant route, upload on approval, watch-list write) and waits on the Google OAuth client and a channel's grant; the For you sort carries the reader's own channel affinity. The caption run resumed at 21:19 UTC and the chain with it.

## Yours

1. Push again when you want the teleprompter, the publish step and the affinity term live.
2. The Google OAuth client, its id and secret in the Amplify environment, `scripts/youtube/grant.sh --apply`, and the channel's grant at /api/youtube/oauth: requirements 7 and 9, and the retention model's real data.
3. The residential proxy account, credentials into SSM: requirement 4's last step, requirement 10's content features, PAX2 Vision Encoder frames, PAX2 Audio Encoder.
4. Labelers for Teach a Model: PAX2 Trait Labeler. One labeler on two videos so far.
5. SES production access, unchanged.

## Lessons

- Rig rule 30: name the paths on the commit; the index is shared between windows.
- `run-all.sh` skips a job whose outputs exist under the prefix; a refresh needs `PREFIX=model/<name>/`. Two boxes were wasted learning it, about 2 cents.
- S3 notifications take a minute or two to go live after they are written.
- The box scores under bf16; ONNX runs fp32; parity is 0.02 with identical order, not four decimals.
