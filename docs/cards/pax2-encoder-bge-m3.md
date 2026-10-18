---
license: mit
base_model: BAAI/bge-m3
pipeline_tag: sentence-similarity
tags:
- sentence-transformers
- youtube-shorts
---

# PAX2 Encoder (bge-m3)

BAAI/bge-m3 fine-tuned so that a short's title, description and transcript sit near shorts from the same channel that did as well as it did. Run `20261018-020459-train`.

**Not published.** Gate E failed; the weights stay in `s3://nsr-embed-v2/pax2/models/20261018-020459-train/encoder/`.

## Training

- 14,573 pairs from the 14,586 training shorts of `NYSgpt/pax2-shorts-training-set`, held-out channels excluded (13 shorts had no same-channel, same-tier neighbor and were skipped)
- anchor: the short's text; positives: its 3 nearest training shorts from the same channel and tier under stock bge-m3; negatives: its 5 nearest training shorts of a different tier from any channel, plus 2 at random
- FlagEmbedding `finetune.embedder.encoder_only.m3`, dense only (no unified fine-tuning, no self-distillation), 1 epoch, batch 16, group 8, query 128 and passage 256 tokens, learning rate 1e-5, temperature 0.02, bf16, CLS pooling
- 910 steps in 823 seconds on one L40S (17.7 pairs a second); mean training loss over the epoch 2.07
- batch 16 ran out of memory on an L4 and, without `expandable_segments`, on the L40S; it was never reduced

## Benchmark (`NYSgpt/pax2-breakout-benchmark`)

| | Stock bge-m3 | PAX2 Encoder |
|---|---:|---:|
| Pooled kNN-AUC, 3,869 held-out shorts | 0.560 | 0.569 |
| Within-channel kNN-AUC, 8 channels | 0.557 | 0.560 |

Gate E, pre-registered: pooled at least 0.02 above stock and within not below. Pooled rose 0.0099. **Failed.**

By family it helped Candidates & officials (0.530 to 0.586) and Reform (0.477 to 0.586), and hurt Partisan media (0.579 to 0.551) and Nonpartisan media (0.524 to 0.494).

## Caveats

- The labels are observational and channel-relative.
- Positives share a channel, so part of what the encoder learns is a channel's style; held-out channels test whether that carries to channels it never saw, and on the largest one it did not.
- One epoch, one run, no tuning.
- Private, because the training texts are YouTube titles, descriptions and transcripts written by the channels.
