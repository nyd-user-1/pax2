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
- 2026-10-22T22:09Z census batch: 5108 of 5,379 answered on S3 (vqa/raw/qwen3-vl-4b-p3/), one spot g6.2xlarge at 78.0/min.

## Report (2026-10-22)

**Set.** 5,379 shorts: the uniform baseline rebuilt from `scripts/accounting.mjs`'s sources, every one with its .mp4 in S3 (`scripts/vqa/set.mjs`). Batch hit: 5,379 of 5,379 answered, 0 errors, 0 unparsed.

**20-video verification** (hand-checked from the frames the model saw plus a frame every 2 s; `data/generated/model/vqa-verify.json`):

| column | 4B, prompt p2 | 8B, prompt p2 | 4B, prompt p3 |
|---|---|---|---|
| captions burned in | 0.65 | 0.60 | 0.95 |
| call to action | 1.00 | 0.95 | 1.00 |
| format | 0.74 | 0.84 | 0.84 |
| setting | 0.94 | 0.88 | 1.00 |
| people, most in one frame | 0.50 | 0.50 | 0.50 |
| third-party watermark | 0.63 | 0.68 | 0.79 |

The 4B missed badly on captions, people and watermark; the one retry on the 8B moved format +0.11 and watermark +0.05, lost 0.05-0.06 on captions, setting, CTA and product, left people unchanged, and ran at half the speed. The misses were the prompt's, not the model size's: p3 (captions change with the speech; the channel's own logo and mic flags are not watermarks; split screens count) ran on the 4B. p3 was tuned on these 20, so the audit below is the measure.

**Batch.** Qwen3-VL-4B-Instruct in vLLM on one spot g6.2xlarge (L4; g6e.xlarge had no spot capacity in us-east-1), 13 frames a short (0, 0.5, 1, 1.5, 2, 3 s, six across the rest, the last half second), all questions in one structured-JSON pass. 74.5 min of box life, 78 shorts a minute, GPU-bound: **$1.18, $0.22 per 1,000 shorts**, inside the $0.80-1.30 extrapolated from the 20.

**Audit, 100 shorts** stratified by the model's format x outperformed-3x, drawn fresh (none of the 20); `data/generated/model/vqa-audit.json`:

| column | n | accuracy | notes |
|---|---|---|---|
| call to action | 99 | 0.95 | precision 0.93, recall 0.90; timestamp within 2 s on 28 of 28 |
| setting | 90 | 0.92 | indoor read as studio 3 times |
| captions burned in | 99 | 0.89 | precision 1.00, recall 0.86 |
| third-party watermark | 97 | 0.86 | precision 0.64: Turning Point USA's and Crooked's own logos still flagged |
| format | 86 | 0.84 | 7 interviews (campus Q&A) read as rally |
| people, screen share (within 0.15) | 99 | 0.81 | |
| people, most in one frame | 99 | 0.36 | 0.49 within one; the model writes 1 for crowds; fails |
| product shown | 99 | 0.96 | no true product in the sample; all 4 model flags wrong; unvalidated |

On-screen text, the overlap with composition's OCR, is a cross-check, not a column: 0.77 agreement over 5,379; the model says text on 5,354, OCR on 4,099, and 1,258 of the 1,261 disagreements are model-yes, OCR-no (stylized caption fonts under OCR's confidence floor, or model over-calls).

**Lifts** (the Breakout lift, `src/lib/formulas.ts`; 4,396 settled shorts, 57 channels, 41.2% outperformed 3x; `data/generated/model/vqa-lift.json`). Measured, 90% range clear of zero, 5+ channels:

| trait | points | 90% range | channels | registry |
|---|---|---|---|---|
| call to action shown | -7.0 | -11.4 to -3.3 | 32 | **recommendation: avoid** (accuracy 0.95) |
| format: rally | -10.0 | -13.5 to -6.2 | 15 | descriptive: format accuracy 0.84 < 0.85 |
| format: b-roll | +18.2 | +11.1 to +25.7 | 14 | descriptive: same |
| format: news clip | +8.4 | +3.8 to +12.7 | 26 | descriptive: same |
| format: talking head | -5.1 | -9.0 to -1.0 | 43 | descriptive: same |
| a person in half the frames or more | +9.2 | +3.1 to +15.2 | 20 | descriptive: accuracy 0.81 |

Captions, watermark, setting, product, and the people counts cross zero. The registry (`data/generated/model/vqa-registry.json`, `scripts/vqa/registry.mjs`) holds every trait with grounds and citation; its rule was fixed at batch launch and amended once, disclosed in `data/raw/vqa/RUNLOG.md` (the 5-channel floor, added after a 500-short dry run). Turning Point USA carries 39% of the 1,597 CTA-bearing shorts (its subscribe overlay), then Abdul El-Sayed, The Free Press and Pod Save America (end cards); the comparison is within each channel, but the finding is about on-screen asks of that kind, not asks in the spoken script.

**Resonance stack** (`scripts/resonance/stack.mjs`, `data/generated/model/resonance-formula.json`). Rows: the 1,240 baseline shorts on the encoder's 10 held-out channels, the only rows neither Classifier v3 nor the pair picker trained on; leave one channel out. Held-out AUC: **stack 0.598** (within-channel 0.596) against q_c 0.584, q_h 0.582, q_x 0.575. Acceptance passes; the stack serves. Weights: b0 0.193, b_c 0.157, b_x 0.105, b_h 0.155 on the logits; no component was missing on these rows. The intercept carries the label-picked media's 44% outperform share and needs recalibration to the catalog rate before display. Future input noted: call to action shown.

**Ask a video** (`scripts/vqa/ask.mjs <id> "<question>"`, same model, up to 21 frames, free text). First ask: 380 s from launch to answer (instance start 36 s, vLLM install 102 s, model load 171 s, frame prep 0.4 s, generation 2.2 s); box life 6.8 min at $0.861/h spot: **$0.10 an ask**. The answer read the setting right and missed a small logo on the tent. Spot capacity ran out across the menu during this window, so asks fall back to on-demand g6.2xlarge ($0.98/h); after any box ends, the 8-vCPU spot quota takes about 5 min to free. A baked AMI (venv and weights on disk) would remove install and download, roughly 4 of the 6 minutes, for about $1 of build time.

**Spend.** $2.06 of the $10: nine boxes (seven 20-video runs, three of which died before answering; the batch; the ask) and the headline Lambda; `scripts/vqa/cost.mjs`, ledger `data/raw/vqa/boxes.jsonl`. Every box terminated.
