---
license: other
tags: [pax2, semantic-ids, plum, youtube-shorts]
---

# PAX2 Semantic-ID Model (PLUM baseline) — failed Gate S

**Status: failed its gate on both allowed attempts; recorded, not served.**

Three-level residual k-means semantic IDs (codebooks 40 / 64 / 64) over the PAX2 Encoder's serving index (run 20261019-094112-train, 18,455 shorts, 1,024 dimensions), after PLUM (arXiv 2510.07784, section 3.1). As a predictor, a held-out short scores the outlier share of the training shorts in its (c1, c2) cell. Codebooks are fit on the 14,586 training shorts only; the 3,869 held-out shorts (10 held-out channels) are assigned to them.

## Gate S

Pre-registered: pooled AUC on the held-out channels above stock bge-m3's kNN-AUC, 0.5775.

| Attempt | Rule | Pooled AUC | Within-channel AUC | Result |
|---|---|---|---|---|
| 1 | c1c2 cell share; hard backoff to c1 under 20 training shorts | 0.5584 | 0.5711 | failed |
| 2 | c1c2 share shrunk toward the c1 share with 20 pseudo-shorts | 0.5708 | 0.5709 | failed |

On the same held-out shorts the PAX2 Encoder's 20-nearest-neighbor score reads 0.6080 pooled. A cell table this coarse carries less than the neighbors do.

## The IDs as a quantizer

- Uniqueness (share of shorts alone on their full ID): 0.306 at 40/64/64; 0.452 at 40/128/128; 0.541 at 40/256/256.
- Share of a short's 10 raw-cosine neighbors sharing its code: c1 0.811 (chance 0.035), c1c2 0.384, full ID 0.130.
- Level 1 against the cluster map's own k=40: NMI 0.862, adjusted Rand 0.717.

## Files

- `semantic-id-model.json` — the cell tables, both attempts, the bench (per channel and per family).
- `semantic-ids.json` — every short's (c1, c2, c3) on the full index, with the quantizer measurements.

Code: `scripts/plum/semantic_ids.py`, `scripts/plum/semantic_id_model.py` in the PAX2 repository. Ledger: `docs/PLUM-RESONANCE.md`.
