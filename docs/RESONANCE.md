# Resonance — the definition and the formula

The glossary's Resonance entries (src/lib/glossary.ts) and the video page's Formula card (src/lib/formulas.ts) restate this file; edit them together.

**Definition (Brendan, 2026-10-22).** Resonance is a pre-publication number computed only after a video has entered the Lab through any door: every measurable variable of this video, read against every variable measured for every video that has gone through the pipeline, yielding a prediction of performance and specific, grounded areas of improvement. No Lab run, no Resonance.

## The formula

Components — pre-publish measurables only, each an existing gate-passed instrument:

- `q_c` — the calibrated probability the video outperforms 3× its channel median, from the outlier classifier (v3 when transcript and embedding exist; v1's thumbnail or metadata arm otherwise; thin-flagged on the metadata arm alone).
- `q_x` — the craft rank: the share of the channel's measured shorts this video beats pairwise under the composition pair picker (combined variant).
- `q_h` — the headline percentile against the tested-headline reference.

The stack: one logistic fit over the uniform baseline, held out by channel,

    P̂(outperform 3×) = σ( b₀ + Σᵢ bᵢ · logit(qᵢ) )

with a missing-component indicator per absent `qᵢ`. Pre-registered acceptance: the stack's held-out AUC must be at least the best single component's, else that component alone serves as Resonance until the stack earns its place.

**The score and its gauge (Brendan, 2026-10-22, settled):** Resonance is a probability wearing the credit-score dress — a banded half-gauge, 0 to 100, named bands from Poor to Exceptional, the number and band in the center. It lives pre-release. When the video publishes and completes the poller's 72-hour window, the gauge switches: the measured post-release score (the same 0–100 scale, the outcome's percentile among the baseline) takes the needle, the pre-release score becomes a reference line on the arc, and the gauge's center circle carries the difference, signed (+20, −10).

**The mode-match (the deterministic companion):** beside the gauge, the polygon — craft axes only. A *winning mode* is a recurring craft configuration among videos that outperformed 3×: cluster the craft-axis templates of the outperformers, keep the modes whose lift re-measures above base on held-out channels, and the pre-release read is how closely this video matches its nearest winning mode. Each axis renders as an ingredient row (the Experian pattern): weight of the match, band chip. Post-release, the per-axis chips show the signed up-or-down against what the mode promised, while the gauge circle keeps the aggregate difference.

**The guarantee:** every video that exits the Lab gets a prediction — the metadata arm needs only title, length and posting fields, which every video has. When components are missing, Resonance also lists the specific actions that unlock the fuller read: no transcript, add captions; no media measure, run the flask; and so on. A prediction, plus the path to a better one — never silence.

**The generations (the client roadmap):** Gen 1 — the three-instrument stack above. Gen 2 — the audited census columns (Window Q) join the inputs. Gen 3 — the early-hit read folds in once the video is published and polled. Gen 4 — the publish-next policy (Window P) adds topic, length and hour counsel. Gen 5 — the instruments retrain on the client's own accumulated outcomes.

**The recommendations:** the top standardized contributions against the channel's outperformer norms, rendered only where the recommendation registry holds a measured lift; everything else stays descriptive.

**Growth:** every audited question column (Window Q) with a measured lift joins the stack's inputs at the next refit — Resonance widens as the census widens.

Cost: one script over existing JSONs, ~$0. Fitting and validation are Window Q's step 6 (docs/briefs/WINDOW-Q.md).
