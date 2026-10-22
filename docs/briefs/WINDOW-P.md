# Window P — the policy install (offline reinforcement learning)

Install the learn-from-the-diary loop: a contextual bandit over the publish choices the catalog already records, warm-started by replaying those records, with a hard line between replay and anything a client later publishes. Runs independent of every other window; budget **$2**.

## The data (all existing; no video model, no new fetch)

- `data/velocity/catalog.json` — every settled short's channel, title, length, publish time, views, ratio.
- Topic arm: the serving index's cluster map (the text embedding's k=40 clusters — grep `cluster` under `scripts/` and `data/raw/composition/index/`).
- Reward for the replay epoch: **settled outperformed-3×** (ratio ≥ 3). The 72-hour reward is *defined* in the model card for the online epoch but never used in replay — only ~341 shorts have 72-hour curves, and a warm start must not train on 2% of the data.

## The build

1. Arms: topic cluster, length bucket, publish hour-of-day. Context: channel family and channel median.
2. Register the off-policy evaluation **before** any fit, in the brief's Report section with a timestamp: estimator (IPS or doubly-robust), the behavior policy estimated from the logged frequencies, and the limits stated plainly (logged choices were never randomized; the numbers are observational).
3. Warm start: replay the settled catalog rows in publish order. Write the **epoch marker** into the model file: everything before the marker is replay; a client's own publishes land after it.
4. Evaluate exactly as registered; report the numbers whatever they say.
5. Publish private to Hugging Face under the Martian naming, pass or fail on the card, the registration text included verbatim.

## Rules

- Mac or a 2-cent box — fitter's choice; this is small-data logistic arithmetic, no GPU.
- Commit by explicit path; **do not push**. No local typechecks. No product surface in this brief.
- No silent fails: the Report states what ran against what was registered.

## Report

Append `## Report`: the registration (first, timestamped, before any fit), then arms and context as built, replay size, the off-policy numbers, the HF repo, and the epoch marker's value.

## Report

### Registration — 2026-10-22T18:51:28Z, written before any fit

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

**Outputs.** Model file `data/generated/model/martian-publish-policy.json` with the epoch marker (everything at or before it is replay; a client's own publishes land after it). Script `scripts/policy/fit.py`. Card `docs/cards/martian-publish-policy.md`, this registration verbatim. Hugging Face: `NYSgpt/martian-publish-policy`, private, pass or fail.
