# PAX2 Video Resonance — ledger

Window MM-B, brief `docs/briefs/MM-B-video-resonance-train.md`. Every run in order: its declaration first, then its numbers. Declarations are committed before the run they declare.

## Gate M3 (registered by the brief, copied here before any run)

The trained head's held-out pair accuracy, read by MM-A's Gate M1 scorer (PCA-32 fit on training-pair videos, Bradley–Terry L2 0.001 no intercept, the 590 held-out media pairs, channel-block bootstrap 95%), must be at least stock base-arm M1 + 0.02 and above the rung-0 control (frame-mean CLIP). Reported, not gated: the Gate B analog, the M2 classifier add with the trained embedding, and the outperformed-5× and 10× reads (pooled, with interval and subset size; never used for selection).

## Groups (2026-10-21 03:34 UTC, `scripts/video-resonance/groups.mjs`)

- Media set: 5,058 settled shorts with measured video. Train 3,385 on 34 channels; validation 461 on 8 training channels carved by seeded order (10–15% of training media); held out 1,212 on the encoder's 10 channels.
- Co-outlier: 34,615 pairs within train; 1,667 train shorts have a neighbor.
- Co-surge (measured crossings, same ISO week, same cluster): only 42 train media shorts were ever polled, 22 measured crossings, 26 pairs, 17 shorts with a neighbor. The behavioral term is co-outlier in practice: 4,911 co-outlier positives against 6 co-surge.
- 1,669 behavioral groups (anchor, up to 3 positives, 7 random train negatives).
- Held-out check, programmatic: 0 held-out ids, 0 validation ids, 0 ids outside train across every group. Semantic groups are mined on the box from the stock embedding and asserted the same way.
- M1 pairs: 2,481 with video both sides; 1,665 train, 226 validation, 590 held out.

## Selection rule

Variants are compared only on the validation read: the M1 protocol fit on the 1,665 train-split pairs, read on the 226 validation pairs. The 590 held-out pairs are read once per declared variant and reported every time. Every head is trained without the validation channels, so the head that ships is the head that was read.

## Run 0 — plumbing rehearsal (declared 2026-10-21 03:40 UTC)

Stand-in vectors (seeded Gaussian, 768-d) on a 1-in-20 slice, variant v1, before MM-A's embeddings exist. Purpose: the box installs, groups load, semantic mining, training, scoring, uploads and termination all work. Its numbers are never quoted.

## Variant v1 (declared 2026-10-21 03:40 UTC)

Head Linear(d, d) → GELU → Linear(d, 512), L2-normalized; InfoNCE temperature 0.02; L = L_sem + 0.144 · L_con; AdamW lr 0.001, weight decay 0.01, batch 64 groups per term, 20 epochs over the semantic groups, 10% warmup then cosine; seed 20261020.
Hypothesis: the text recipe's exact shape on video — a head that keeps stock's same-channel, same-tier geometry while pulling co-outliers together separates outliers from controls better than stock on unseen channels.

### Run 0 result (03:41–03:43 UTC)

Two launches failed and were fixed before the third: the M1 scorer's signature (03:37), and a slice that kept no held-out pairs (03:39; the slice now keeps both sides of every 20th pair). Run vres-rehearse-20261021-034125 ran clean end to end: install, groups, semantic mining (0 held-out or validation ids), 20 epochs, every read, uploads; the Mac rescorer agreed on every check; the box terminated itself. Three c7i.xlarge boxes, about 2 to 6 minutes each, under $0.05 together. Numbers not quoted.

## Scorer (03:55 UTC, before any real run)

Gate M3 is read by MM-A's own `scripts/video/gate_m1.py` and pair file `data/generated/model/video-pairs.json`, staged unchanged onto the box, with their md5 in the box log. Each head's embedding goes in as one more arm beside stock and rung 0. train.py's port of the same protocol supplies the validation read and the Gate B analog. Its held-out stock number must equal gate_m1.py's before any head is gated (the models window's condition). The Mac rescores both sets of predictions.

### Run 0b — real-vector rehearsal (04:01–04:03 UTC)

The same path on MM-A's 1-in-20 rehearsal embeddings (run 20261021-035437-slice20, base arm and rung 0): train.py, then gate_m1.py (md5 2f3663978d87526f8c76841cfc5112a2) over stock, rung 0 and v1, then upload; the box terminated itself. Numbers not quoted. One change before the full run: the port now treats a pair with an unembedded side as gate_m1.py does (difference 0) instead of dropping it.

## Run 1 — v1, full (vres-v1-20261021-043210, 04:32–04:34 UTC)

Inputs: MM-A's full stock embeddings, run 20261021-040633-full (5,108 videos, 0 failures), base arm 768-d, with rung 0 alongside. The pair file is identical to `video-pairs.json` (2,481 pairs, all keys match). 3,374 semantic groups (11 anchors skipped) and 1,669 behavioral groups, with 0 held-out or validation ids. 1,040 steps in 27 s on a c7i.xlarge. The semantic loss fell from 5.72 to 2.00; the behavioral loss fell from 5.99 to about 4.1 by epoch 5 and stayed there.

| Arm | M1 held-out (590) | 95% interval | 5× (379) | 10× (184) | Validation (226) | Gate B analog (9,039 pairs, 7 channels) |
|---|---|---|---|---|---|---|
| Stock VideoPrism base | 0.5576 | 0.4948–0.6180 | 0.5778 | 0.6033 | 0.6327 | 0.5441 |
| Rung 0, frame-mean CLIP | 0.5119 | 0.4629–0.6240 | 0.5092 | 0.5543 | 0.5752 | 0.5109 |
| v1 head | 0.5508 | 0.4813–0.6191 | 0.5673 | 0.5707 | 0.6018 | 0.5488 |

**Gate M3: FAIL.** v1 reads 0.5508 against a bar of 0.5776 (stock 0.5576 + 0.02). It is above rung 0's 0.5119 but below stock itself. The Gate B analog moves +0.0048 over stock (interval −0.0191 to +0.0066). The head also loses on the validation channels, 0.6018 against stock's 0.6327, so the loss is not an artifact of the held-out read. One more reading: PCA-32 explains 0.911 of the head's variance against 0.543 of stock's. The head compresses the space, and its leading components carry the semantic term's channel-and-tier structure.

Verification: gate_m1.py (MM-A's scorer) and train.py's port give identical held-out, 5× and 10× numbers on every arm. The Mac reproduces every accuracy exactly, from both prediction files. The Mac's independent bootstrap intervals land within 0.01 of the box's on every arm except v1's lower bound (box 0.4813, Mac 0.4922, a 0.011 gap with only 10 channels to resample); the tolerance stays where it was set. The box terminated itself.

## Variants v2 and v3 (declared 2026-10-21 04:45 UTC, before either runs)

Both are new variants, not a retry of v1. They run on one box, are selected between on the validation read only, and both have their held-out read reported.

- **v2:** v1 with λ = 1.0. Hypothesis: at 0.144 the semantic term dominates, so the head relearns stock's geometry with information lost (validation fell) while the co-outlier term barely moves (behavioral loss flat at about 4.1 from epoch 5). Equal weight lets co-outlier structure actually shape the space.
- **v3:** v2 stopped at 5 epochs. Hypothesis: the validation drop is drift on the 34 training channels. The behavioral loss had flattened by epoch 5 while the semantic loss kept falling, so the extra 15 epochs fit training-channel geometry, not co-outlier structure.

Bar unchanged: Gate M3 at stock + 0.02 (0.5776) and above rung 0 (0.5119).
