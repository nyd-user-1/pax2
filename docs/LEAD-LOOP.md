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
6. PAX2 Velocity Classifier v1 when the readings allow; PAX2 Platform Simulator's fit when they allow.
7. Requirement 10: the Hugging Face publish waits on a new token in SSM; velocity and transcripts joined count toward it. Requirement 7 and PAX2 Retention Regressor wait on the channel. Requirements 12 and 13, PAX2 Feed Ranker and PAX2 Audio Encoder wait on data that does not exist yet. Note each as waiting; do not invent work for them.
8. Then the next unfinished item on either list, highest Importance first.

## After each step

Update the row: `src/lib/recipes/memorable.ts` (progress, next, status, note) and `src/lib/project-management.ts` (progress, next, steps), and the requirement's status line in `docs/SPEC.md`. Commit the step and the row update together. Run the heartbeat.

## Stopping

Stop when every item is done or waits on Brendan. Before stopping, write `docs/HANDOFF-<date>.md`: what closed, what is running, every box and its cost, the decisions that are his, and anything a window left unfinished.
