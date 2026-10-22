---
license: apache-2.0
tags: [pax2, youtube-shorts, k-means, prototypes, composition, craft]
---

# PAX2 Winning Modes (v1)

**Status: one winning mode of five survives held-out channels.** The craft configuration that re-measures above base is an early first cut, frequent cuts and dense on-screen text. Published because every fitted PAX2 model is published, pass or fail.

A winning mode is a recurring craft configuration among shorts that outperformed 3× their channel median. It keeps the name only if its lift re-measures above the base rate on channels the fit never saw. A short's mode-match is how close its craft template sits to the nearest surviving mode, scored 0 to 100 against the label-blind baseline sample.

This refit replaces the eight-axis template behind the Resonance comparison sheet, which carried the outlier multiple and the classifier forecast. Both leave the template here: the multiple is the quantity the 3× label is cut from.

## Template

There are 24 craft axes, each a within-channel mid-rank percentile. A missing value sits at the channel's middle.
- Composition, measured from the file:
  - cuts: cuts per second, seconds to first cut, cuts in the first 2 s;
  - visual activity;
  - sound: loudness, loudness range, hook loudness over the whole;
  - on-screen text: words per frame, share of frames with text, words in the first 2 s;
  - brightness and saturation.
- Speech timing: spoken words per second, seconds to first word, words in the first 2 s, share of seconds with speech.
- Length against the channel.
- Title traits: words, question, number, all-caps run, emoji.
- Engagement profile: likes per view, comments per view.

## Protocol (fixed before the run)

- Population: 5,975 settled catalog shorts with media-measured composition, on 58 channels.
- Channels are split 70/30 by hash: 41 train channels (5,006 shorts, base 0.431) and 17 test channels (969 shorts, base 0.399).
- k is chosen from 3 to 8 on the train channels alone, by 5-fold channel-grouped cross-validation. The criterion is the held-out log loss of each nearest mode's share over 3×, smoothed toward base with 20 pseudo-videos.
- The final modes come from k-means (k-means++, 10 restarts) over the train outperformers.
- Each mode's lift is the share over 3× among test-channel shorts nearest it.
- A mode survives only when the 90% channel-bootstrap interval (1,000 draws) of its lift minus base lies above zero.

The media set was fetched mostly in outperformer/control pairs, so its base rate runs far above the catalog's. Every lift is read against the base of the same population. The label-blind sample (test base 0.201, 319 shorts) is reported beside each mode.

## k

| k | held-out log loss | base 0.68381 | gain |
|---|---|---|---|
| 3 | 0.68257 | | 0.00124 |
| 4 | 0.67202 | | 0.01179 |
| **5** | **0.67070** | | **0.01311** |
| 6 | 0.67759 | | 0.00622 |
| 7 | 0.67706 | | 0.00675 |
| 8 | 0.67353 | | 0.01028 |

## Modes (k = 5, held-out lifts on 17 test channels, base 0.399)

| Mode | Defining axes (center percentile) | Held-out shorts | Held-out lift | Lift − base, 90% | Blind-sample lift (base 0.201) | |
|---|---|---|---|---|---|---|
| 5 | early first cut (25), dense on-screen text (75; text on 74% of frames), frequent cuts (72) | 181 | **0.508** | +0.054 to +0.161 | 0.269 (52) | **Survives** |
| 4 | high visual activity, little on-screen text, frequent cuts | 147 | 0.490 | −0.008 to +0.155 | 0.265 (49) | Dropped: interval reaches below zero |
| 3 | dense on-screen text, text in the first 2 s | 193 | 0.383 | −0.060 to +0.043 | 0.219 (64) | Dropped: at or below base |
| 1 | low visual activity, little on-screen text | 213 | 0.376 | −0.096 to +0.050 | 0.190 (79) | Dropped: at or below base |
| 2 | long against the channel, bright, low saturation | 235 | 0.294 | −0.162 to −0.051 | 0.107 (75) | Dropped: reliably below base |

The surviving mode sits low on likes and comments per view (32nd and 33rd percentiles), so its lift is not borrowed from the engagement axes.

## Pre-release variant

The engagement axes exist only after publication, so the fit was rerun without them (22 axes).
- No k from 3 to 8 beat the base rate in cross-validation: the gain was −0.00005 at the best k, which was 4.
- On the test channels, one mode of four still survives: early first cut (23), frequent cuts (75), dense on-screen text (70). Its lift is 0.468 against 0.399 (+0.021 to +0.117); the blind-sample lift is 0.267 against 0.201.
- This is the same configuration as mode 5 above.

## Mode-match, read on the test channels

The test channels also decided which modes survive, so read these as an upper bound.

| Variant | Pooled AUC | Within-channel AUC (23,539 pairs) | Blind-sample AUC |
|---|---|---|---|
| Full | 0.612 | 0.601 | 0.595 |
| Pre-release | 0.571 | 0.558 | 0.559 |

## Files

- `winning-modes.json`:
  - the protocol;
  - both variants' k tables;
  - the modes with their centers, lifts and drop reasons;
  - `scores` (full) and `scoresPreRelease` for the 5,979 media-measured shorts.

Built by `scripts/winning-modes.mjs` from `composition.json`, the velocity catalog and the label-blind sample. Pure CPU, no spend.
