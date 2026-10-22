# Window Q — the question machine

The point of this window is **ask-a-video-a-question**: stand up a model that can answer any question about any video we hold. The fixed-question batch over the uniform baseline is the first, priced use of that machine; the on-demand ask path is a required deliverable, not an extra. Runs independent of every other window; budget **$5, hard cap** — flag before exceeding.

## The set

The complete-baseline videos: every catalog short with transcript, media in S3, composition, and a serving-index embedding (the accounting page's arithmetic — rebuild the sets from `scripts/accounting.mjs`'s sources, do not hardcode a count). Media: `s3://pax-2-638175140432/catalog-media/<id>.mp4`.

## The model and the cost shape (approved)

- `Qwen/Qwen3-VL-4B-Instruct`, free weights, on one **spot** GPU box (g6e.xlarge class), self-terminating, the house box pattern (`scripts/composition/launch.sh` is the reference rig).
- All questions in **one pass per video**; sample few frames (dense only in the hook seconds); measure cost on 20 videos before the batch and extrapolate in the log.
- Verify first: 20 hand-checked videos. If the 4B misses badly, one retry on 8B — state the delta.

## The questions (fixed, typed)

The census FLAG items in `docs/roadmap/roadmap-1.html` ("For the platform"): captions burned in (y/n), call to action shown (y/n + timestamp), format (talking head / graphic card / b-roll / rally / news clip / interview), setting (indoor / outdoor / studio / archival), people on screen (count and screen share only — never identity, never demographics), product shown (y/n), third-party watermark (y/n). Where a column overlaps an existing composition measurement (on-screen text), it is a cross-check, not a new column — report agreement.

## After the batch

1. Hand-audit 100 stratified videos; every column ships with its measured accuracy.
2. Merge columns into the census the way `scripts/composition/merge.mjs` merges — one definition per column.
3. Measure each new column's association with outperformed-3× using the repo's feature-lift formula (grep for it; same arithmetic as the existing findings).
4. Write the recommendation registry: variable, grounds, citation — only measured lifts mint recommendations; the rest stay descriptive.
5. Fit and validate the Resonance stack exactly as `docs/RESONANCE.md` registers it — the logistic over the three instrument components on the uniform baseline, held out by channel, the acceptance rule honored, the fitted weights and held-out AUC written to `data/generated/model/resonance-formula.json`. Each audited new column with measured lift is noted as a future stack input.
6. The on-demand path: `scripts/vqa/ask.mjs <id> "<question>"` — same model, one video, any question; document its cost per ask and its latency honestly (box spin-up included). This is the seed of ask-about-this-video; no product surface in this brief.

## Rules

- No identity or demographic inference from faces or voices — counts and screen share only.
- Commit by explicit path; **do not push**. No local typechecks. Budget flag before any overage.
- Every box self-terminates with a watchdog; log to S3; no silent fails — the run log states hit-or-miss against the set's count.

## Report

Append `## Report`: the measured 20-video verification, batch cost and duration, per-column accuracy from the audit, lifts found, and what the on-demand ask costs.

## Progress

- 2026-10-22T21:53Z census batch: 3860 of 5,379 answered on S3 (vqa/raw/qwen3-vl-4b-p3/), one spot g6.2xlarge at 78.0/min.
