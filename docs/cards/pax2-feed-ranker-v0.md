---
license: other
pipeline_tag: tabular-classification
tags:
- learning-to-rank
- kuairand
---

# PAX2 Feed Ranker v0 (pretrain on KuaiRand-1K)

Which short a given reader will watch through. Pretrained on KuaiRand-1K's randomly exposed impressions until PAX2's own reader rows (requirement 11) number in the thousands. Built 2026-10-18 on one c7i.xlarge in about seven minutes, about 2 cents.

`feed-v0.json` carries the video-plus-reader model: `features`, `weights`, `intercept`, the duration decile edges, upload types and tags. p(long view) = sigmoid(intercept + sum_f weight_f * x_f). Nothing in PAX2 serves it; the feed's For you sort runs a cold-start ranker until PAX2's own reader rows exist.

## Training

- KuaiRand-1K (Zenodo 10439422), random-exposure rows only: 41,718 impressions by 1,000 readers of 7,161 videos; label `long_view`, positive rate 0.086.
- Video features: duration decile, upload type, the 100 most frequent tags. Reader features from the reader's earlier impressions only, in time order: long-view share so far, log impressions so far, prior long-view share on the video's tags.
- Two L2 logistic regressions (C 0.1) on the same rows, video alone and video plus reader; held out by reader, 80/20, 141 held-out readers scored.

## Benchmark

| | Pooled AUC | Within-reader AUC |
|---|---:|---:|
| Video features alone | 0.578 | 0.595 |
| Video plus reader features | 0.697 | 0.553 |

Knowing the reader lifts the pooled number by 0.119 and lowers the within-reader number by 0.042. The reader features mostly tell readers apart, who watches through more in general; they do not yet tell which video a given reader will watch through, which is the question a feed ranker answers. On random exposures a reader's tag affinity has little to work with.

## What it is for

A measured starting point and a feature recipe. The reader features are the shape PAX2 will compute from its own usage rows (`scripts/usage-features.mjs`, `src/lib/usage.ts`); the within-reader AUC is the number to beat when PAX2 Feed Ranker trains on PAX2's readers.

## Caveats

- Another platform, another culture of shorts; nothing here transfers as weights.
- One seed, one split, no tuning.
- `long_view` is KuaiRand's own threshold, not a watch ratio PAX2 can reproduce exactly.
