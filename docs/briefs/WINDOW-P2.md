# Window P, second run — the other learning loops

Extend the installed learning machinery (scripts/policy/fit.py, the Chapelle & Li learner, the registration discipline of docs/briefs/WINDOW-P.md) across the approved loops below. Budget **$3**; everything is CPU over existing JSONs. Same law as the first run: each loop's evaluation is registered in this file, timestamped, **before** that loop's fit; every number reported as it falls; limits stated plainly.

## Replay-ready loops (register, fit, evaluate — one at a time, in this order)

1. **Title style** — arms: the headline traits already measured (question mark, digit, caps run, emoji, length buckets). Reward: settled outperformed 3×. Diary: every catalog title and outcome.
2. **Thumbnail traits** — arms: bucketed v1 thumbnail features (memorability, brightness, contrast, colorfulness). Same reward. Rows limited to shorts with a thumbnail read.
3. **Posting cadence** — arms: days-since-the-channel's-last-publish, bucketed. Derive the gaps from the catalog's publish times.
4. **Next video's channel category** — whether channel category predicts outperformance for a given partner, conditioned on the partner's history. Counsel per partner, not per video.
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

**Ran.** 18,480 rows; train 14,784 (through 2026-07-29T22:25:34Z), test 3,696; base rate 0.1491, test logged rate 0.1374. Progressive validation, log loss (AUC): full 0.39707 (0.6206), context-only 0.39569 (0.6165).

| Policy | Matched | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |
|---|---|---|---|---|---|
| gap | 927 | 132.0 | -0.050 (-0.116, +0.010) | +0.034 (-0.043, +0.103) | fail |

Epoch marker: replayRows = 18,480, last replayed `oTytFVuVQzE` (2026-10-12T16:30:36Z).

**Verdict by the registered rule: FAIL.**

Rows dropped as a channel's first short: 64. Gap buckets (<1, 1–2, 2–4, 4–8, ≥8 days): 14,279 / 1,923 / 1,155 / 675 / 448; 77% of shorts go up within a day of the channel's last one. The full model's progressive log loss (0.39707) is worse than the context-only model's (0.39569), and the gap policy's estimators disagree in sign (SNIPS −0.050, DR +0.034), neither clearing zero.

### 4. Channel-family investment

**Registration — 2026-10-22T19:28:25Z, before any fit.**

The catalog holds no record of a partner placing money or content with a family, and a channel's family never changes, so the replay cannot learn from logged investments. The registered stand-in: each catalog short is one logged pairing of a subject (its topic cluster) with a messenger family, and the loop learns which family outperforms on which subject. A partner's own history is its subject mix.

- **Rows.** Settled catalog shorts with a family and a topic cluster (encoder map run 20261019-094112-train, k = 40).
- **Arm (one factor).** The six families: Candidates & officials, Nonpartisan media, Partisan media, Reform, UK, Voting rights.
- **Context.** Topic cluster. No continuous context: the channel median belongs to the messenger, not the partner.
- **Reward.** Settled outperformed 3×. It is measured against each channel's own median, so the loop compares how often each family's shorts outperform their own channel, not the reach a family delivers.
- **Behavior policy.** Per topic, per family, from training-segment frequencies with +0.5 smoothing. The target policy picks the family with the highest posterior-mean chance on the row's topic, among families seen on that topic in training.
- **Evaluation and pass rule.** Otherwise the standard protocol (SNIPS and DR, channel-clustered bootstrap, progressive validation against a topic-only model). Pass: DR lower 95% bound above 0 with at least 200 matched test rows, and the full model's log loss beats topic-only.
- **Counsel per partner.** Partners are the five reform-core channels (Vote YES on 3, Courageous Colorado, Open Primaries, Unite America, FairVote). Each partner's history is the topic mix of its own settled shorts. Its counsel is the family with the highest share-weighted posterior-mean chance under the shipped model, with the share of 1,000 posterior draws (seed 20261022) in which each family ranks first. Counsel is written whatever the verdict, marked with it.
- **Limit specific to families.** Family is confounded with everything about its channels (audience size, posting volume, production). A family's estimated gain says its channels outperform their own medians more often on a topic, not that a partner's message would do the same there.

