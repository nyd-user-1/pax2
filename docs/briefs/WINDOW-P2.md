# Window P, second run — the other learning loops

Extend the installed learning machinery (scripts/policy/fit.py, the Chapelle & Li learner, the registration discipline of docs/briefs/WINDOW-P.md) across the approved loops below. Budget **$3**; everything is CPU over existing JSONs. Same law as the first run: each loop's evaluation is registered in this file, timestamped, **before** that loop's fit; every number reported as it falls; limits stated plainly.

## Replay-ready loops (register, fit, evaluate — one at a time, in this order)

1. **Title style** — arms: the headline traits already measured (question mark, digit, caps run, emoji, length buckets). Reward: settled outperformed 3×. Diary: every catalog title and outcome.
2. **Thumbnail traits** — arms: bucketed v1 thumbnail features (memorability, brightness, contrast, colorfulness). Same reward. Rows limited to shorts with a thumbnail read.
3. **Posting cadence** — arms: days-since-the-channel's-last-publish, bucketed. Derive the gaps from the catalog's publish times.
4. **Channel-family investment** — arms: the six families; context: the partner's own history. Counsel per partner, not per video.
5. **Remake candidates** — not a bandit: rank catalog videos by high topic lift crossed with weak craft (the winning-modes distance), write the ranked list with each row's grounds.
6. **Paid-flight allocation** — arms: the paid videos; reward from the early-hours curves. The diary is ~341 polled curves — register it, run it, and let the intervals say how thin it is.
7. **Active learning** — no outcomes needed: from the fitted models' uncertainty, write two ranked lists — which unmeasured videos to measure next, and which measured videos to hand-audit next (Window Q's audit should draw from this list).

## Cold-start loops (no fit — define and wire the spec)

8. **For-You feed** — arms and reward (boosts, opens, watch-throughs) as a spec the app can log against; the pretrain feed ranker named as the warm start.
9. **Chat's suggested prompts** — arms: the prompt chips; reward: taps.
10. **Recommendation ordering** — arms: the registry's dimensions; reward: a creator acting on the advice.
11. **Studio style** — arms straight from the style record every Studio take carries (voice, pace, typeface, hook card, sound bed); replay the few published styled takes if any exist, else cold-start spec.

Each cold-start loop ships one spec JSON (arms, context, reward event, where the app logs it) under `data/generated/model/learning/`.

## Shared outputs

- Per fitted loop: `data/generated/model/learning/<loop>.json` (weights, epoch marker) and `<loop>-events.jsonl` — per-row event logs in the same shape the /reinforcement-learning page reads, so the ledger covers every loop.
- One private Hugging Face repo, `NYSgpt/martian-learning-loops`, one folder per loop, the card carrying every registration verbatim and every verdict, pass or fail.

## Rules

Approved vocabulary; no local typechecks; commit by explicit path; **do not push**; no product surface in this brief; no silent fails — the Report states, per loop, registered vs ran.

## Report

Append `## Report`, one section per loop in run order: registration first (timestamped, pre-fit), then the numbers, then the verdict by the registered rule.

## Report

Shared machinery: `scripts/policy/learn.py` carries the Window P learner unchanged (Bayesian logistic regression, diagonal Laplace posterior, prior N(0, 1), one update per row, Thompson sampling in the online epoch), the Window P factor evaluation, and the event writer. Unless a loop's registration says otherwise, the **standard protocol** below applies, copied from the Window P registration: rows in ascending publish order; first 80% train, last 20% test; behavior policy per channel per factor from training-segment frequencies with +0.5 smoothing (fallback to the main context's frequencies); deterministic per-factor target policies restricted to values the channel used in training, other factors held as logged; plus the joint policy; SNIPS and doubly-robust against the test segment's logged rate, weights uncapped; 1,000-resample channel-clustered bootstrap, seed 20261022; progressive validation of the full model against a context-only model by the same learner. **Pass rule:** a factor passes if the DR lower 95% bound of V_π − V_b is above 0 with at least 200 matched test rows; the loop passes if any factor passes and the full model's progressive log loss beats the context-only model's. The joint policy is reported and gates nothing. Limits for every replay loop: the logged choices were never randomized, π_b is estimated, and every number is observational.

### 1. Title style

**Registration — 2026-10-22T19:26:46Z, before any fit.**

- **Rows.** Settled catalog shorts (tier ≠ unsettled) whose channel has a family in the encoder map. All titles, no cluster needed.
- **Arms (five factors, joint 2 × 2 × 2 × 2 × 3 = 48).** The headline traits as `scripts/metadata-lift.mjs` measures them: question (title contains "?"); digit (any 0–9); caps (a word of four or more capitals, trailing punctuation allowed, hashtags removed); emoji (any character in U+1F000–U+1FAFF or U+2600–U+27BF, the Python stand-in for \p{Extended_Pictographic}); length in words with hashtags removed: ≤6, 7–14, ≥15.
- **Context.** Channel family; log10 channel median.
- **Reward.** Settled outperformed 3× (ratio ≥ 3).
- **Evaluation and pass rule.** The standard protocol.
- **Limit specific to titles.** Trait choices travel with topic and channel style; a trait's estimated gain may be its topic's.

