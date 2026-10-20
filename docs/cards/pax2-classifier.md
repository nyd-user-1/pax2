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

The chance that a short becomes an outlier, its lifetime views at least 3x its channel's median of settled shorts, from what it carries at publish: title, description, tags, length, posting time and thumbnail. Six fitted versions, one folder each. PAX2 serves v3 when an original has a transcript and a PAX2 Encoder embedding from the index v3 was fit on; otherwise v1, its thumbnail arm when a thumbnail exists, its metadata arm otherwise.

| Folder | Version | Built | Gate | Served |
|---|---|---|---|---|
| `v1/` | var-1: metadata, and metadata plus thumbnail | 2026-10-18, refreshed 2026-10-19 | thumbnail gate passed | yes |
| `v2/` | var-2: v1's metadata plus transcript TF-IDF | 2026-10-19 | Gate C failed | no |
| `v3/` | var-3: v2's transcript features plus 32 components of the PAX2 Encoder embedding | 2026-10-20 | Gate C passed | yes, beside an embedding |
| `v3b/` | var-3b: v3 plus composition (cuts, loudness, on-screen text, title traits) | 2026-10-20 | Gate C failed | no |
| `pairwise-v0/` | Bradley-Terry on same-channel pairs, all families | 2026-10-19 | Gate P failed | no |
| `pairwise-v0-reform-votingrights/` | the same, Reform and Voting rights only | 2026-10-19 | Gate P passed | not yet |

## Scoring

Each JSON file carries every feature's `coef`, `mean` and `sd`, and the `intercept`:

```
p(outlier) = sigmoid(intercept + sum_f coef_f * (x_f - mean_f) / sd_f)
```

The pairwise files carry `features[]` with `w` and `sd` and no intercept; the short with the higher `sum_f w_f * x_f / sd_f` is the predicted winner of a same-channel pair.

v3 reads v2's transcript features (a new 400-term vocabulary over 14,438 transcripts) and `emb0`..`emb31`: the original's PAX2 Encoder embedding, of its title, description and transcript in the corpus recipe, projected as `z_j = sum_i (v_i - mean_i) * basis_ji` with `embedding.mean` and `embedding.basis` from `v3/var-model-v3.json` (PCA over the 18,455-short serving index of run 20261019-094112-train; 32 components explain 0.554 of the variance).

v1's image arm reads 12 thumbnail features: ResMem memorability, brightness, contrast, colorfulness, and 8 principal components of the CLIP ViT-B-32 (openai) image embedding. The projection is `v1/thumb-pca.json` (512-dimension mean, 8 components, from 18,544 thumbnails).

## Training

- 18,544 settled shorts from 64 political channels, 2,760 outliers (base rate 0.149); v1 refreshed 2026-10-19 with the week's newly settled shorts, same recipe
- L2 logistic regression, lambda 2.0 on standardized features, fit by Newton's method in numpy (`scripts/rig/train_var.py`)
- v2 adds the 400 most frequent unigrams and bigrams of the transcripts as TF-IDF (`scripts/classifier/train_v2.py`); 3,412 of the rows had a transcript
- pairwise: two shorts from one channel published within 45 days whose settled view ratios differ by at least 1.5x; v1's 35 features as winner-minus-loser differences, no intercept, L2 0.001, 600 steps of gradient descent (`scripts/pairwise/train.mjs`)

- v3: v2's recipe on 14,438 transcripts, plus the embedding components and a `noEmbedding` flag (`scripts/classifier/train_v3.py`); 18,307 of 18,544 rows are in the index

## Benchmark

Leave one channel out: each channel scored by a model that never saw it.

| | Pooled AUC | Within-channel AUC | Top-decile lift |
|---|---:|---:|---:|
| v1 metadata, 35 features | 0.608 | 0.550 | 1.46x |
| **v1 metadata and thumbnail, 47 features** | **0.611** | **0.566** | **1.71x** |
| v2 with transcript, 436 features | 0.597 | 0.552 | 1.47x |

Time split at 2026-07-01 (trained before, scored after): v1 metadata 0.571, v1 with thumbnail 0.571, v2 0.564. v1's rows are the 2026-10-19 refresh on 18,544 shorts; v2's are its 2026-10-19 fit on the previous set and it was not refit.

Gate C, pre-registered 2026-10-18, needed v2 at 0.624 pooled; it reached 0.597. The transcript's words, read this way, do not predict an outlier.

### v3 and v3b, read on the encoder's held-out channels

The PAX2 Encoder was fine-tuned with the outlier label on every channel except 10. On those 54 channels the embedding has already seen the label, so a pooled AUC that includes them overstates it. v3's gate and its served strength read only the 10 held-out channels (3,870 shorts, base rate 0.172, holdout split of run 20261019-094112-train), every arm leave-one-channel-out.

| Arm | Held-out AUC | Within-channel | Top-decile lift | Pooled (includes trained channels) |
|---|---:|---:|---:|---:|
| metadata | 0.596 | 0.569 | | 0.608 |
| transcript | 0.634 | 0.613 | | 0.631 |
| embedding | 0.634 | 0.615 | | 0.677 |
| **transcript and embedding (v3)** | **0.648** | **0.630** | **2.03x** | 0.671 |
| v3 plus composition (v3b) | 0.589 | 0.572 | | 0.642 |

Gate C was registered twice, both times before any full run: first (2026-10-20, commit da7ac1e) the candidate had to clear the metadata arm on the held-out rows by 0.02 and v1's 0.604; then (commit cb7ec4d), to Brendan's raised bar, above 0.604 and above the metadata arm, within-channel at least 0.55. v3 clears both: 0.648 against the metadata arm's 0.596 on the same rows (+0.052), above 0.604, within 0.630. Against the serving numbers, which are pooled over all 64 channels: v1 metadata 0.608 and thumbnail 0.611, within 0.550. v3's 0.648 sits above both, on harder rows; the thumbnail arm was not re-scored on the held-out rows. A second scorer on the Mac recomputed every arm's AUC from `predictions-v3.jsonl` and agrees to three decimals.

v3b failed: composition lowered the held-out AUC to 0.589. Media features exist only for the outlier-and-control pair set, which was picked by the label, so they cannot be read the same way on every row; on the 1,212 held-out rows that carry them, composition added 0.005 (0.596 against v3's 0.591).

Pairwise, on pairs from the 10 held-out channels:

| | Held-out pairs | Pairwise accuracy | v1 on the same pairs |
|---|---:|---:|---:|
| All families | 21,923 | 0.546 | 0.563 |
| Reform and Voting rights | 4,621 | 0.550 | 0.512 |

Gate P needed 0.02 above v1 on the same pairs. All families failed; Reform and Voting rights passed.

## Caveats

- The labels are observational and channel-relative; luck on publish day is in them.
- v2 learned its transcript arm without Partisan media, which then had no transcripts; v3's 14,438 transcripts cover every family.
- v3's embedding components are directions in the encoder's space, not named traits.
- One seed, one split per method, no tuning beyond the fixed penalties.
- Private, because the features come from YouTube titles, descriptions, thumbnails and transcripts written by the channels.
