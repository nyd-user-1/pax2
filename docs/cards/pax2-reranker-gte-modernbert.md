---
license: apache-2.0
base_model: Alibaba-NLP/gte-reranker-modernbert-base
pipeline_tag: text-classification
tags:
- cross-encoder
- reranker
- youtube-shorts
---

# PAX2 Reranker (gte-reranker-modernbert-base)

A cross-encoder that re-scores PAX2 Encoder's candidates: given a short and a candidate, how alike are they in what made them do as well as they did. Run `20261018-020459-train`.

**Not published.** Gate R failed; the weights stay in `s3://nsr-embed-v2/pax2/models/20261018-020459-train/reranker/`.

## Training

- the same 14,573 groups as PAX2 Encoder: the anchor short, its nearest same-channel, same-tier short, and 7 negatives (5 hard, 2 random)
- 44b's `scripts/reranker/train.py` unchanged: grouped cross-entropy, 8 groups a batch (64 pairs), max length 256, query to 600 characters and passage to 900, learning rate 2e-5, bf16, 2 epochs
- 703 seconds on one L40S

## Benchmark (`NYSgpt/pax2-outlier-benchmark`)

For each held-out short, PAX2 Encoder's 50 nearest training shorts are re-scored and the top 20 kept.

| | PAX2 Encoder | + PAX2 Reranker |
|---|---:|---:|
| Pooled kNN-AUC, 3,869 held-out shorts | 0.569 | 0.560 |
| Within-channel kNN-AUC, 8 channels | 0.560 | 0.547 |

Gate R, pre-registered: pooled at least PAX2 Encoder's and within not below. Both fell. **Failed.**

It raised Candidates & officials (0.586 to 0.610) and Voting rights (0.577 to 0.689, 54 shorts) and lowered Partisan media (0.551 to 0.523).

## Caveats

- The labels are observational and channel-relative.
- Re-ranking narrows the 20 neighbors toward shorts most like the query, which in this data tends to mean fewer breakouts (mean neighbor breakout share 0.134 before, 0.113 after).
- Private, because the training texts are YouTube titles, descriptions and transcripts written by the channels.
