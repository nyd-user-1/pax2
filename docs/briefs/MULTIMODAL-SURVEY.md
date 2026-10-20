# Multimodal survey — stock weights before any training

Date: 2026-10-20. Status: for review, nothing launched. Decision owner: Brendan.

## The question

Does a learned video embedding carry outcome signal that text plus behavior does not already carry? That is the only reason to open this lane. The bars it must clear already exist, all measured on the PAX2 Encoder's 10 held-out channels:

| Already measured | Number | Where |
|---|---|---|
| Hand-built composition features, pair accuracy | 0.566 (leave-one-channel-out 0.525) | Composition Ranker, Gate X |
| Composition plus encoder neighbors, pair accuracy | 0.595 — ties Classifier v1, does not beat it | Composition Ranker combined |
| Composition added to Classifier v3 | failed: 0.589 against v3's 0.648 (+0.005 on the 1,212 held-out rows with media) | v3b, Gate C |
| Text alone (transcript + embedding), held-out AUC | 0.648 | Classifier v3, serving |

v3b is the standing warning: features derived from the video file added nothing held-out. A video *embedding* gets one chance to do what named features could not.

## The evaluation — no training, one attempt per candidate

**Materials, already on hand:** 5,077 shorts with media measured (339,444 seconds total, 66.9 s average), in S3 under `catalog-media/`; 2,481 same-channel pairs with media on both sides; 590 of those pairs on the held-out channels. The holdout is the encoder's, unchanged. No new fetching.

**Two reads per candidate, bars registered before any run:**

- **Gate M1 — pair read.** Embed every video. Fit the shipped pairwise recipe (Bradley–Terry logistic, L2 0.001, no intercept — the Composition Ranker's exact settings) on 32 principal components of the embedding, training pairs only; read accuracy on the 590 held-out pairs. **Bar: 0.615** — above combined's 0.595 by 0.02, so it must beat everything composition plus text neighbors already does.
- **Gate M2 — classifier add.** v3's recipe plus 32 components of the video embedding, v3b's exact protocol, read on the same 1,212 held-out rows. **Bar: +0.02 over v3 on those rows** (composition managed +0.005).

One run per candidate at the registered settings; no tuning; the Mac rescores every number from the uploaded predictions. Either gate passing opens the lane; both failing sends the candidate to the diagnosis section, not to the trash.

## Candidates

| Candidate | What it is | License / terms | Why it's in |
|---|---|---|---|
| **Frame-mean CLIP ViT-B-32** (rung 0) | Mean-pooled frame embeddings from the model already in v1's thumbnail arm, 1 frame/s | MIT | The control. Costs almost nothing and answers "do frames beyond the thumbnail carry anything at all." If rung 0 ties the real candidates, the lane is thin. |
| **VideoPrism LVT** (`google/videoprism-lvt-base-f16r288`, `-lvt-large-f8r288`) | Video-native encoder with a text tower, built for cross-modal retrieval; weights on HF since July 2025 | Apache 2.0 (per the GitHub release) | The primary open candidate: the only one here trained end-to-end on video with text alignment. |
| **Perception Encoder** (`facebook/PE-Core-L14-336`; `G14-448` if L14 leads) | Image-text encoder with published video-by-frame-sampling results; 310k monthly downloads | On the HF card — confirm at pull | The strong frames-plus-text baseline a video-native model has to beat to justify itself. |
| **V-JEPA 2** (`facebook/vjepa2-vitl-fpc64-256`) | Self-supervised video model, motion and temporal structure, no text tower | MIT | Tests a different hypothesis: that *motion* carries the signal. The learned cousin of the composition features that failed — if it passes where they failed, that is a finding about representation, not features. |
| **Marengo Embed on Bedrock** (buy lane) | Twelve Labs' video-native embedding, served on Bedrock — the same vendor surface Pegasus 1.2 already runs on in the analyze chain | $0.00070/second of video, $0.0001/image, $0.00007/text request (Bedrock pricing page, read 2026-10-20) | The ceiling check: if the best money can rent clears the gates and open weights don't, that prices the build-vs-buy question with real numbers. No new wiring — the parked Twelve Labs key stays parked; Bedrock is the path. |

**Ruled out for now:** InternVideo2 stage-2 (reported weak at zero-shot embedding similarity — vendor-blog claim, so it's a skip, not a verdict), LanguageBind (superseded by the above), X-CLIP (kept as a fallback cheap rung if VideoPrism won't run).

## Costs

Measured arithmetic on the 339,444 seconds of media:

- **Open weights, all 5,077 videos:** one GPU box (g6e.xlarge, L40S, the encoder-retrain pattern with watchdog shutdown). Frame decode dominates compute. Estimated $5–15 per candidate — an estimate, not a measurement; the rehearsal run prices it.
- **Marengo, held-out pairs first:** the 590 held-out pairs' videos only — about $55 at the listed rate. Full media set $237.61; full catalog (19,036 videos, 1,268,994 s) $888.30 per pass. Sequence: open weights on everything, Marengo on the held-out subset; extend Marengo only if it leads the board.
- **Mac does nothing heavy.** Embedding, PCA, and fits run on the box; the Mac rescores from JSON.

## The decision tree

**A candidate clears a gate.** The lane is real. Then — and only then — training has a reason: port the resonance recipe to video (contrastive fine-tune on co-outlier and co-surge groups, the same groups that passed Gate B on text). Cheapest first: a projection head on the frozen stock embedding before any tower is touched. Buy-versus-build gets decided by the board: Marengo's score against the best open score against $888 per catalog pass against a one-time fine-tune.

**Nothing clears.** We do not conclude "video carries nothing" — we ask why, in order, each check cheap and named:

1. **Sampling and pooling.** 1 frame/s mean-pooled may blur exactly what matters (the hook, the cuts). One retry for the best candidate at denser sampling with attention pooling — same bar, declared in advance, the encoder-retrain rule.
2. **The pair set is label-picked.** Media exists only for pairs chosen by the outcome label (v3b's caveat). Re-read the best candidate on a label-blind media sample before trusting a null.
3. **Ceiling check.** Compare against text's 0.648 on the same rows: if text saturates the predictable part, video's null is about label noise, not video.
4. **Domain gap.** These encoders pretrained on general video; political talking-head Shorts are a narrow slice. Sanity-read retrieval: a video's nearest neighbors should at least share visual format (talking head, graphic card, rally footage). If they don't, the stock representation can't see this domain — which is the case *for* domain training, not against it. That is the Twelve Labs precedent: they started with encoders that couldn't see their domain and trained until one could.

What we never do is train because the calendar said so. Training happens when a diagnosis names the mechanism it would fix.

## Sources

- Bedrock pricing, TwelveLabs section (read 2026-10-20): https://aws.amazon.com/bedrock/pricing/
- Marengo Embed 3.0 on Bedrock, model card: https://docs.aws.eu/bedrock/latest/userguide/model-card-twelvelabs-marengo-embed-3-0.html
- Twelve Labs' own rate for comparison ($0.042/min video = the Bedrock per-second rate): https://www.twelvelabs.io/pricing-calculator
- VideoPrism repos and license: https://github.com/google-deepmind/videoprism · https://huggingface.co/google/videoprism-lvt-base-f16r288
- V-JEPA 2 license and checkpoints: https://github.com/facebookresearch/vjepa2 · https://huggingface.co/facebook/vjepa2-vitl-fpc64-256
- Perception Encoder: https://huggingface.co/facebook/PE-Core-L14-336
- InternVideo2 zero-shot caveat (vendor blog, unverified): https://www.mixpeek.com/blog/video-embedding-benchmark-2026
