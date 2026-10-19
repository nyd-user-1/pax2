---
license: other
pipeline_tag: tabular-regression
tags:
- ridge-regression
- watch-time
- kuairand
---

# PAX2 Retention Regressor v0 (pretrain on KuaiRand-1K)

How much of a short a viewer watches, play time over duration capped at 1, from its length, upload type and tags. Pretrained on KuaiRand-1K's randomly exposed impressions until a connected PAX2 channel supplies YouTube Analytics retention. Built 2026-10-18.

## Scoring

`retention-v0.json` carries `coef` (67 values: 10 duration deciles, then 12 upload types, then 45 tags), `intercept`, the decile edges in `durationCurve`, `uploadTypes` and `topTags`:

```
watch_ratio = intercept + sum_f coef_f * x_f    (x one-hot: one duration decile, one upload type, each tag present)
```

## Training

- KuaiRand-1K (Zenodo 10439422), random-exposure rows only: 41,718 impressions of 7,161 videos
- target: play_time_ms / duration_ms, capped at 1; mean 0.125
- scikit-learn Ridge(alpha=1.0) on one-hot duration decile, upload type and presence of the most frequent tags (the top 100 asked for; 45 distinct tags exist) (`scripts/rig/retention_v0.py`); held out by video, 80/20

## Benchmark

| | Spearman, per held-out video |
|---|---:|
| 1,432 held-out videos | 0.746 |
| 983 held-out videos with at least 5 views | 0.765 |

Watch ratio falls with length: 0.35 for videos of 5 to 15 seconds, 0.12 at 41 to 63 seconds.

## Caveats

- Another platform and another culture of shorts; the weights do not transfer to YouTube, the recipe does.
- One split, no tuning.
