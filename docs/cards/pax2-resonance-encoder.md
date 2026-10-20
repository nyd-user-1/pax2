---
license: mit
base_model: BAAI/bge-m3
tags: [pax2, sentence-embeddings, plum, contrastive, youtube-shorts]
---

# PAX2 Resonance Encoder (behavior arm)

**Status: passed Gate E and Gate B (run 20261020-072936-resonance-train).**

The PAX2 Encoder recipe (bge-m3, FlagEmbedding dense-only fine-tune, 1 epoch, batch 16, temperature 0.02) with a behavioral co-occurrence term after PLUM (arXiv 2510.07784, eq. 1). FlagEmbedding's InfoNCE runs over the 14,573 semantic groups mined from stock neighbors plus 2,091 co-occurrence groups (λ = 0.144): an anchor, up to 3 behavioral neighbors as positives, 7 random training shorts as negatives. Behavioral neighbors are co-outliers (same channel, within 45 days, both outliers) and co-surge pairs whose two crossings of the channel median the velocity poller measured. Trained on the pinned corpus and holdout of run 20261019-094112-train (18,455 shorts, 10 held-out channels, 3,869 held-out shorts), so the co-occurrence term is the only change against that encoder.

## Gates (held-out channels only; no held-out short in any training group)

| Gate | Rule | Stock bge-m3 | PAX2 Encoder (094112) | This model |
|---|---|---|---|---|
| E pooled kNN-AUC | ≥ stock + 0.02 | 0.5777 | 0.6080 | **0.6050** (+0.0273) |
| E within-channel kNN-AUC | ≥ stock | 0.5820 | 0.6035 | **0.5985** |
| B same-channel pair ranking | ≥ PAX2 Encoder + 0.01 | 0.5311 | 0.5618 | **0.5824** (+0.0207, channel-block bootstrap 95% +0.012 to +0.031) |

Gate B: inside each held-out channel, every outlier/non-outlier pair published within 45 days, each short scored by mean cosine to the 5 most similar of the channel's outliers published before both; right when the outlier scores higher. 13,983 pairs over 7 scorable channels; this model wins 6 of the 7 against the PAX2 Encoder.

The trade, stated plainly: Gate B rises 0.021, the semantic kNN benchmark gives back 0.003 pooled and 0.005 within against the PAX2 Encoder; both stay above stock by the margins Gate E requires.

The sibling arm (adds publish-week co-surge, λ = 0.25) is `NYSgpt/pax2-resonance-encoder-full`: higher on Gate E (0.6146), lower on Gate B (0.5781).

Ledger: `docs/PLUM-RESONANCE.md` in the PAX2 repository. Code: `scripts/plum/`.