**Ran.** 18,307 rows; train 14,645 (through 2026-07-26T19:30:21Z), test 3,662; base rate 0.1484, test logged rate 0.1319. Progressive validation, log loss (AUC): full 0.36685 (0.6756), context-only 0.37856 (0.6382).

| Policy | Matched | ESS | SNIPS − logged (95%) | DR − logged (95%) | Rule |
|---|---|---|---|---|---|
| family | 1,974 | 589.6 | +0.014 (-0.033, +0.067) | +0.021 (-0.014, +0.062) | fail |

Epoch marker: replayRows = 18,307, last replayed `CMnptS4ujWU` (2026-10-08T15:00:16Z).

**Verdict by the registered rule: FAIL.**

The family arm improves prediction over topic alone (log loss 0.3669 against 0.3786), but the policy built on it does not clear zero on either estimator.

Counsel per partner (marked FAIL; share-weighted chance under the shipped model, and the share of 1,000 posterior draws ranking each family first):

| Partner | Shorts | Counsel | Chance | First in draws | Runner-up |
|---|---|---|---|---|---|
| Vote YES on 3 | 34 | Nonpartisan media | 0.153 | 49% | Candidates & officials, 0.127, 23% |
| Courageous Colorado | 38 | Nonpartisan media | 0.172 | 31% | Candidates & officials, 0.146, 28% |
| Open Primaries | 12 | Nonpartisan media | 0.182 | 43% | Candidates & officials, 0.164, 34% |
| Unite America | 32 | Nonpartisan media | 0.175 | 32% | Candidates & officials, 0.144, 27% |
| FairVote | 106 | Nonpartisan media | 0.171 | 30% | Partisan media, 0.114, 27% |

No family ranks first in a majority of draws for any partner. The counsel is the same for all five because their topic mixes overlap.

### 5. Remake candidates

**Registration — 2026-10-22T19:29:18Z, before the list is built.**

This loop is not a bandit; it is a ranked list.

- **Eligible.** Settled catalog shorts that have a mode-match score in `data/generated/model/winning-modes.json` (`scores`, the full set) and sit in a topic from `data/generated/model/topic-lift.json` whose 90% lift range lies above 0 (high topic lift).
- **Ranking.** Remake score = topic lift in points × (100 − mode-match) / 100: high topic lift crossed with weak craft. Ties go to the lower outperformance ratio first. Every eligible short is written, ranked.
- **Grounds on every row.** Topic name, lift and 90% range; the short's mode-match and the surviving winning mode's name; the short's own ratio and whether it outperformed 3×; channel and family.
- **Rule.** The list is **supported** if, inside the eligible set, mode-match separates outcomes: the AUC of mode-match for outperformed 3× has a channel-clustered bootstrap (1,000 resamples, seed 20261022) 95% lower bound above 0.5. Otherwise the list ships marked **unsupported**: weak craft would not be shown to cost these topics anything.
- **Limits.** The winning mode was fit on some of these same shorts (train channels), so its match is partly in-sample for them. The media set behind the scores was fetched mostly in outperformer/control pairs, so its base rate runs above the catalog's. Topic lift is measured across channels; a remake stays on the same channel.
- **Output.** `data/generated/model/learning/remake-candidates.json`.

