---
license: other
pipeline_tag: tabular-classification
tags:
- youtube-shorts
- logistic-regression
- pairwise
- video-composition
---

# PAX2 Composition Ranker

Which of two same-channel shorts broke out, read from how each one is made: pace, the hook, loudness, on-screen text, speech and the headline. Every feature is named and measured, so a finding reads as an edit ("the breakouts here cut first at 5.4 s, the controls at 6.3 s"), not as an embedding dimension. Two variants, both fitted 2026-10-20:

- `composition-ranker.json`: the 23 compositional features alone.
- `composition-ranker-combined.json`: the same features plus two readings from PAX2 Encoder's neighbors (the outlier share of a short's 20 nearest shorts from other channels, and its cosine margin toward outliers). This combines semantic meaning, corrected by audience behavior and filtered by composition, in one scorer.

## Scoring

Each file carries every feature's `mean`, `sd`, `weight` and whether it is `log1p`-transformed:

```
score(short) = sum_f weight_f * (x_f - mean_f) / sd_f
```

Of two shorts from the same channel, the higher score is the predicted breakout. A feature enters a comparison only when both shorts have it measured.

## Features

Measured per short (`scripts/composition/`): scene-cut rate, time to the first cut, cuts in the first 2 s, visual activity (mean scene score), integrated loudness, loudness range, hook loudness over the whole short's, on-screen words per frame and share of frames with text (OCR at a frame a second), on-screen words in the first 2 s, brightness, saturation, speech rate, time to the first word, words in the first 2 s, the speech share of audible seconds, duration, and title length, question, digit, all-caps run and emoji. Emotion was not measured.

## Training

- Pairs: every settled breakout (lifetime views at least 3x the channel median) with its same-channel non-breakout control nearest in publish date. That gives 2,770 pairs from the catalog, 2,481 of them with video measured on both sides.
- Model: a Bradley-Terry logistic with no intercept, L2 0.001, on standardized breakout-minus-control differences. These are the shipped pairwise fit's settings, fixed before the first run.
- Held out by channel: PAX2 Encoder's 10 held-out channels, giving 2,104 training pairs and 666 held-out pairs.

## Benchmark

| | Held-out pairs (666) | 95% interval | With media both sides (590) | Leave-one-channel-out (2,770) |
|---|---|---|---|---|
| Composition only | 0.566 | 0.528 to 0.604 | 0.568 | 0.525 |
| Combined | 0.595 | 0.557 to 0.632 | 0.590 | 0.574 |
| PAX2 Classifier v1, same pairs | 0.595 | 0.557 to 0.632 | | |

Gate X was pre-registered at held-out pair accuracy of at least 0.55, and both variants pass it. Read them with these caveats:

- The composition-only variant's interval crosses 0.55, and its leave-one-channel-out accuracy is 0.525. Across all 64 channels, composition alone barely orders a pair.
- The combined variant ties PAX2 Classifier v1 on the same held-out pairs; it does not beat it.
- Its value is that every weight is legible: the biggest are speech rate (+), the outlier share of the short's encoder neighbors (+), the outlier cosine margin (+), speech share (−), time to the first word (−) and time to the first cut (−).

## Sources

Media from the breakout/control pairs set (`s3://pax-2-638175140432/catalog-media/`), extraction run composition-20261020-070925. Transcripts from captions and Whisper. Encoder neighbors from serving index 20261019-094112-train.
