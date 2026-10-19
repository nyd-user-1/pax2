---
license: apache-2.0
base_model: Alibaba-NLP/gte-reranker-modernbert-base
pipeline_tag: text-classification
library_name: sentence-transformers
tags:
- cross-encoder
- reranker
- youtube-shorts
datasets:
- NYSgpt/pax2-shorts-training-set
- NYSgpt/pax2-outlier-benchmark
---

# PAX2 Reranker (gte-reranker-modernbert-base)

A cross-encoder that re-scores PAX2 Encoder's candidates: given a short and a candidate, how alike they are in what made them do as well as they did. Run `20261019-094112-train`, 2026-10-19, trained beside `NYSgpt/pax2-encoder`.

**Gate R failed.** On this run the reranker scores below the encoder it re-ranks; PAX2 serves the encoder alone.

```python
from sentence_transformers import CrossEncoder
model = CrossEncoder("NYSgpt/pax2-reranker")
scores = model.predict([("anchor short text", "candidate short text")])
```

## Training

- the same 14,573 groups as PAX2 Encoder: the anchor short, its nearest same-channel, same-tier short, and 7 negatives (5 hard, 2 random)
- 44b's `scripts/reranker/train.py` unchanged: grouped cross-entropy, 8 groups a batch (64 pairs), max length 256, query to 600 characters and passage to 900, learning rate 2e-5, bf16, 2 epochs
- 711 seconds on one L40S

## Benchmark (`NYSgpt/pax2-outlier-benchmark`)

For each held-out short, PAX2 Encoder's 50 nearest training shorts are re-scored and the top 20 kept.

| | PAX2 Encoder | + PAX2 Reranker |
|---|---:|---:|
| Pooled kNN-AUC, 3,869 held-out shorts | 0.608 | 0.596 |
| Within-channel kNN-AUC, 8 channels | 0.604 | 0.594 |

Gate R, pre-registered: pooled at least PAX2 Encoder's and within not below. Both fell. **Failed.**

| Family | PAX2 Encoder | + PAX2 Reranker |
|---|---:|---:|
| Candidates & officials | 0.691 | 0.681 |
| Nonpartisan media | 0.510 | 0.536 |
| Partisan media | 0.571 | 0.555 |
| Reform | 0.531 | 0.575 |
| Voting rights (54 shorts) | 0.791 | 0.644 |

The reranker passed Gate R on the earlier 3,424-transcript run, when the encoder beneath it was weaker; the edge did not survive the stronger neighbors.

## Caveats

- The labels are observational and channel-relative.
- One run, no tuning.
- Private, because the training texts are YouTube titles, descriptions and transcripts written by the channels.
