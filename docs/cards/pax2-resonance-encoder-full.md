---
license: mit
base_model: BAAI/bge-m3
tags: [pax2, sentence-embeddings, plum, contrastive, youtube-shorts]
---

# PAX2 Resonance Encoder (full arm) — passed both gates, not selected

**Status: passed Gate E and Gate B; the behavior arm (`NYSgpt/pax2-resonance-encoder`) scored higher on Gate B and is the one selected, by the rule fixed before the run.**

Same recipe as the behavior arm, with 3,643 co-occurrence groups (λ = 0.25): the behavior arm's 2,091 anchors plus 1,552 whose only behavioral neighbors are publish-week co-surge pairs (both shorts above their channel median, published the same ISO week, same cluster of the k=40 cluster map) — a proxy, since the catalog's settled ratio says a short crossed the median, not when. The two arms differ by that proxy alone. Run 20261020-072936-resonance-train, pinned corpus and holdout of run 20261019-094112-train.

| Gate | Stock | PAX2 Encoder (094112) | Behavior arm | This model |
|---|---|---|---|---|
| E pooled kNN-AUC | 0.5777 | 0.6080 | 0.6050 | **0.6146** |
| E within-channel | 0.5820 | 0.6035 | 0.5985 | **0.6014** |
| B pair ranking | 0.5311 | 0.5618 | 0.5824 | **0.5781** (bootstrap 95% vs PAX2 Encoder +0.004 to +0.023) |

Reading: the proxy pairs raise the semantic benchmark and lower the behavioral one — they teach topic-in-week more than audience behavior.

Ledger: `docs/PLUM-RESONANCE.md` in the PAX2 repository.
