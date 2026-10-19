---
license: other
pipeline_tag: tabular-classification
tags:
- youtube-shorts
- logistic-regression
- political-communication
datasets:
- NYSgpt/pax2-shorts-training-set
---

# PAX2 Classifier

The chance that a short becomes an outlier, its lifetime views at least 3x its channel's median of settled shorts, from what it carries at publish: title, description, tags, length, posting time and thumbnail. Four fitted versions, one folder each. v1 is the one PAX2 serves: its thumbnail arm when a thumbnail exists, its metadata arm otherwise.

| Folder | Version | Built | Gate | Served |
|---|---|---|---|---|
| `v1/` | var-1: metadata, and metadata plus thumbnail | 2026-10-18 | thumbnail gate passed | yes |
| `v2/` | var-2: v1's metadata plus transcript TF-IDF | 2026-10-19 | Gate C failed | no |
| `pairwise-v0/` | Bradley-Terry on same-channel pairs, all families | 2026-10-19 | Gate P failed | no |
| `pairwise-v0-reform-votingrights/` | the same, Reform and Voting rights only | 2026-10-19 | Gate P passed | not yet |

## Scoring

Each JSON file carries every feature's `coef`, `mean` and `sd`, and the `intercept`:

```
p(outlier) = sigmoid(intercept + sum_f coef_f * (x_f - mean_f) / sd_f)
```

The pairwise files carry `features[]` with `w` and `sd` and no intercept; the short with the higher `sum_f w_f * x_f / sd_f` is the predicted winner of a same-channel pair.

v1's image arm reads 12 thumbnail features: ResMem memorability, brightness, contrast, colorfulness, and 8 principal components of the CLIP ViT-B-32 (openai) image embedding. The projection is `v1/thumb-pca.json` (512-dimension mean, 8 components, from 18,455 thumbnails).

## Training

- 18,455 settled shorts from 64 political channels, 2,739 outliers (base rate 0.148)
- L2 logistic regression, lambda 2.0 on standardized features, fit by Newton's method in numpy (`scripts/rig/train_var.py`)
- v2 adds the 400 most frequent unigrams and bigrams of the transcripts as TF-IDF (`scripts/classifier/train_v2.py`); 3,412 of the rows had a transcript
- pairwise: two shorts from one channel published within 45 days whose settled view ratios differ by at least 1.5x; v1's 35 features as winner-minus-loser differences, no intercept, L2 0.001, 600 steps of gradient descent (`scripts/pairwise/train.mjs`)

## Benchmark

Leave one channel out: each channel scored by a model that never saw it.

| | Pooled AUC | Within-channel AUC | Top-decile lift |
|---|---:|---:|---:|
| v1 metadata, 35 features | 0.604 | 0.550 | 1.43x |
| **v1 metadata and thumbnail, 47 features** | **0.607** | **0.564** | **1.67x** |
| v2 with transcript, 436 features | 0.597 | 0.552 | 1.47x |

Time split at 2026-07-01 (trained before, scored after): v1 metadata 0.569, v1 with thumbnail 0.567, v2 0.564.

Gate C, pre-registered 2026-10-18, needed v2 at 0.624 pooled; it reached 0.597. The transcript's words, read this way, do not predict an outlier.

Pairwise, on pairs from the 10 held-out channels:

| | Held-out pairs | Pairwise accuracy | v1 on the same pairs |
|---|---:|---:|---:|
| All families | 21,923 | 0.546 | 0.563 |
| Reform and Voting rights | 4,621 | 0.550 | 0.512 |

Gate P needed 0.02 above v1 on the same pairs. All families failed; Reform and Voting rights passed.

## Caveats

- The labels are observational and channel-relative; luck on publish day is in them.
- Partisan media carries more than half the rows and none of its shorts has a transcript, so v2's transcript arm learned from the other families.
- One seed, one split per method, no tuning beyond the fixed penalties.
- Private, because the features come from YouTube titles, descriptions, thumbnails and transcripts written by the channels.
