# The winning modes, refit honestly

Refit the mode machinery behind docs/RESONANCE-COMPARE.html so the deterministic pre-release mode-match can serve, per docs/RESONANCE.md. Pure CPU over existing JSONs; ~$0; no GPU, no fetch.

1. **Craft axes only.** Rebuild the per-video template from craft measurables alone — composition, speech timing, length deviation, title traits, engagement profile. The outlier multiple and any classifier forecast leave the template (the leakage the evaluation flagged, docs/RESONANCE-EVAL.md).
2. **Cluster the outperformers.** K-means over the craft templates of videos that outperformed 3×, k chosen on held-out channels (try 3–8). A cluster is only a *winning mode* if its lift — the share-over-3× of its nearest-neighbor videos — re-measures above the base rate on held-out channels. Modes that don't clear it are named and dropped.
3. **The match score.** A video's mode-match = similarity to its nearest surviving winning mode, 0–100 against the baseline's distribution. Write per-video scores and the mode definitions to `data/generated/model/winning-modes.json` with the held-out lifts on the card.
4. **Publish** private to Hugging Face under the Martian naming, pass or fail, lifts on the card.

Rules: approved vocabulary; no local typechecks; commit by explicit path; do not push; the Report states every dropped mode and why.

## Report

Append `## Report`: k chosen and how, surviving modes with their held-out lifts, dropped modes, file paths.

## Report

**Outcome: one winning mode of five survives held-out channels.** It is an early first cut, frequent cuts and dense on-screen text. The other four are named and dropped below. The refit ran on CPU over files on disk, cost $0, and gives the same numbers on a second run.

**Template.** There are 24 craft axes, each a within-channel mid-rank percentile, with a missing value at 0.5:
- 12 composition axes;
- 4 speech-timing axes;
- length against the channel;
- 5 title traits;
- 2 engagement axes (likes and comments per view).

The outlier multiple and the classifier forecast are gone.

**Population.** 5,975 settled shorts with media-measured composition, on 58 channels. Channels are hash-split 70/30: 41 train channels (base 0.431) and 17 test channels (base 0.399). The media set was fetched mostly in outperformer/control pairs, so its base rate is high. Each lift is read against the same population's base, and the label-blind sample is reported beside it (test base 0.201, 319 shorts).

**k chosen: 5.** It was picked on the train channels alone, by 5-fold channel-grouped cross-validation, using the held-out log loss of each nearest mode's share over 3× against the base rate.

| k | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|
| Held-out gain over base | 0.0012 | 0.0118 | **0.0131** | 0.0062 | 0.0068 | 0.0103 |

**Survival rule, fixed before the run.** A mode survives only when the 90% channel-bootstrap interval of its held-out lift minus base lies above zero.

**Surviving mode.**
- **Mode 5**: early first cut, dense on-screen text, frequent cuts.
- Held-out lift is **0.508 against a base of 0.399** (+0.054 to +0.161) over 181 shorts.
- On the label-blind sample the lift is 0.269 against 0.201.
- Its likes and comments per view sit low (32nd and 33rd percentiles), so the lift does not come from the engagement axes.

**Dropped modes.**
- **Mode 4** (high visual activity, little on-screen text, frequent cuts): lift 0.490, but the interval reaches −0.008.
- **Mode 3** (dense on-screen text, text in the first 2 s): lift 0.383, at or below base.
- **Mode 1** (low visual activity, little on-screen text): lift 0.376, at or below base.
- **Mode 2** (long against the channel, bright, low saturation): lift 0.294, reliably below base (−0.162 to −0.051).

**Mode-match on the test channels.** The test channels also chose which mode survives, so these are an upper bound: pooled AUC 0.612, within-channel 0.601, label-blind sample 0.595.

**Flag: the pre-release read is weaker.** The engagement axes the brief lists exist only after publication, so a pre-release match cannot use them. The fit was rerun without them (22 axes):
- No k beat the base rate in cross-validation; the best was −0.00005 at k = 4.
- One mode still survived the test channels: the same configuration (early first cut, frequent cuts, dense on-screen text), lift 0.468 against 0.399 (+0.021 to +0.117).
- Its dropped modes:
  - mode 1 (little on-screen text, high visual activity): interval reaches −0.010;
  - mode 3 (low on-screen text and visual activity): reliably below base;
  - mode 4 (dense on-screen text, text in the first 2 s): interval reaches −0.022.
- Match AUC: 0.571 pooled, 0.558 within channel.

The file carries both score sets. The `serves` field reads "full", per the brief's axis list. For pre-release serving, `scoresPreRelease` is the honest one. That choice is yours.

**Files.**
- `scripts/winning-modes.mjs`
- `data/generated/model/winning-modes.json`: the protocol, both k tables, the modes with centers, lifts and drop reasons, and `scores` plus `scoresPreRelease` for 5,979 shorts.
- `docs/cards/martian-winning-modes.md`
- Hugging Face: `NYSgpt/martian-winning-modes`, private, with card and JSON.

`docs/RESONANCE-COMPARE.html` and `scripts/resonance-compare.mjs` are untouched. They still use the old leaky modes until a page reads the new file.
