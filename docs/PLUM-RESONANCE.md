# PLUM baseline and the resonance encoder — before/after ledger

Brief: `docs/briefs/OVERNIGHT-B-PLUM-RESONANCE.md` (window B, 2026-10-20). Reference: arXiv 2510.07784 (PLUM).

The "before" column was snapshotted at 2026-10-20 07:00 UTC, before any part of this work ran, from the committed model files named in each row. "After" is filled as each part lands; a metric this work does not touch reads "unchanged".

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
| Semantic-ID uniqueness, 40/64/64 (PLUM baseline) | did not exist | 0.306 (5,654 of 18,455 alone on their ID; 9,087 distinct IDs; largest collision 90) | new | residual k-means on serving index 20261019-094112-train, `semantic-ids.json` |
| Semantic-ID uniqueness, 40/128/128 and 40/256/256 | did not exist | 0.452 and 0.541 | new | same, sweep only; not written |
| Semantic-ID neighbor agreement with raw cosine (share of raw top-10 sharing the code) | did not exist | c1 0.811 (chance 0.035), c1c2 0.384 (0.0024), full ID 0.130 (0.0003) | new | 40/64/64; recall@10 on reconstructed vectors 0.193; mean cosine raw to reconstructed 0.925 |
| Semantic-ID level 1 against the cluster map's k=40 | did not exist | NMI 0.862, adjusted Rand 0.717 | new | the map clusters PCA-50 of the same index with its own seed |
| PAX2 Semantic-ID Model, Gate S attempt 1, pooled / within AUC | did not exist | 0.5584 / 0.5711, failed (bar 0.5775) | −0.0192 vs stock | `semantic-id-model.json`; codebooks fit on training docs only; c1c2 cell share, hard backoff to c1 under 20 docs (2,388 of 3,869 backed off) |
| PAX2 Semantic-ID Model, Gate S attempt 2, pooled / within AUC | did not exist | 0.5708 / 0.5709, failed | −0.0068 vs stock | same codebooks; c1c2 share shrunk toward c1 with 20 pseudo-docs; the last attempt the brief allows |
| Behavioral-neighbor coverage, any signal | did not exist | 8,924 of 18,544 settled shorts (48.1%); 7,005 of 14,719 training shorts have a training-side neighbor | new | `co-occurrence.json`, cap 10 per signal |
| (a) co-outlier coverage | did not exist | 2,731 shorts, 58,307 pairs; 2,089 training shorts with a training-side neighbor | new | same channel, within 45 days, both outliers; 2,760 outliers in all |
| (b) co-surge coverage | did not exist | 8,809 shorts, 31,741 pairs (9,532 cross-channel; 255 with both crossings measured) | new | same ISO week at the 1x line, same k=40 cluster; 99 crossings measured by the poller, 9,121 dated by publish (proxy) |
| (c) co-commenter coverage | did not exist | 0 | new | no commenter identities stored in PAX2 |
| Gate B: held-out same-channel pair ranking by cosine to known outliers | did not exist | pending | | Part 3, pre-registered below |

## Part 1 — semantic IDs (`scripts/plum/semantic_ids.py`, Mac, 22 s, no spend)

Level 1 takes 82% of the embedding energy (mean squared residual 1.0 → 0.184); levels 2 and 3 take another 2.5 and 1.5 points (→ 0.159 → 0.144). The space is tightly packed: the median short's nearest neighbor sits at cosine 0.92, 3,657 shorts have a neighbor at 0.95 or above, and only 816 at 0.98 or above (`scripts/plum/dupes.py`) — so near-twin texts explain little of the 69% that share an ID; the residual codebooks do. PLUM reports 91.8–96.7% uniqueness on its own learned quantizer and corpus; the two are not comparable numbers, and this one is the floor later versions answer to.

## Part 2 — the behavioral table (`scripts/plum/co-occurrence.mjs`, Mac, no spend)

The settled set read 18,544 rows tonight (the brief's 18,531 was an earlier training-set build). Co-surge is mostly a proxy: the poller has read 858 shorts over 12 days, and only 99 of them crossed their channel median inside 72 hours; the other 9,121 crossings are dated by publish week because the catalog's settled ratio says a short crossed, not when. Co-commenter is empty: PAX2 has never stored who commented. Held-out channels carry 3,825 settled shorts under the pinned holdout; no pair touching one is used in training.

The holdout is pinned at `data/generated/model/plum/holdout.json` (from git 2910dbb, the one run 20261019-094112-train was judged on): window A's corpus rebuild at 07:06 UTC rewrote `encoder/holdout.json`, moving 89 ids, after this table was first built against it. Rebuilt on the pinned file; Gate B's before numbers reproduced exactly.

## Part 1b — the PAX2 Semantic-ID Model (`scripts/plum/semantic_id_model.py`, Mac, no spend)

The quantizer as a predictor: a held-out short scores the outlier share of the training shorts in its (c1, c2) cell. Codebooks are fit on the 14,586 training shorts only; the 3,869 held-out shorts are assigned to them. Gate S (pooled AUC above stock bge-m3's 0.5775) failed both allowed attempts, 0.5584 then 0.5708. A 40-way, then 64-way cell table carries less than the 20 nearest neighbors do: the encoder's own kNN score reads 0.6080 on the same shorts, stock's 0.5775. Within-channel, both attempts (0.571) sit between stock (0.582) and below the encoder (0.604). The model is recorded and not served.
