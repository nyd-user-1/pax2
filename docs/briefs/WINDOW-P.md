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
