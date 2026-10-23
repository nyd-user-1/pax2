# Resonance: the evaluation and a definition that runs today

## mRI on its merits

The method under the name is a lift-weighted nearest-mode score: each video becomes an eight-axis template of within-channel percentiles, the templates of settled videos at or above 3x their channel median are clustered (k-means, k = 4), and a video scores by its cosine similarity to the nearest cluster center, weighted by that cluster's measured share-over-3x. This is a legitimate statistical family (prototype methods), and its instinct — that outperformance has several recurring configurations rather than one — is the strongest idea in the five proposals.

Two defects, one fatal as specified, one cosmetic:

1. **Target leakage.** Two of the eight axes are the outlier multiple and the classifier forecast. The outlier multiple *is* the quantity the 3x label is cut from, so similarity to winning centroids partly re-reads the label itself. The measured lifts carry the symptom: of the four modes, against a base rate of 0.172, the lifts are 0.19, 0.12, 0.27 and 0.08 — two of four modes at or below base. Half the structure is noise, and the half that lifts is inflated by the leaked axis. As a retrospective descriptor the score is honest; as anything forward-looking it is not, until the outcome axes leave the template.
2. **The name.** The MRI framing is a conflation carried over from an earlier question, and the analogy supplies no mechanism. The method stands or falls as a mixture of prototypes; the physics language is costume. The label "Modal Resonance" can stay if the glossary defines it operationally.

**Verdict: not trash — the right skeleton, wrongly dressed.** Remove the outlier multiple and the forecast from the template, keep the craft axes (composition, transcript pace, length deviation, title length, engagement profile), refit the modes, validate k and the lifts on held-out channels.

**Resolution of the naming (per Brendan, 2026-10-22): there is one Resonance, and mRI is not a second one.** Resonance is the measured number. mRI is the *imaging* of that number's anatomy — as the medical device does not define health but pictures it, mRI does not define Resonance but pictures where a video's surplus comes from. One definition, one number; mRI is how you look inside it.

## The definition that runs today

Constraints: data on hand only, computable over the 5,080 Lab Tested shorts, under $2. One further fact binds the choice: the video-embedding experiments (stock scoring and the trained head) failed their registered gates, so a *predictive* content-based Resonance is unsupported by the evidence in hand. A *measured* Resonance is fully supported.

**Resonance = the within-channel surplus, measured.** The public proposal (pR) is the only one of the six whose every component exists for the whole catalog:

    R = 100 · Φ( 0.50·z(outlierScore) + 0.30·z(engagementRate) + 0.20·z(durability) )

z within channel, evidence-weighted toward zero under ~2,000 views; where the poller never watched the video, the durability term drops and the weights renormalize. Cost: one node script over files already on disk — effectively $0. The windowed channel median (trailing 20 settled shorts, leave-one-out) should become the baseline inside outlierScore at the same time, registered as its own change since it relabels the catalog.

The three geometries are then not competitors but the same quantity at three moments of a video's life:

| Moment | Picture | What it shows |
|---|---|---|
| Before and during | octagon template | where the video sits on each craft axis, within channel |
| In flight | normalized trajectory | views over channel median against hours since publish |
| Settled | the number R | how much surplus the audience gave it |

The dimensionless-ratio language holds throughout: dividing by the channel median is the one move that lets a small channel's curve lie on a large channel's axes. The imported claim that a fixed retention value "triggers the same cascade on any channel" has no support in any data in house and should not travel into copy.

## The seven visuals

1. **Reactance curves fitted to length bands** (root, slide 1). The weakest of the seven: two borrowed textbook curve forms with added constants, least-squares fitted to data that does not share the mechanism. Its measured twin (slide 2) carries the same content honestly. Recommend demoting it to a stylistic echo or retiring it.
2. **Length crossing** (root, slide 2). Strong: measured shares of outperformance (3x or more) and underperformance (half or less) by length, within channel, with an actionable crossing. Keep. Per-video support: mark the video's own length on the curve.
3. **Topic lift with 90% ranges** (root, slide 3). Strong, and the only one of the seven that draws its uncertainty. Keep. Per-video support: highlight the video's topic row.
4. **Universal resonance curve** (root, slide 4). The frame is right — a dimensionless overlay about x = ratio to baseline — but as drawn it plots a physics response function, not data. Make it earn the name: overlay the actual normalized poller trajectories on the same axes. The data exists (850 watched videos, growing nightly).
5. **Patterns charts** (/evidence, Patterns tab). Already the best evidence surface in the product: every poller reading, log scales, the same ratio guides at .5x, 1x, 3x on every chart. It stays whole-population: its value is the volume of lines, and a single video's takes would reduce it to a handful (the per-video highlight idea is retracted on this ground).
6. **The octagon template** (comparison page, mRI tab). Keep, after the axis repair above: craft axes only, outcome shown beside it as the number, never inside the shape.
7. **The per-video normalized curve.** Buildable now for poller-watched videos; honestly absent for the rest — an empty curve states that the video rose before watching began, which is itself information.

An eighth chart replaces the retracted idea and is the literal mRI: **the per-video deviation field.** Every documented variable of one video — the composition measures (per-frame, so hundreds of lines), transcript measures, length, title, engagement rates — each drawn as its deviation from the outperformers' norm for that channel. The volume of lines comes from the variable count, not the video count, so one video fills the frame the way the patterns field does. The viometrics charts (striation timeline, 44-cell percentile heat bar) are the existing kin; this extends their grammar to the full variable library rather than inventing a new one. The "norm" per variable is the within-channel typical value among settled videos at or above 3x — computable from data on hand, no spend.

## The per-video assembly

One card per video, three elements, all from data on hand: the number (settled surplus R), the octagon (craft template), the curve (normalized trajectory where the poller watched). Everything computes in node over existing JSON and poll files; nothing requires a model run, a GPU, or an API purchase. Total cost: under $0.10 of S3 reads.
