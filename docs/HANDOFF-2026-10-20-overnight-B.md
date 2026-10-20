# Handoff, 2026-10-20 08:20 UTC — overnight window B (PLUM baseline + the resonance encoder)

The full before/after ledger is `docs/PLUM-RESONANCE.md`. Everything below is committed (10cd0e7 through 9ab4037), nothing pushed.

## Results

- **PAX2 Resonance Encoder passed both gates.** Behavior arm (co-outlier + poller-measured co-surge, λ 0.144): Gate B 0.5824 vs the serving encoder's 0.5618 (+0.0207; channel-block bootstrap 95% +0.012 to +0.031; 6 of 7 held-out channels), Gate E 0.6050 (+0.0273 over stock). Selected by the pre-registered rule. Published private: NYSgpt/pax2-resonance-encoder.
- **The publish-week co-surge proxy teaches topic, not behavior.** The full arm (proxy added, λ 0.25) reads higher on Gate E (0.6146) and lower on Gate B (0.5781). Published private, not selected: NYSgpt/pax2-resonance-encoder-full.
- **PAX2 Semantic-ID Model failed Gate S on both allowed attempts** (0.5584, 0.5708 vs 0.5775). Recorded, published private with the failure on its card: NYSgpt/pax2-semantic-id-model.
- **Semantic IDs, PLUM baseline:** uniqueness 0.306 at 40/64/64 on the serving index; level 1 matches the cluster map at NMI 0.862. On the resonance index uniqueness falls to 0.251: the behavioral term packs the space tighter for plain k-means, the opposite of PLUM's jointly trained quantizer.
- **Behavioral table:** 8,924 of 18,544 settled shorts carry a behavioral neighbor. Co-surge is mostly proxy (only 99 crossings measured by the poller). No commenter data exists in PAX2, so co-commenter coverage is 0.

## Decisions that are Brendan's

1. **Which encoder serves.** `current.json` still points at 20261019-094112-train. The resonance index is staged at `s3://pax-2-638175140432/model/encoder-index/20261020-072936-resonance-train-behavior/`, with the same rows and order. Not flipped, because window A's retrain moves the same pointer tonight. The trade: +0.021 Gate B against −0.003 pooled and −0.005 within on the semantic benchmark. A third option is the resonance term retrained on A's larger corpus, about $1.40 on the same launcher.
2. **Route (2) for Gate S**, ruled by the peer lead and accepted here, not yet run: one re-quantize on A's index if A's encoder passes Gate E, at the same 0.5775 bar, with both earlier fails beside the result. A's box (g5.xlarge, run 20261020-070703-train) was still training at 08:20 UTC.

## Peer-lane exchange, for the record

The peer lead asked for two 1% rehearsals to choose between arms. They were declined as noise: the slice holds one held-out channel. Two full arms on one box replaced them, and the peer approved. The peer then authorized a third Gate S model class after two fails. That was declined as forking paths past the brief's one-retry limit, and the peer withdrew it.

## Collision noted

Window A's corpus rebuild at 07:06 UTC overwrote `s3://nsr-embed-v2/pax2/corpus/` and `data/generated/model/encoder/holdout.json` (89 ids moved). The first pin of this window copied A's new corpus. It was caught by size before the training launch and replaced with the original (md5 cd025ba0…). Window B's held-out set lives at `data/generated/model/plum/holdout.json`. A's files were not touched.

## Spend (measured from run times)

About $1.62 of the $4 ceiling: rehearsals $0.02 + $0.17 (g6.xlarge), training box $1.42 (g6e.2xlarge, about 38 min), publish boxes about $0.01. All five boxes verified terminated.
