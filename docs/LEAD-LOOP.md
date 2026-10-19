# The lead loop

Standing instructions for the PAX2 lead window and for any headless fork of it that `scripts/lead/watchdog.sh` starts after a quiet hour. Written 2026-10-18 at Brendan's direction: work through every requirement and every model until none is left or every remaining one waits on him, updating the Project Management rows as each closes. Read `docs/SPEC.md`, `docs/briefs/RIG-RULES.md` and the latest `docs/HANDOFF-*.md` first if this is a fresh context.

## Rules that never relax

- Names: DynamoDB, S3, EC2, Lambda, Bedrock, never a house word; models are "PAX2 <kind>"; app copy is third person and never names a vendor or a language model.
- Nothing heavy on the Mac: Node scripts, the AWS CLI through the MCP tools, git. Everything else on a box that terminates itself, with the watchdog `shutdown` first, instance state polled until it is gone.
- Spend: Brendan set the weekend's whole budget at $10 on 2026-10-18 at 02:00 Eastern, every window and every box together. Brief 5 may spend up to $3 and Brief 7 up to $1; Brief 6 spends cents on Bedrock. The lead's own ceiling is therefore $5 across all its boxes, each launch logged with its measured cost in `~/.pax2-lead/steps.log` and the morning handoff, and the lead stops launching when the weekend's measured total reaches $9. No new standing infrastructure (no new Lambdas, rules, tables) from the lead without his word; Brief 5's window owns the one Lambda he approved.
- Git: stage by explicit pathspec and name the same paths on the commit (`git commit -m "..." -- <paths>`), since the index is shared with the other windows and a bare commit takes their staged files too (rule 30); commit per finished step; never push.
- Hooks: full-project `tsc` and `eslint`, the local dev server and local builds are blocked. Type checks are file-scoped: copy the files to the scratchpad, rewrite `@/` imports, compile with `--outDir`.
- Never quote a number that was not measured; never claim a check that was not watched.
- After every finished step: `scripts/lead/heartbeat.sh "<what>"`.

## Files other windows own tonight; do not edit them

- Brief 4 (Teach a Model): `src/app/labeling/**`, `src/lib/course.ts`, `src/lib/trait-definitions.ts`, `scripts/consensus-agreement.mjs`, the Models block of `src/app/ml/page.tsx`, the Readers block of `src/app/dashboard/page.tsx`.
- Brief 5 (Record): `lambda/transcode/**`, `scripts/transcode/**`, `src/app/actions.ts`, `src/components/original-view.tsx`, `src/app/record/studio/**`.
- Brief 6 (Scripts): `src/lib/organic-evidence.ts`, `src/app/actions.ts`, `src/app/record/script/**`, the script that writes `script-codes.json`.
- Brief 7 (Prediction): `scripts/classifier/**`, `scripts/yt-captions.sh`, `src/lib/forecast.ts`, `src/lib/evaluate.ts`, `src/components/original-view.tsx`, the findings email.

When a step needs one of those files, leave a one-line note for that window in the handoff instead and move on.

## The order

Brendan's rule for the remainder: the three windows' items first (requirements 1, 2 and 3; the lead reviews each commit as it lands, verifies it, updates its row, and fixes only what blocks it), then every other row by importance, utility and ease, the models by their three ratings in `src/lib/project-management.ts` and the requirements by the lead's reading of the same three. The three Opus windows report to the lead; their commits are the report, since their final messages go to Brendan's terminal.

1. Requirement 4 and PAX2 Velocity Classifier: join the S3 velocity readings to the training set as views at 1, 6, 24 and 72 hours (`scripts/velocity-features.mjs`, read by `scripts/training-set.mjs`), and put PAX2 Velocity Classifier on `/live-tracking` for every watched short. Node only.
2. Requirement 11: confirm one usage event lands in the DynamoDB table end to end; add the open, play, search and filter beacons.
3. Requirement 6: confirm the findings email's best-change line carries a range and no promised uplift (the email template, not `evaluate.ts`).
4. Requirement 8: both versions of a chain publishable; the queues show the chain.
5. PAX2 Headline Ranker v1: a BERT-class fine-tune on the 41,175 Upworthy pairs on one g6.xlarge, about an hour and about $1, on the `scripts/encoder` launcher pattern with a one-percent rehearsal first; the Mac re-scores held-out pairs. The library `src/lib/headline.ts` reads v1 if it beats v0's 0.61 held out.
6. PAX2 Encoder retrain once Brief 7's chain has merged the captions (`data/raw/captions/chain.log` says "EXIT=0 node scripts/captions-merge.mjs"): `node scripts/encoder/corpus.mjs --upload`, then `MODE=train ./scripts/encoder/launch.sh`, about 35 minutes and about $1.40 on a g6e.xlarge, watched to termination, re-scored on the Mac with `scripts/encoder/rescore.mjs`; Gate E as before. If Gate E passes, PAX2 Reranker on the same run.
7. PAX2 Velocity Classifier v1 when the readings allow; PAX2 Platform Simulator's fit when they allow.
8. Requirement 10: the Hugging Face publish waits on a new token in SSM; velocity and transcripts joined count toward it. Requirement 7 and PAX2 Retention Regressor wait on the channel. Requirements 12 and 13, PAX2 Feed Ranker and PAX2 Audio Encoder wait on data that does not exist yet. Note each as waiting; do not invent work for them.
9. Then the next unfinished item on either list, highest Importance first.

