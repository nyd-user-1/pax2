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

# PAX2 Reranker v0 (gte-reranker-modernbert-base)

A cross-encoder that re-scores PAX2 Encoder's candidates: given a short and a candidate, how alike they are in what made them do as well as they did. Run `20261019-022545-train`; weights from 2026-10-19 03:02 UTC (11:02 p.m. ET, 2026-10-18), when it passed Gate R.

```python
from sentence_transformers import CrossEncoder
model = CrossEncoder("NYSgpt/pax2-reranker")
scores = model.predict([("anchor short text", "candidate short text")])
```

## Training

- 18,455 settled shorts from 64 political channels, 3,424 transcripts in the corpus
- 14,573 groups: the anchor short, its nearest same-channel, same-tier short, and 7 negatives (5 hard, 2 random)
- 44b's `scripts/reranker/train.py` unchanged: grouped cross-entropy, 8 groups a batch (64 pairs), max length 256, query to 600 characters and passage to 900, learning rate 2e-5, bf16, 2 epochs
- 697 seconds on one L40S (g6e.2xlarge)

## Benchmark (`NYSgpt/pax2-outlier-benchmark`)

For each of 3,869 shorts from 10 held-out channels, the same run's PAX2 Encoder's 50 nearest training shorts are re-scored and the top 20 kept.

| | Stock bge-m3 | PAX2 Encoder (same run) | + PAX2 Reranker v0 |
|---|---:|---:|---:|
| Pooled kNN-AUC | 0.5509 | 0.5706 | **0.5717** |
| Within-channel kNN-AUC, 8 channels | 0.5437 | 0.5593 | **0.5629** |

Gate R, pre-registered: pooled at least PAX2 Encoder's and within not below. **Passed**, 2026-10-19 03:02 UTC.

| Family | Stock | PAX2 Encoder | + PAX2 Reranker v0 |
|---|---:|---:|---:|
| Candidates & officials | 0.537 | 0.607 | 0.617 |
| Nonpartisan media | 0.462 | 0.472 | 0.477 |
| Partisan media | 0.577 | 0.546 | 0.536 |
| Reform | 0.410 | 0.562 | 0.644 |
| Voting rights (54 shorts) | 0.446 | 0.717 | 0.648 |

The encoder it re-ranked missed Gate E on the same run by 0.0002 (pooled +0.0198 over stock, +0.02 required).

## Caveats

- The labels are observational and channel-relative.
- One run, no tuning.
- Private, because the training texts are YouTube titles, descriptions and transcripts written by the channels.
