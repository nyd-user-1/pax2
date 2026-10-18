---
license: other
pretty_name: PAX2 Breakout Benchmark
tags:
- youtube-shorts
- benchmark
- embeddings
---

# PAX2 Breakout Benchmark

A frozen, channel-held-out test of whether a text encoder places a short near shorts that did as well as it did. Built 2026-10-18 on `NYSgpt/pax2-shorts-training-set`.

## Task

For each of the 3,869 shorts from 10 held-out channels, take its 20 nearest training shorts by cosine; its score is the share of those 20 that broke out (at least 3x their own channel's median). The metric is the AUC of that score against the held-out short's own breakout label:

- **pooled**: over all 3,869 held-out shorts
- **within**: AUC within each held-out channel, averaged with weights by the channel's shorts, over the 8 channels with at least one breakout and one non-breakout (Voter Freedom and openDemocracy have none)

Neighbors come only from the 14,586 training shorts; no held-out channel contributes a neighbor.

## Results

| Arm | Pooled | Within |
|---|---:|---:|
| Stock bge-m3 | 0.560 | 0.557 |
| PAX2 Encoder | 0.569 | 0.560 |
| PAX2 Reranker over PAX2 Encoder's top 50 | 0.560 | 0.547 |

| Family | Shorts | Breakouts | Stock | PAX2 Encoder | PAX2 Reranker |
|---|---:|---:|---:|---:|---:|
| Candidates & officials | 1,220 | 221 | 0.530 | 0.586 | 0.610 |
| Nonpartisan media | 463 | 71 | 0.524 | 0.494 | 0.472 |
| Partisan media | 1,793 | 334 | 0.579 | 0.551 | 0.523 |
| Reform | 313 | 20 | 0.477 | 0.586 | 0.561 |
| Voting rights | 54 | 8 | 0.546 | 0.577 | 0.689 |
| UK | 26 | 0 | | | |

| Channel | Shorts | Breakouts | Stock | PAX2 Encoder | PAX2 Reranker |
|---|---:|---:|---:|---:|---:|
| Brian Tyler Cohen | 1,793 | 334 | 0.579 | 0.551 | 0.523 |
| The Democrats | 891 | 173 | 0.519 | 0.594 | 0.629 |
| The Free Press | 417 | 70 | 0.514 | 0.490 | 0.471 |
| No Labels | 223 | 20 | 0.508 | 0.607 | 0.540 |
| Gavin Newsom | 166 | 33 | 0.485 | 0.523 | 0.526 |
| Mallory McMorrow | 163 | 15 | 0.671 | 0.606 | 0.571 |
| End Citizens United | 54 | 8 | 0.546 | 0.577 | 0.689 |
| The Capitol Feed | 46 | 1 | 0.911 | 0.611 | 0.456 |
| Voter Freedom | 90 | 0 | | | |
| openDemocracy | 26 | 0 | | | |

## Gates, pre-registered

- **Gate E**: PAX2 Encoder's pooled AUC at least 0.02 above stock, within not below. Pooled +0.0099, within +0.0027. **Failed.**
- **Gate R**: PAX2 Reranker's pooled and within at least PAX2 Encoder's. Pooled −0.0092, within −0.0128. **Failed.**

Every number was computed twice: on the GPU box and again on a Mac from the uploaded neighbor lists by a separate implementation (`scripts/encoder/rescore.mjs`). The two agree to four decimals. Each bench file carries a `verified` block with the time, the corpus's 18,455 rows and its hash, and the held-out check: zero held-out shorts among the 14,573 training pairs.

## Files

`holdout.json` (channels, rule, ids, corpus hash), `heldout-ids.txt`, `bench-stock.json`, `bench-encoder.json`, `bench-reranker.json` (per channel and per family).

## Caveats

- The labels are observational and channel-relative: a breakout did well against its own channel's median, which folds in timing, distribution and the platform's own testing.
- One channel, Brian Tyler Cohen, is 46% of the held-out shorts and moves the pooled number most.
- The Capitol Feed has one breakout, so its within-channel AUC rests on a single short.
- Stock bge-m3 embeddings through TEI in fp16 vary in the fourth decimal between boxes (pooled 0.5601 and 0.5596 on two runs of the same corpus).
- Private, because the texts are YouTube titles, descriptions and transcripts written by the channels.