**Ran.** 18,544 rows; train 14,835 (through 2026-07-29T22:00:25Z), test 3,709; base rate 0.1488, test logged rate 0.1375. Progressive validation, log loss (AUC): full 0.39138 (0.6418), context-only 0.39635 (0.6162).

| Policy | Matched | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |
|---|---|---|---|---|---|
| question | 1,729 | 352.6 | -0.008 (-0.049, +0.032) | +0.010 (-0.038, +0.053) | fail |
| digit | 2,040 | 482.1 | +0.038 (-0.019, +0.089) | +0.035 (-0.016, +0.095) | fail |
| caps | 1,053 | 366.2 | +0.014 (-0.015, +0.043) | -0.072 (-0.214, +0.026) | fail |
| emoji | 2,350 | 290.0 | +0.049 (+0.010, +0.083) | +0.065 (+0.006, +0.157) | pass |
| length | 1,446 | 526.4 | +0.029 (-0.009, +0.057) | +0.018 (-0.027, +0.056) | fail |
| joint | 37 | 10.3 | -0.099 (-0.170, +0.061) | +0.069 (+0.001, +0.129) | reported only |

Epoch marker: replayRows = 18,544, last replayed `oTytFVuVQzE` (2026-10-12T16:30:36Z).

**Verdict by the registered rule: PASS.**

Arm prevalence over all rows: question 12.8%, digit 8.3%, caps 23.6%, emoji 15.1%; length ≤6 / 7–14 / ≥15 words: 5,843 / 11,037 / 1,664. Emoji passes on both estimators, the only factor here whose SNIPS interval also clears zero. Question, digit, caps and length do not pass. The caps DR estimate (−0.072) disagrees in sign with its SNIPS estimate (+0.014): the model's direct term pulls against the weighted outcomes.

### 2. Thumbnail traits

**Registration — 2026-10-22T19:27:28Z, before any fit.**

- **Rows.** Settled catalog shorts with a family and a v1 thumbnail read in `data/generated/model/thumb-features.json`.
- **Arms (four factors, joint 4⁴ = 256).** Memorability (ResMem), brightness, contrast, colorfulness, each bucketed into quartiles. Cut points are the training segment's 25th, 50th and 75th percentiles.
- **Context.** Channel family; log10 channel median.
- **Reward.** Settled outperformed 3×.
- **Evaluation and pass rule.** The standard protocol.
- **Limit specific to thumbnails.** A short's thumbnail is usually a frame of the video, so these arms are partly the video's look, not a separate choice; for most channels the logged "choice" was never made on its own.

**Ran.** 18,544 rows; train 14,835 (through 2026-07-29T22:00:25Z), test 3,709; base rate 0.1488, test logged rate 0.1375. Progressive validation, log loss (AUC): full 0.39139 (0.6328), context-only 0.39635 (0.6162).

| Policy | Matched | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |
|---|---|---|---|---|---|
| memorability | 878 | 399.4 | +0.004 (-0.036, +0.043) | +0.017 (-0.031, +0.055) | fail |
| brightness | 955 | 684.0 | -0.017 (-0.036, +0.002) | -0.014 (-0.036, +0.007) | fail |
| contrast | 1,094 | 653.9 | -0.023 (-0.049, +0.003) | -0.020 (-0.054, +0.012) | fail |
| colorfulness | 868 | 735.3 | +0.027 (+0.004, +0.048) | +0.032 (+0.006, +0.058) | pass |
| joint | 18 | 6.5 | -0.078 (-0.163, +0.089) | -0.164 (-0.512, +0.113) | reported only |

Epoch marker: replayRows = 18,544, last replayed `oTytFVuVQzE` (2026-10-12T16:30:36Z).

**Verdict by the registered rule: PASS.**

Quartile cut points from the training segment: memorability 0.757 / 0.814 / 0.863; brightness 38.79 / 53.09 / 68.17; contrast 44.80 / 53.30 / 61.43; colorfulness 21.44 / 27.59 / 36.25. Colorfulness passes on both estimators, and brightness and contrast lean negative without clearing zero. The full model's log loss edges the context-only model's by 0.005, so the thumbnail arms add little beyond channel context.

### 3. Posting cadence

**Registration — 2026-10-22T19:27:59Z, before any fit.**

- **Rows.** Settled catalog shorts with a family whose channel has an earlier publish in the catalog. Gaps are derived from every catalog row's publish time, unsettled rows included, so a short's gap counts the channel's latest earlier publish whatever its tier. A channel's first short in the window has no gap and is dropped.
- **Arm (one factor).** Days since the channel's previous publish: under 1, 1 to under 2, 2 to under 4, 4 to under 8, 8 or more.
- **Context.** Channel family; log10 channel median.
- **Reward.** Settled outperformed 3×.
- **Evaluation and pass rule.** The standard protocol, one factor, so no joint policy.
- **Limit specific to cadence.** The gap is mostly a channel's habit, not a per-short choice; within a channel the gap also tracks news cycles that drive views on their own. The catalog's 18-month window truncates gaps at its start.
