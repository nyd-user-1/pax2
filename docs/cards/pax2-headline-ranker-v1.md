---
license: cc-by-4.0
base_model: google-bert/bert-base-uncased
pipeline_tag: text-classification
tags:
- headlines
- pairwise-ranking
- upworthy
---

# PAX2 Headline Ranker v1 (bert-base-uncased)

Which of two headlines for the same story wins the click. bert-base-uncased with one linear unit on its pooled output, scoring one headline; trained on the Upworthy Research Archive's randomized headline tests. Run `20261018-060508-train`.

`v0/headline-model.json` holds v0, the linear model before it (below).

## Training

- 41,175 winner-loser pairs from 12,454 confirmatory tests: within each test, packages pooled by headline across image variants, headlines with at least 1,000 pooled impressions kept, the highest pooled click rate the winner and paired against each loser, 5 tied tests skipped. The same construction and the same seeded 80/20 split by test as v0 (`scripts/rig/headline_v0.py`), so the two held-out sets are one set.
- 32,935 training pairs, 8,240 held-out pairs in 2,490 held-out tests.
- Loss: -log sigmoid(score(winner) - score(loser)). 3 epochs, batch 64 pairs, AdamW at 2e-5 with 10% warmup and linear decay, max length 40 tokens, bf16 autocast, gradient clipping at 1.
- One NVIDIA L4 (g6.xlarge): 66, 60 and 61 seconds an epoch, 215 seconds for the job; the box ran 13.5 minutes end to end, about $0.18 at $0.805 an hour. A 60-test rehearsal ran first, 9.7 minutes, about $0.13.

## Benchmark

Held-out pairwise accuracy, the share of held-out pairs where the winner scores higher.

| | Accuracy |
|---|---:|
| Chance | 0.500 |
| v0, the ten pattern flags and two counts | 0.590 |
| v0, flags, counts and 2,000 tokens | 0.610 |
| v1 before training | 0.516 |
| **v1, best epoch (1)** | **0.672** |
| v1, epoch 2 | 0.670 |
| v1, epoch 3 | 0.669 |

Gate H, pre-registered 2026-10-18: at least 0.6301, v0 plus 0.02. **Passed.** The Mac's second scorer (`scripts/headline/rescore.mjs`) recomputed 0.6722 from the uploaded pair scores, agreeing with the box. In 1,069 of the 2,490 held-out tests (0.429) the winner scored above every loser.

## Serving

Since 2026-10-18 the pax2-headline Lambda runs `model-v1.onnx` in ONNX Runtime; PAX2 reads each score against the scores of 10,452 held-out Upworthy headlines and shows a percentile. v0 stays the fallback when the function is absent or fails.

## v0

`v0/headline-model.json`: pairwise L2 logistic regression on the winner-minus-loser difference of ten pattern flags (a digit, "this" or "these" first, a question, "you", a quote and others), two counts and presence of 2,000 tokens; C 0.03 by grouped 5-fold cross-validation on the training tests (`scripts/rig/headline_v0.py`). The file carries its own regexes, tokenizer, vocabulary, weights, means and intercept:

```
p(beats a typical rival) = sigmoid(intercept + sum_j weight_j * (feature_j - mean_j))
```

## Caveats

- Upworthy's headlines are 2013 to 2015 news-site headlines; PAX2's titles are 2026 political shorts. The transfer is untested.
- Training loss kept falling after epoch 1 while held-out accuracy did not: epochs 2 and 3 overfit. The saved weights are epoch 1's.
- One base model, one run, no tuning of the learning rate or length.
- Scores are relative within a story; the number for one headline alone means little.
