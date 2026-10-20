# PLUM baseline and the resonance encoder — before/after ledger

Brief: `docs/briefs/OVERNIGHT-B-PLUM-RESONANCE.md` (window B, 2026-10-20). Reference: arXiv 2510.07784 (PLUM).

The "before" column was snapshotted at 2026-10-20 03:50 UTC, before any part of this work ran, from the committed model files named in each row. "After" is filled as each part lands; a metric this work does not touch reads "unchanged".

## Ledger

| Metric | Before (run, date) | After | Delta | Protocol |
|---|---|---|---|---|
| PAX2 Classifier v1, metadata, pooled AUC | 0.608 (`var-model.json`, 2026-10-19 17:15) | unchanged | — | leave-one-channel-out, 18,544 rows |
| PAX2 Classifier v1, metadata, within-channel AUC | 0.550 (same) | unchanged | — | same |
| PAX2 Classifier v1, metadata, top-decile lift | 1.46× (same) | unchanged | — | top-decile outlier rate 0.218 over base |
| PAX2 Classifier v1, image, pooled AUC | 0.611 (same) | unchanged | — | same protocol, thumbnail PCA added |
| PAX2 Classifier v1, image, within-channel AUC | 0.566 (same) | unchanged | — | same |
| PAX2 Classifier v1, image, top-decile lift | 1.71× (same) | unchanged | — | same |
| Gate C threshold (v1 held-out AUC) | 0.604 (`var-model-v2.json` parity, 2026-10-19 02:25) | unchanged | — | v2 transcript arm read 0.597, failed |
| PAX2 Encoder, stock bge-m3 kNN-AUC pooled | 0.5775 (run 20261019-094112-train) | pending | | k=20 neighbors' outlier share, 3,869 held-out docs, 8 held-out channels scored |
| PAX2 Encoder, stock bge-m3 kNN-AUC within | 0.5819 (same) | pending | | count-weighted per-channel AUC |
| PAX2 Encoder, kNN-AUC pooled (Gate E) | 0.6080 (same), +0.0305 over stock | pending | | Gate E: +0.02 pooled over stock |
| PAX2 Encoder, kNN-AUC within | 0.6035 (same), +0.0216 over stock | pending | | |
| PAX2 Reranker, pooled / within (Gate R) | 0.5960 / 0.5943 (same), failed | unchanged | — | reranks the encoder's top 50; not retrained here |
| PAX2 Headline Ranker v1, held-out pair accuracy | 0.6722 (`headline-v1.json`, 2026-10-18 06:11) | unchanged | — | 8,240 held-out Upworthy pairs; Gate H 0.6301 |
| PAX2 Velocity Classifier AUC at 1 h | 0.515 (`velocity-model.json`, 2026-10-19 17:15) | unchanged | — | leave-one-channel-out, 341 shorts, 33 positives |
| PAX2 Velocity Classifier AUC at 3 h | 0.540 (same) | unchanged | — | same |
| PAX2 Velocity Classifier AUC at 6 h | 0.729 (same) | unchanged | — | same |
| Pairwise fit, all families, held-out accuracy | 0.546 vs v1 0.563 (`pairwise-v0.json`, 2026-10-19 15:05), Gate P failed | unchanged | — | 21,923 held-out same-channel pairs |
| Pairwise fit, Reform + Voting rights, held-out accuracy | 0.550 vs v1 0.512 (`pairwise-v0-reform-votingrights.json`, 2026-10-19 15:06), Gate P passed | unchanged | — | 4,621 held-out pairs |
| Cluster lift, candidate-commitment cluster | +11.9 points over own channels (`encoder-map.json` on run 20261019-094112-train, 2026-10-19 21:16) | pending | | k-means k=40 on the serving index; 942 shorts, 37 channels |
| Cluster lift, policy-explainer cluster | −7.9 points (same) | pending | | 599 shorts, 22 channels |
| Semantic-ID uniqueness (PLUM baseline) | did not exist | pending | | Part 1 |
| Semantic-ID neighbor agreement with raw cosine | did not exist | pending | | Part 1 |
| Behavioral-neighbor coverage | did not exist | pending | | Part 2 |
| Gate B: held-out same-channel pair ranking by cosine to known outliers | did not exist | pending | | Part 3, pre-registered below |
