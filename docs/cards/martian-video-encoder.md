---
license: apache-2.0
base_model: google/videoprism-lvt-base-f16r288
tags: [pax2, video-embeddings, plum, contrastive, projection-head, youtube-shorts]
---

# PAX2 Video Resonance Head (v3)

**Status: failed Gate M3.** Held-out pair accuracy 0.5695 against a bar of 0.5776 (stock VideoPrism base 0.5576 + 0.02). It clears the rung-0 control (frame-mean CLIP, 0.5119) and sits +0.0119 above stock, inside stock's own interval. Published because every fitted PAX2 model is published, pass or fail.

A two-layer projection head (Linear 768→768, GELU, Linear 768→512, L2-normalized) trained on frozen stock VideoPrism LVT base embeddings: 16 frames per video, shorter side 288, center crop. VideoPrism reads no audio. The loss is the text resonance recipe's shape: InfoNCE at temperature 0.02 over semantic groups (3 nearest same-channel, same-tier training videos as positives, 5 nearest other-tier and 2 random as negatives) plus behavioral groups (an anchor, up to 3 co-outliers, 7 random training videos as negatives), here at λ = 1.0, 5 epochs, AdamW 0.001.

The behavioral term is co-outlier in practice: 4,911 co-outlier positives against 6 co-surge, because only 42 training media shorts were ever read by the velocity poller.

## Reads (the encoder's 10 held-out channels; no held-out or validation video in any training group)

| Arm | Pair accuracy, 590 held-out pairs | 95% interval | 5× (379) | 10× (184) | Validation (226) |
|---|---|---|---|---|---|
| Stock VideoPrism base | 0.5576 | 0.4948–0.6180 | 0.5778 | 0.6033 | 0.6327 |
| Rung 0, frame-mean CLIP | 0.5119 | 0.4629–0.6240 | 0.5092 | 0.5543 | 0.5752 |
| v1 (λ 0.144, 20 epochs) | 0.5508 | 0.4813–0.6191 | 0.5673 | 0.5707 | 0.6018 |
| v2 (λ 1.0, 20 epochs) | 0.5661 | 0.5196–0.6564 | 0.5726 | 0.5435 | 0.5796 |
| **v3, this head (λ 1.0, 5 epochs)** | **0.5695** | 0.5327–0.6408 | 0.5805 | 0.6087 | 0.6195 |

The pair read is the Gate M1 recipe: PCA to 32 components fit on training-pair videos, Bradley–Terry logistic, no intercept, L2 0.001, channel-block bootstrap. v3 was selected over v1 and v2 on the validation channels alone. Every head reads below stock on validation, which halted the variants after three. The 5× and 10× columns are secondary and gate nothing.

Reported beside the gate:
- **Gate B analog** (outlier against non-outlier within 45 days, mean cosine to the channel's 5 most similar prior outliers): 9,039 pairs on 7 channels. Stock 0.5441, this head 0.5470 (+0.0029, interval −0.0105 to +0.0100).
- **Classifier add:** the head's 32 components added to PAX2 Classifier v3's features, read on the 1,212 held-out rows with media. v3 alone 0.591, v3 plus this head 0.590 (−0.001, interval −0.029 to +0.029).

Every number was reproduced on a second machine from the per-pair predictions.

## What the failure points at

48.5% of the behavioral groups' random negatives are outliers themselves, because the media set was fetched by outcome label (49.8% outliers). A co-outlier group often pushes an outlier away from other outliers. Other candidates: the behavioral groups are thin (1,669 on 34 channels); the 226 validation pairs cannot separate variants this close; and the head concentrates variance (PCA-32 explains 0.910 of it against stock's 0.543).

## Files

`head-v3.pt` (PyTorch state dict), `variants.json` (every declared variant with its hypothesis), `train.py` and `groups.mjs` (the recipe), `groups.json` (splits, behavioral groups, pairs), `bench-*.json` (every run's reads), `LEDGER.md` (declarations and results in order).
