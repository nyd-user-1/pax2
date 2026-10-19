---
license: other
pipeline_tag: tabular-classification
tags:
- youtube-shorts
- logistic-regression
- early-prediction
---

# PAX2 Velocity Classifier

Whether a short will be a Hit at 72 hours, views at least 3x its channel's median, from its first hours of views. One model per horizon, each reading only the views up to that hour plus the pre-publish features. Built 2026-10-18; it serves the chance per watched short on PAX2's live tracking.

## Scoring

`velocity-model.json` carries, per horizon (`horizons.1`, `.3`, `.6`), every feature's `coef`, `mean` and `sd` and the `intercept`:

```
p(hit) = sigmoid(intercept + sum_f coef_f * (x_f - mean_f) / sd_f)
```

The view series is the running maximum of the poller's readings, anchored at 0 views at hour 0 and linear in hours between readings.

## Training

- 332 shorts from 39 channels with readings through 72 hours, 32 Hits (base rate 0.096)
- L2 logistic regression, lambda 2.0 on standardized features (`scripts/rig/velocity.py`)
- features: log views and views over the channel median at each reading hour, and PAX2 Classifier's pre-publish features

## Benchmark

| Horizon | Pooled AUC, leave one channel out | Within channel | Top-decile lift | Time split AUC |
|---|---:|---:|---:|---:|
| 1 hour | 0.595 | 0.517 | 2.2x | 0.667 |
| 3 hours | 0.689 | 0.732 | 3.1x | 0.801 |
| 6 hours | **0.877** | **0.903** | **5.0x** | 0.863 |

The pre-publish features alone score 0.487 on the same rows; the views carry the signal. The time split trains before 2026-10-09 22:56 UTC and scores the 100 shorts after.

## Caveats

- 332 shorts and 32 Hits; the within-channel number rests on 4 channels with 10 or more shorts and 2 or more of each outcome.
- A Hit is defined from the same view series the model reads, so the 6-hour model is partly measuring momentum already under way.
- v1 waits on about 1,000 settled curves; the poller adds about 180 shorts a week.
