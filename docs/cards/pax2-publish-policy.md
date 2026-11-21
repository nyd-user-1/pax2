---
license: apache-2.0
tags: [pax2, contextual-bandit, offline-reinforcement-learning, off-policy-evaluation, thompson-sampling, youtube-shorts]
---

# Pax2 Publish Policy (v1)

**Status: passes its registered rule, weakly.** Topic and publish-hour policies clear the doubly-robust bound; self-normalized IPS crosses zero for every factor; the length policy fails; the joint policy has 25 matched rows. Every number is observational: the logged publish choices were never randomized.

A contextual bandit over three publish choices: topic (the text encoder's k = 40 cluster), length (≤30 s, 31–60 s, 61–90 s, ≥91 s) and publish hour (six four-hour blocks, America/New_York). Context: channel family and log10 channel median. The learner is Bayesian logistic regression with a diagonal Laplace posterior, prior N(0, 1), updated one row at a time; in the online epoch it acts by Thompson sampling.

## Epoch marker

The model was warm-started by replaying 18,307 settled catalog shorts in publish order (reward: settled ratio ≥ 3). The marker in `pax2-publish-policy.json` is `epochMarker.replayRows = 18307`; the last replayed short is `CMnptS4ujWU`, published 2026-10-08T15:00:16Z. Updates 1 to 18,307 are replay. Every update after it is a client's own publish, rewarded by outperformed 3× within 72 hours. The 72-hour reward is never used in replay: only about 341 shorts have 72-hour curves.

## Results (test segment: last 20% by publish time, 3,662 rows, logged rate 0.1319)

Progressive validation, log loss (AUC): full model 0.3616 (0.696); context-only model 0.3862 (0.613).

| Policy | Matched rows | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |
|---|---|---|---|---|---|
| Topic | 664 | 65.6 | +0.065 (−0.047 to +0.173) | +0.145 (+0.024 to +0.273) | pass |
| Length | 916 | 269.2 | −0.033 (−0.072 to +0.018) | −0.274 (−0.704 to +0.047) | fail |
| Hour | 262 | 45.2 | +0.128 (−0.051 to +0.337) | +0.104 (+0.026 to +0.214) | pass |
| Joint | 25 | 17.4 | +0.005 (−0.150 to +0.137) | +0.291 (+0.216 to +0.356) | fail (matches < 200) |

Intervals: 1,000-resample bootstrap clustered by channel, seed 20261022.

## Reading the numbers

- The DR estimates lean on the direct-method term, and the policy is the argmax of that same model, so the term carries winner's-curse optimism. SNIPS, which does not use the model, finds no factor whose interval excludes zero.
- The length DR estimate (−0.14 as a rate) is outside [0, 1]: uncapped weights on rare length choices multiply large residuals. The registration fixed weights uncapped; they were not capped afterward.
- Effective sample sizes are 45 to 269 rows out of 3,662. The joint policy's DR number rests on 25 matched rows and is shown for completeness.
- Channel medians look across the whole fetch window, a leak stated in the registration and not corrected.

## Files

`pax2-publish-policy.json` (posterior mean and precision per feature, feature names, arm definitions, epoch marker), `pax2-publish-policy-eval.json` (every registered number), `fit.py`.

## Registration (verbatim, written 2026-10-22T18:51:28Z before any fit)


Nothing has been fitted when this text is written. The evaluation below runs exactly as stated; the numbers are reported whatever they say.

**Rows.** Settled shorts in `data/velocity/catalog.json` (tier ≠ unsettled) that carry a cluster in `data/generated/model/encoder-map.json` (run 20261019-094112-train, k = 40). Unsettled rows and rows without a cluster are dropped and counted. Order: ascending `published`, ties by `id`.

**Arms (three factors, joint action = 40 × 4 × 6 = 960).** Topic: the k = 40 cluster. Length: ≤30 s, 31–60 s, 61–90 s, ≥91 s. Publish hour: hour of day in America/New_York, in six four-hour blocks (0–3, 4–7, 8–11, 12–15, 16–19, 20–23).

**Context.** Channel family (the map's six families, joined by channel) and log10 of the channel median.

**Reward.** Settled outperformed 3×: `ratio ≥ 3`. The 72-hour reward is defined on the card for the online epoch and not used here.

**Reward model and learner.** Bayesian logistic regression with a diagonal Gaussian posterior updated one row at a time (Laplace approximation, Chapelle & Li 2011), prior N(0, 1) on every weight. Features: intercept; family one-hot; log10 channel median (standardized on the training segment); one-hots for cluster, length bucket and hour block; and family × cluster, family × length, family × hour interaction one-hots. Acting rule for the online epoch: Thompson sampling from the posterior. Replay is a sequential pass of the rows in publish order, each row updating the posterior once.

**Split.** Time split: the first 80% of rows by publish order form the training segment; the last 20% are the test segment. The evaluation model is the replay state after the training segment only. The shipped model replays all rows. Channel medians come from the catalog as fetched, which looks across the whole window; this leak is stated, not corrected.

**Behavior policy.** Estimated from logged frequencies, per channel, per factor, on the training segment: π_b(a_f | channel) = (count of factor value a_f on that channel + 0.5) / (channel rows + 0.5 × number of values). Channels with no training rows fall back to the family's frequencies. The joint behavior propensity is the product of the three factor propensities (independence across factors is assumed, not tested).

**Target policies.** Deterministic. Per factor f ∈ {topic, length, hour}: for each test row, keep the other two factors as logged and pick the value of f that maximizes the evaluation model's posterior-mean predicted reward, restricted to values the channel used in the training segment (support guard). Plus the joint policy: all three factors chosen by the same rule over the channel's used values.

**Estimators.** For each target policy on the test segment: self-normalized IPS (SNIPS) and doubly-robust (DR), the direct-method term from the evaluation model. Weights w = 1[a = π(x)] / π_b(a | x), uncapped. Compared against the logged value V_b = the test segment's observed outperform rate. Uncertainty: 95% intervals from a 1,000-resample bootstrap clustered by channel, seed 20261022. Reported alongside: matched rows (a = π(x)) and effective sample size (Σw)² / Σw².

**Model check.** Progressive validation on the test segment (predict each row before updating on it): log loss and AUC of the full model, against a context-only model (intercept, family, channel median) fitted by the same learner. If the arms carry no signal beyond context, the full model will not beat it.

**Pass rule.** A factor's policy passes if the DR lower 95% bound of V_π − V_b is above 0 and it has at least 200 matched test rows. The model passes if any factor passes and the full model's progressive log loss beats the context-only model's.

**Limits.** The logged choices were never randomized. Channels chose topic, length and hour for their own reasons, and those reasons may themselves drive outperformance; π_b is estimated, not known. Every number here is observational: it says which choices co-occur with outperforming in this catalog, not what a channel would gain by switching. The support guard keeps every recommendation inside what the channel has done, which limits both the variance and the reach of the policy.

**Outputs.** Model file `data/generated/model/pax2-publish-policy.json` with the epoch marker (everything at or before it is replay; a client's own publishes land after it). Script `scripts/policy/fit.py`. Card `docs/cards/pax2-publish-policy.md`, this registration verbatim. Hugging Face: `NYSgpt/pax2-publish-policy`, private, pass or fail.
