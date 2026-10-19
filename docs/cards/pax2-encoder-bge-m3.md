---
license: mit
base_model: BAAI/bge-m3
pipeline_tag: sentence-similarity
library_name: sentence-transformers
tags:
- sentence-transformers
- youtube-shorts
datasets:
- NYSgpt/pax2-shorts-training-set
- NYSgpt/pax2-outlier-benchmark
---

# PAX2 Encoder (bge-m3)

BAAI/bge-m3 fine-tuned so that a short's title, description and transcript sit near shorts from the same channel that did as well as it did. Run `20261019-094112-train`, 2026-10-19.

```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("NYSgpt/pax2-encoder")
vectors = model.encode(["title\ndescription\ntranscript"], normalize_embeddings=True)
```

## Training

- 18,455 settled shorts from 64 political channels, 5,232 of them with a transcript (YouTube captions, then Whisper over the catalog's own audio)
- 14,573 pairs from the 14,586 training shorts, held-out channels excluded (13 shorts had no same-channel, same-tier neighbor and were skipped)
- anchor: the short's text; positives: its 3 nearest training shorts from the same channel and tier under stock bge-m3; negatives: its 5 nearest training shorts of a different tier from any channel, plus 2 at random
- FlagEmbedding `finetune.embedder.encoder_only.m3`, dense only, 1 epoch, batch 16, group 8, query 128 and passage 256 tokens, learning rate 1e-5, temperature 0.02, bf16, CLS pooling
- 910 steps in 858 seconds on one L40S (g6e.xlarge), 17.0 pairs a second; mean training loss 2.05; the run cost about $1.40

## Benchmark (`NYSgpt/pax2-outlier-benchmark`)

For each of 3,869 shorts from 10 held-out channels, the 20 nearest training shorts; the score is how well their outlier share ranks the held-out short's own outcome (kNN-AUC).

| | Stock bge-m3 | PAX2 Encoder |
|---|---:|---:|
| Pooled kNN-AUC, 3,869 held-out shorts | 0.578 | **0.608** |
| Within-channel kNN-AUC, 8 channels | 0.582 | **0.604** |

Gate E, pre-registered: pooled at least 0.02 above stock and within not below. Pooled rose 0.031, within 0.022. **Passed.**

| Family | Stock | PAX2 Encoder |
|---|---:|---:|
| Candidates & officials | 0.644 | 0.691 |
| Nonpartisan media | 0.486 | 0.510 |
| Partisan media | 0.561 | 0.571 |
| Reform | 0.485 | 0.531 |
| Voting rights (54 shorts) | 0.598 | 0.791 |

Earlier runs on fewer transcripts missed the gate: 35 transcripts (pooled +0.010) and 3,424 (+0.0198).

## Caveats

- The labels are observational and channel-relative: an outlier is a short whose lifetime views reached 3x its channel's median.
- Positives share a channel, so part of what the encoder learns is a channel's style; held-out channels test whether that carries to channels it never saw.
- One epoch, one run, no tuning.
- Private, because the training texts are YouTube titles, descriptions and transcripts written by the channels.
