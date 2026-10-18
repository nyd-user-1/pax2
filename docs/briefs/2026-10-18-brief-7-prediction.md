# Brief 7: Requirement 3, A pre-release prediction

Written 2026-10-18 by the lead window for an executing window. Brendan has authorized one c7i.xlarge box for PAX2 Classifier v2, about 30 minutes, about 10 cents, ceiling $1, and nothing beyond it. The box self-terminates. Do not spawn subagents. Do not push. Stage by explicit pathspec; other windows commit to this tree. Nothing heavy runs on the Mac: Node scripts, the AWS CLI and git only.

## Read first

`AGENTS.md`, `/Users/brendanstanton/.claude/CLAUDE.md`, `docs/SPEC.md` (requirement 3, the model names), `docs/briefs/RIG-RULES.md` in full, `docs/HANDOFF-2026-10-18.md` (the caption run and the hooks section), `docs/briefs/2026-10-17-brief-1-cpu-models.md` (how Brief 1 ran train_var.py on a box), `scripts/rig/launch-cpu.sh`, `scripts/rig/run-all.sh`, `scripts/rig/train_var.py`, `scripts/training-set.mjs`, `scripts/captions-merge.mjs`, `scripts/yt-captions.sh`, `src/lib/forecast.ts` (`modelFor`, how the image model is chosen; v2 follows the same shape), `src/lib/evaluate.ts` (`videoInputOf`, the forecast block of the result), `src/components/original-view.tsx` (the Scored tab's forecast block), `data/generated/model/var-model.json` (the shape v2 must keep), `data/generated/model/training-set.manifest.json`.

Names: the real service every time. The model is PAX2 Classifier; v2 is PAX2 Classifier with transcript features.

## What stands

PAX2 Classifier v1 forecasts the chance of a Hit from metadata, LOCO AUC 0.604, within channel 0.55; on the Scored tab and in the findings email with its strength stated. The caption run on this Mac (`scripts/yt-captions.sh`, 8-second pacing) is fetching YouTube's auto-captions for the catalog, reform channels first: 325 of the 3,465 priority shorts at 03:20 UTC on 2026-10-18, about 3.3 a minute, so the priority families finish about 19:00 UTC. Transcripts are the content signal the spec says the forecast needs.

## Part A: the chain that runs itself when the captions land

A1. Fix `scripts/yt-captions.sh` for future runs: add `--force-write-archive` so `done.txt` is written under `--skip-download`. Do not restart the running process. Measure progress by `grep -c "Extracting URL" data/raw/captions/run.log`.

A2. `scripts/classifier/when-captions-land.sh`: a loop that checks every 10 minutes whether the extracted count has reached 3,465 (the priority families) or the run has ended; when it has, it runs `node scripts/captions-merge.mjs`, then `node scripts/training-set.mjs`, uploads `data/generated/model/training-set.jsonl` and `data/generated/transcripts.json` to `s3://pax-2-638175140432/model/v2/<run>/`, launches the box in A3, and writes every step and exit code to `data/raw/captions/chain.log`. Started once, detached, with `nohup`, before this window ends. It must survive the window closing.

A3. `scripts/classifier/launch.sh` and `box.sh` on the `scripts/encoder/launch.sh` pattern: one c7i.xlarge, `shutdown -h +45` first, pull the training set and transcripts from S3, run `scripts/rig/train_var.py` extended with transcript features, upload `var-model-v2.json`, the per-row predictions for the held-out channels, and the log, then shut down. Gate C, pre-registered here: pooled LOCO AUC at least 0.624 (v1 0.604 plus 0.02) and within-channel AUC not below 0.55. Transcript features, in this order of trying, each reported: a TF-IDF of unigrams and bigrams into the same L2 logistic regression; word rate and length from the transcript; the title's overlap with the transcript's first ten seconds. Shorts without a transcript keep their metadata features and a missing-transcript flag; they are not dropped, since the forecast must work for a recording whose transcript came from its script.

A4. `scripts/classifier/rescore.mjs` on the Mac re-computes the AUC from the box's held-out predictions, the second scorer of rule 25, and prints both numbers side by side. It runs as the last step of the chain.

## Part B: the app reads v2

B1. `src/lib/forecast.ts`: `modelFor` returns the transcript model when a transcript is supplied and Gate C passed, as it does for the image model; `videoInputOf` in `evaluate.ts` passes the original's script text as its transcript, since the recording's words are the script. The kind shown becomes "metadata", "image" or "transcript".

B2. The Scored tab states the strength of whichever model answered, the numbers from the model file, never typed in.

B3. Expected views beside the probability: the breakout chance times the channel's median, with the median's source named. For an original without a channel, the catalog median, as `evaluate.ts` already carries it.

B4. The findings email shows the same two numbers.

## Report

Commit per part, subjects in this repository's prose style, file-scoped type checks before each (copy the files to the scratchpad, rewrite `@/` imports, compile with `--outDir`; full-project `tsc` and `eslint` are blocked by hooks, and so are the local dev server and local builds). Before the window ends, confirm the chain is running (`pgrep -fl when-captions-land`) and say so. When done, tell Brendan in a few lines what was built, what is still running, what it will cost, what was left out, and how you ruled anything the brief left open. Then update `docs/SPEC.md` requirement 3's status line and requirement 3's entry in `src/lib/project-management.ts` and `m-classifier` in `src/lib/recipes/memorable.ts` to what is true.
