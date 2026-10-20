# PLUM, composition: the before/after ledger

Brief: `docs/briefs/OVERNIGHT-C-PLUM-COMPOSITION.md` (window C, 2026-10-20). Same ledger shape as `docs/PLUM-RESONANCE.md`. The "before" column was snapshotted at 07:03 UTC from the committed model files, before any composition work ran. A metric this work does not touch reads "unchanged"; at 08:25 UTC no standing model file had moved since the snapshot.

## Standing metrics

| Metric | Before (run, date) | After | Delta | Protocol |
|---|---|---|---|---|
| PAX2 Classifier v1, metadata, pooled AUC | 0.608 (`var-model.json`, 2026-10-19 17:15) | unchanged | — | leave-one-channel-out, 18,544 settled shorts |
| PAX2 Classifier v1, metadata, within-channel AUC | 0.550 (same) | unchanged | — | same |
| PAX2 Classifier v1, metadata, top-decile lift | 1.46× (same) | unchanged | — | same |
| PAX2 Classifier v1, image, pooled AUC | 0.611 (same) | unchanged | — | same, thumbnail features added |
| PAX2 Classifier v1, image, within-channel AUC | 0.566 (same) | unchanged | — | same |
| PAX2 Classifier v1, image, top-decile lift | 1.71× (same) | unchanged | — | same |
| Gate C threshold | 0.604 (v2 failed at 0.597, 2026-10-19) | unchanged | — | held-out AUC must beat v1 |
| PAX2 Encoder, Gate E pooled kNN-AUC | 0.6080 vs stock 0.5775 (20261019-094112-train) | unchanged | — | 20 nearest, 10 held-out channels, 3,869 docs |
| PAX2 Encoder, within-channel kNN-AUC | 0.6035 vs stock 0.5819 (same) | unchanged | — | same |
| PAX2 Reranker, pooled / within | 0.5960 / 0.5943, Gate R failed (same) | unchanged | — | over the encoder's top 50 |
| PAX2 Velocity Classifier, AUC at 1 h | 0.515 (`velocity-model.json`, 2026-10-19 17:15, 341 curves) | unchanged | — | leave-one-channel-out |
| PAX2 Velocity Classifier, AUC at 3 h | 0.540 (same) | unchanged | — | same |
| PAX2 Velocity Classifier, AUC at 6 h | 0.729 (same) | unchanged | — | same; 33 Hits, swings |
| Pairwise fit, Reform + Voting rights, held out | 0.550 vs v1's 0.512 (pairwise-0, 2026-10-19 15:06), Gate P passed | unchanged | — | 4,621 held-out pairs |
| Pairwise fit, all families, held out | 0.546 vs v1's 0.563 (pairwise-0, 2026-10-19 15:05), Gate P failed | unchanged | — | 21,923 held-out pairs |
| PAX2 Headline Ranker v1, held-out accuracy | 0.6722 (headline-1, 2026-10-18) | unchanged | — | 8,240 held-out Upworthy pairs |
| Cluster lift, top multi-channel cluster | +11.9 pts, cluster 7, 942 shorts, 37 channels (map on 20261019-094112-train) | unchanged | — | points above each short's own channel's outlier rate |
| Cluster lift, bottom multi-channel cluster | −7.9 pts, cluster 0, 599 shorts, 22 channels (same) | unchanged | — | same |
| Semantic-ID uniqueness | not measured at snapshot | unchanged by this work | — | window B's row |

## Composition rows

| Metric | Before | After | Delta | Protocol |
|---|---|---|---|---|
| Shorts with media features | 0 | 5,075 of 5,106 with media (31 without a usable video) | new | run composition-20261020-070925, c7i.4xlarge, 69 min, 0 errors |
| Pairs measured on both sides, video / audio | 0 | 2,481 / 2,473 of 2,770 | new | breakout with its nearest-in-time same-channel control |
| Shorts with speech timing | 0 | 8,077 (2,904 pair ids) | new | caption and Whisper word times; the transcript API's 1,224 excluded (word times are word indices) |
| Speech share of audible seconds | 0 | 2,711 shorts | new | needs both audio and word times |
| Headline traits | 0 | 19,036 (every catalog short) | new | length, question, digit, all-caps run, emoji |
| Text overlay | 0 | 5,075 shorts | new | OCR at one frame a second, words of 2+ alphanumerics at confidence 60+ |
| Emotion | — | not measured | — | |
| Win/loss tests | 0 | 721 eligible (20+ pairs), 7 findings at BH q < 0.10 | new | sign test on the paired difference, `composition-findings.json` |
| Finding: first cut, whole catalog | — | breakouts 5.4 s vs controls 6.3 s; 2,481 pairs; breakout earlier in 55% of differing pairs; q 0.0002 | new | 64 channels |
| Finding: length, cluster 8 | — | 20 s vs 40 s; 31 pairs; breakout shorter in 81%; q 0.094 | new | 4 channels |
| Finding: cut rate, cluster 3 | — | 0.23 vs 0.17 cuts/s; 224 pairs; 68%; q 0.0002 | new | 1 channel: that channel's audience, not a content finding |
| Finding: loudness range, cluster 3 | — | 7.6 vs 5.4 LU; 224 pairs; 66%; q 0.0006 | new | 1 channel |
| Finding: first cut, cluster 23 | — | 10.5 s vs 38.6 s; 43 pairs; 79%; q 0.031 | new | 1 channel |
| Finding: length, cluster 33 | — | 15 s vs 23 s; 69 pairs; 71%; q 0.092 | new | 1 channel |
| Finding: question in title, cluster 14 | — | 20% vs 36%; 174 pairs; breakout lower in 71%; q 0.094 | new | 1 channel |
| Headline traits across the catalog | — | no split (every q ≥ 0.63) | new | 2,770 pairs |
| PAX2 Composition Ranker, composition only, held-out pair accuracy (Gate X ≥ 0.55) | did not exist | 0.566, passed (95% interval 0.528 to 0.604) | new | 666 pairs on the encoder's 10 held-out channels; with media both sides 0.568 (590) |
| Same, leave-one-channel-out | did not exist | 0.525 | new | all 2,770 pairs; the 10-channel holdout flatters it |
| PAX2 Composition Ranker, combined, held-out pair accuracy (Gate X ≥ 0.55) | did not exist | 0.595, passed (0.557 to 0.632) | new | composition plus encoder kNN outlier share and outlier cosine margin, neighbors from other training channels only |
| Same, leave-one-channel-out | did not exist | 0.574 | new | |
| PAX2 Classifier v1 ordering the same 666 held-out pairs | 0.595 | unchanged | — | the combined ranker ties it, does not beat it |

Both rankers are published private as `NYSgpt/pax2-composition-ranker` and are in the PAX collection. The second attempt fixed in `scripts/composition/fit.mjs` was not needed.
