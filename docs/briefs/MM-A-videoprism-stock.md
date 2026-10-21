# MM-A — VideoPrism stock scoring

You are window MM-A. Your job: embed every media short with stock VideoPrism, score it against the two registered bars, and report. You build the embeddings that window MM-B trains on, so your Stage 1 output is on the critical path — upload embeddings the moment they exist, before the gates are scored.

Date: 2026-10-20. The registered protocol is `docs/briefs/MULTIMODAL-SURVEY.md` (commit 4fba6d3) — read it first; this brief operationalizes it. Decision owner: Brendan. The models window monitors; it is information and arbitration, not your boss — Brendan is.

## House rules (non-negotiable)

- Nothing heavy on the Mac (8 GB): no local typechecks, no model runs, no large decodes. The Mac only rescores small JSONs.
- All compute on self-terminating EC2 boxes with a watchdog `shutdown` baked into user-data. Follow the house pattern in `scripts/composition/launch.sh` and `scripts/classifier/launch.sh` (region, IAM, disk, watchdog). Use a 300 GB gp3 root — the composition run died once on disk.
- Git: stage by explicit pathspec only, commit per step, never push.
- Never quote a number you did not measure; rehearsal-slice numbers are never quoted.
- Names: S3, EC2, Bedrock, DynamoDB — plain service names. Models are "PAX2 <kind>" in repo docs.
- Budget: you own about $6. Flag before exceeding. Message the models window via SendMessage with any flag; if unreachable, commit `docs/flags/MM-A-<topic>.md` and proceed on the conservative branch.

## Stage 1 — embed (critical path)

**Materials:** media at `s3://pax-2-638175140432/catalog-media/` (about 5,100 files; measure the real count). 5,077 shorts carry measured media in `data/generated/model/composition.json`; total 339,444 s, average 66.9 s.

**Box:** one g6e.xlarge (L40S). Install ffmpeg, JAX (cuda12), and VideoPrism from `github.com/google-deepmind/videoprism` (pip-installable; official JAX weights load from HF `google/videoprism-lvt-base-f16r288` and `google/videoprism-lvt-large-f8r288`). If JAX fights the box, the fallback is the community PyTorch port (`sposiboh/videoprism-lvt-base-f16r288-pt`) — verify its outputs match the JAX model on 5 videos before trusting it, and say which path ran.

**Registered sampling (one attempt, no tuning):** per video, sample frames evenly across the full duration — 16 frames for the base model, 8 for large — resize shorter side to 288, center-crop 288×288. One embedding per video per arm, L2-normalized. VideoPrism reads no audio; say so on the card.

**Also embed rung 0 (the control):** mean-pooled per-frame CLIP ViT-B-32 (openai, via open_clip) over the same decoded frames. Near-free since frames are already decoded; it answers "do frames beyond the thumbnail carry anything at all."

**Stream, don't hoard:** process in batches (download ~200, decode, embed, delete media; keep frames only transiently). Upload per-arm JSONL (`{id, vector}`) to `s3://pax-2-638175140432/model/video-embeddings/<runid>/` as each arm completes, and message MM-B and the models window immediately — MM-B starts training on the base arm while you score gates.

**Rehearse first** on a 1-in-20 slice end to end (decode, embed, upload, one toy fit) before the full pass. Slice numbers are never quoted.

## Stage 2 — the two gates

Split and holdout are the Composition Ranker's exactly — read `scripts/composition/fit.mjs` and `scripts/composition/pairs.mjs` for the pair construction and the 10 held-out channels (encoder run 20261019-094112-train). 2,481 pairs with media both sides; 590 of them held out.

**Gate M1 — pair read, per arm (base, large, rung 0).** PCA to 32 components, fit on training-pair videos only. Bradley–Terry logistic on standardized winner-minus-loser component differences, L2 0.001, no intercept — `scripts/pairwise/train.mjs` settings, unchanged. Read accuracy on the 590 held-out pairs with a channel-block bootstrap 95% interval. **Bar: 0.615.** Context rows on the card: composition-only 0.566, combined 0.595, Classifier v1 0.595 on the same held-out pairs.

**Gate M2 — classifier add, best M1 arm only.** `scripts/classifier/train_v3.py` pattern with a VIDEO=1 arm: v3's features plus the 32 video components, missing values at the feature mean (v3b's exact protocol). Read held-out AUC on the 10 held-out channels, and separately on the 1,212 held-out rows that carry media. **Bar: +0.02 over v3 on the same rows** (composition managed +0.005; v3 reads 0.591 on the media-carrying held-out rows).

**Verification:** upload per-pair and per-row predictions; the Mac's second scorer recomputes every arm (the `scripts/classifier/rescore.mjs` / `scripts/encoder/rescore.mjs` pattern). No number is reported that the Mac has not reproduced.

## Report

Commit: the embed script, gate scripts, bench JSONs under `data/generated/model/`, and a run card in the commit message with every arm against every bar, pass or fail stated plainly. Nothing publishes to HF from stock weights. Message the models window and MM-B with the verdict. Box terminates itself; confirm it did.