## After each step

Update the row: `src/lib/recipes/memorable.ts` (progress, next, status, note) and `src/lib/project-management.ts` (progress, next, steps), and the requirement's status line in `docs/SPEC.md`. Commit the step and the row update together. Run the heartbeat.

## Current state (the lead keeps this current; a fork reads it first)

Updated 2026-10-19 03:20 UTC.

- The PAX2 Encoder retrain finished: run 20261019-022545-train, g6e.2xlarge, 02:28 to 03:03 UTC, $1.33 measured. Gate E failed by 0.0002 (pooled 0.5706 against stock 0.5509, +0.0198 of the +0.02 required; within channel +0.0156); Gate R passed (reranker 0.5717 pooled, 0.5629 within, over the encoder's top 50). Mac rescore agrees with the box on all three arms, no leakage. Nothing publishes: Gate E rules, and the Hugging Face token in SSM still waits on Brendan. Cards, rows and `encoder.json` updated. The next retrain waits on the rest of the captions.
- The caption run continues on the Mac. Brendan wants it 10x faster. The one-box rehearsal (capreh-20261019-031138, t3.micro, about a cent, log in `s3://nsr-embed-v2/pax2/captions-rehearsal/`) re-measured the script header's lesson at 03:13 UTC: 0 of 24 ids answered from the EC2 IP, web and android clients both bot-walled, so no fleet of our own boxes can help. Done instead at 03:20: the download archive backfilled with 2,149 fetched ids it was missing (a restart no longer re-extracts them), and the run restarted at SLEEP=4 REQ_SLEEP=1 — the log shows a video every 8 to 10 seconds, about double the old pace, still far below the measured 429 threshold of bursts a second apart. The 10x itself is Brendan's purchase: a transcript API (about $16 to $50 for the ~16,000 remaining, an hour of parallel calls) or the residential proxy account already on his list as requirement 4's blocker.
- Brief 7's chain had merged 3,424 transcripts and trained PAX2 Classifier v2, which failed Gate C (0.597 against 0.604); the app keeps v1 by rule; `data/generated/model/var-model-v2.json` carries the run.
- PUSHED and live since about 05:30 UTC: the model-training window pushed at Brendan's instruction (remote 4237af2..b23aac5, its /privacy page on top of everything that was waiting), Amplify job 7 green. That window also carries uncommitted work in src/app/app/home, src/components/home/*, src/lib/studio-presets.ts, chat.tsx, shell.tsx, studio/page.tsx and src/components/pax-mark.tsx — theirs, hands off.
- Captions: 1,224 came through TranscriptAPI before its credits ran out (cache under `data/raw/captions-api/`, merged by `fetch-transcriptapi.mjs --merge`); Brendan refused the ~$33 top-up, rightly — the plan of record (04:20 UTC) is transcripts from our own audio: the proxy fleet fetches audio-only for every remaining catalog short (~16 GB), one GPU box runs Whisper over it (~2 GPU-hours, $3 to $6), the transcripts merge into `transcripts.json`, the corpus rebuilds and the encoder retrains. No more TranscriptAPI spend.
- Brendan is buying 10 dedicated US static-residential IPs at IPRoyal (~$27 a month); when he pastes the proxy list: credentials to SSM SecureString, a one-box 10-id rehearsal through one IP (the gate), then a fleet of about 10 t3.micro, each behind its own IP — video+audio for the 5,498-pair set, audio-only for the rest of the catalog, all to `s3://pax-2-638175140432/catalog-media/`, then the Whisper box.
- Requirement 7 is connected end to end as of 05:39 UTC: channel PAX (@PAX-DEV-TEST, UCXQimTA5x32Ne9fvyJEYK1g), OAuth client in production mode (project pax2-512104), the refresh token in SSM with Brendan's consent click. Approving a video now publishes it to PAX and watches it the same minute. Brendan's rule for the Voter Freedom back catalog: score it as originals from files and transcripts, never watch it — its early windows are past, and a re-upload would masquerade as a new publish; unlisted-never-private applies only to genuinely new publishes. The 1,224 TranscriptAPI transcripts are merged; transcripts.json holds 4,648 with text.
- The pairwise reframe (which of two same-channel shorts does better, held-out channels judging) is the lead's next build, approved hard by Brendan; pure Node on the existing 18,531 settled rows; new scripts under `scripts/pairwise/`, touching no other window's files.
- The breakout reverse-engineering set is downloading on the Mac since 03:57 UTC (`scripts/catalog-media/`): 2,749 breakouts paired with same-channel controls, strongest first, 360p and m4a per id straight to `s3://pax-2-638175140432/catalog-media/` and deleted locally; measured about 3.5 a minute, about 26 hours for all 5,498; a GPU batch-analyze run follows once a first tranche lands. An ISP-proxy box fleet would cut it to about an hour, offered to Brendan.
- Waits on Brendan: the IPRoyal proxy list (signing up now); the first approved video through publish; the Hugging Face token; labels; reader rows. The poller is on (verified 03:44 UTC) and stays on by his word.
- Spend: the lead about $1.86 measured ($0.52 on the 18th, $1.33 the encoder retrain, a cent the caption rehearsal); the weekend about $3.75 of the $10.

## Stopping

Stop when every item is done or waits on Brendan. Before stopping, write `docs/HANDOFF-<date>.md`: what closed, what is running, every box and its cost, the decisions that are his, and anything a window left unfinished.