**Ran.** 1,191 eligible shorts on 46 channels across four topics: Campaign pitches (lift +11.9 points, 90% range 7.5 to 14.9; 492 shorts), Interviews and hearings (+4.9, 2.5 to 8.7; 250), Debates and big ideas (+3.5, 1.2 to 8.3; 289), Rule of law and voting rights (+1.4, 0.3 to 4.7; 160). Surviving mode: low seconds to first cut, high on-screen words per frame, high share of frames with text. Within the eligible set, 45.2% outperformed 3× (the media set's paired fetch). Mode-match AUC for outperformed 3×: 0.598 (95% 0.568 to 0.624, all 1,000 resamples kept). Top 200 of the list: 39.5% outperformed, median ratio 2.17. The list ranks every eligible short as registered, so shorts that already outperformed (rank 2 sits at 19.9×) stay in it; their grounds say so.

**Verdict by the registered rule: supported.**

### 6. Paid-flight allocation

**Registration — 2026-10-22T19:29:48Z, before any fit.**

The decision: at hour 6 after publish, which of the day's new shorts gets the paid flight. The arms are the candidate shorts; every short's outcome is observed whether or not it would have been picked, so this loop is evaluated with full information: no propensities, no off-policy estimator.

- **Diary.** Polled curves in `data/generated/model/velocity-features.json` with a 6-hour reading (first reading at or before hour 6, last at or after hour 6) and a catalog row, labeled by views at 72 hours ≥ 3 × the catalog channel median where a 72-hour value exists, otherwise by the settled ratio ≥ 3. Curves with neither are dropped. This mirrors the PAX2 Velocity Classifier's 341-curve rule from the stored features; the count is reported, not forced.
- **Learner.** The Window P learner on: family one-hot; standardized log10 views at 1 and 6 hours; log10 of each over the channel median. Standardization uses the full diary's means (a stated leak of scale, not of outcome).
- **Slates.** Shorts grouped by publish date in America/New_York; slates of two or more shorts are evaluated. The learner replays slates in date order and, for each slate, picks the short with the highest posterior-mean chance using only earlier slates' updates, then updates on the slate. Slates before the learner has seen 50 shorts are warm-up and not scored.
- **Reported per scored slate.** Policy hit (the pick's label), uniform allocation (the slate's mean label), the comparator "highest 6-hour views over channel median" (reported, gates nothing), and the oracle (any hit in the slate).
- **Rule.** Pass if the mean of (policy − uniform) over scored slates has a 95% lower bound above 0 in a 1,000-resample bootstrap of slates, seed 20261022.
- **Limits.** A few hundred curves and a few dozen hits: the intervals will be wide and are reported as they fall. The curves came from the poller's watch list, not a random draw of shorts. No short in the diary was paid; the reward is the organic curve a paid flight would ride, not the flight's own return.

**Ran.** 349 curves qualify (335 labeled at 72 hours, 14 by settled tier; none dropped for a missing family), 57 hits. The PAX2 Velocity Classifier counts 341 curves and 33 hits on its own rule; the difference comes from the median: this loop uses the catalog's channel median, the classifier uses baselines.json. The diary spans 9 publish days. The first day (62 shorts) is warm-up, leaving **8 scored slates** holding 287 shorts, about 36 a slate.

| Allocation | Hit rate of the pick, mean over 8 slates | − uniform (95%) |
|---|---|---|
| Policy (learner's top pick) | 0.875 | +0.668 (+0.420, +0.841) |
| Comparator: top 6-hour views over median | 0.875 | +0.668 (+0.433, +0.828) |
| Uniform | 0.207 | — |
| Oracle | 1.000 | — |

Every scored slate holds at least one hit. The learner's pick wins in 7 of 8 slates, the same count as picking the highest 6-hour views over median: the learner adds nothing measurable over that one feature. With 8 slates, the interval moves by an eighth with each one.

Epoch marker: replayRows = 349 (per curve, publish order).

**Verdict by the registered rule: PASS**, on 8 slates.

### 7. Active learning

**Registration — 2026-10-22T19:30:43Z, before the lists are built.**

No outcomes are fitted here. The fitted loops' posteriors rank where the next measurement or audit is worth most.

- **Models.** The five fitted posteriors over catalog shorts: the publish policy (`martian-publish-policy.json`), title style, thumbnail traits, posting cadence, family investment. Paid flight covers only polled curves and is left out. Each model scores a short only where every feature it needs exists for that short.
- **Per short, per covering model.** The posterior-mean chance p at the short's own logged arms, and the posterior variance of the logit at those arms, xᵀ diag(1/precision) x.
- **Measure next.** Catalog shorts, any tier, without a media-measured composition read (no mode-match score in `winning-modes.json`). Ranked by the mean logit variance across covering models, highest first; ties by the binary entropy of the mean p. Top 500 written.
- **Hand-audit next.** Settled shorts that have a media-measured read. Ranked by surprise, −log of the mean p for the observed outcome (outperformed 3× or not), highest first. These are the records the models find hardest to believe, where a label or measurement error is likeliest. Top 500 written; Window Q's audit draws from this list.
- **Rule.** No pass/fail on outcomes. The loop is **complete** if both lists are written with every eligible short scored by at least one model; any short no model covers is counted and reported.
- **Limits.** Logit variance measures what the bandits are unsure about, not what a craft measurement would teach; a measured short adds a craft read, not new arm coverage. A surprising record can be a true outlier, not an error.
- **Output.** `data/generated/model/learning/active-learning.json`.

**Ran.** Measure next: 12,999 eligible unmeasured shorts scored (58 covered by no model: their channels have no family). The top 500 average 4.9 covering models; logit variance runs 0.221 to 2.418, against a median of 0.040 over all eligible. Tiers in the top 500: baseline 377, killed 113, breakout 3, unsettled 7. Channels most present: Democracy Forward 105, MeidasTouch 81, Lib Dems for Electoral Reform 53, The Daily Wire 52, When We All Vote 46. The very top is openDemocracy (UK family, the thinnest context).

Hand-audit next: 5,960 eligible measured settled shorts scored (18 uncovered). Surprise in the top 500 runs 2.26 to 3.25, against a median of 0.278. **All 500 are outperformers** (median ratio 5.18): with a base rate near 15%, a hit is always the more surprising record, so the surprise rank never reaches a short that underperformed against a confident forecast. Channels most present: Turning Point USA 94, Pod Save America 85, Ben Shapiro 71, MeidasTouch 64, Brian Tyler Cohen 43. If Window Q's audit wants both kinds of disagreement, it should draw from the top of each outcome separately; the file keeps every row's outcome so that split needs no refit.

**Verdict by the registered rule: complete.**

### 8–11. Cold-start loops

**Specs — 2026-10-22T19:33:54Z.** No fit and no replay; each spec is written by `scripts/policy/loops/cold_start_specs.py`, which reads the arm lists from the files that define them. Every spec carries the learner, an empty epoch marker (replayRows = 0), and the evaluation to register once 1,000 logged decisions exist: the standard protocol with logged propensities in place of estimated ones. No `src/` file was changed; the event kinds below are named for the app to add.

- **8. For-You feed** (`learning/for-you-feed.json`). Arms: the candidate videos per feed slot. Context: the reader and video features of the PAX2 Feed Ranker. Reward: `watched75` (a watch-through), with `boost` and `open` logged as secondary; all three are existing usage kinds. To add: an `impression` event per rendered card carrying slot and propensity. Warm start: PAX2 Feed Ranker (feed-0, KuaiRand-1K long views) as the prior means.
- **9. Chat's suggested prompts** (`learning/chat-suggested-prompts.json`). Arms: the chip ids. No chips exist in `src/` yet; the list fills when Window U ships them. Reward: a tap. To add: `chip-shown` (position, propensity, surface) and `chip-tap`.
- **10. Recommendation ordering** (`learning/recommendation-ordering.json`). Arms: the registry's 24 craft axes from `winning-modes.json`, i.e. which off-mode axis the Recommendations block lists first. Reward: the creator acts: their next original within 30 days moves that axis 10 or more percentile points toward the mode center on its craft read. To add: `rec-shown` and `rec-acted` (the second written by the scorer).
- **11. Studio style** (`learning/studio-style.json`). Arms straight from StyleRecord v2: voice (17 ids, silent included), pace (four wpm bands plus voice-led), typeface (display, serif, mono), hook card (on/off), sound bed (none, calm, pulse, bright). Reward: the published take outperformed 3× within 72 hours. Logging: `ORIG#<id> META` already carries `style`; to add are the sampled suggestion and its probability beside the kept style. **Replay: none.** A read-only scan of pax2-ledger found 0 originals carrying a style record (102 originals indexed), so this loop ships as a cold-start spec, as the brief allows.
