# MM-B — behavior trained into the video embedding

You are window MM-B. Your job: build the behavioral training groups and the training harness while MM-A embeds, then train a projection head on MM-A's frozen stock VideoPrism embeddings and gate it. Goal: a fitted, gated, published model tonight; iterations are allowed if each is declared before it runs.

Date: 2026-10-20. Protocol root: `docs/briefs/MULTIMODAL-SURVEY.md` (commit 4fba6d3) and MM-A's brief beside this one. Decision owner: Brendan. The models window monitors and arbitrates flags; Brendan decides.

## House rules (non-negotiable)

- Nothing heavy on the Mac. Boxes are self-terminating EC2 with a watchdog `shutdown` (patterns: `scripts/composition/launch.sh`, `scripts/classifier/launch.sh`). A c7i.xlarge is enough for head training on cached embeddings; flag before renting anything bigger.
- Git: stage by explicit pathspec, commit per step, never push.
- Never quote unmeasured or rehearsal-slice numbers.
- Budget: about $4. Flag past it (SendMessage to the models window; fallback `docs/flags/MM-B-<topic>.md`).
- The serving pointer moves for nobody tonight. Fitted models publish to HF, private, under NYSgpt with the Martian naming (`NYSgpt/martian-video-encoder`), pass or fail stated on the card — the house rule is same-day publication, success not required.

## Stage 1 — groups and harness (no dependency on MM-A)

**Behavioral groups, the resonance recipe ported to the media set** (mining code to reuse: `scripts/plum/`, the run that passed Gate B on text):

- Co-outlier pairs: same channel, both at or above 3x the channel's median of settled shorts, published within 45 days, media on both sides.
- Co-surge pairs: both crossings of the channel median measured by the velocity poller, media on both sides.
- Groups: anchor, up to 3 behavioral positives, 7 negatives sampled from training-set media shorts.
- Semantic groups, the preserving term: each training media short with its 3 nearest same-channel, same-tier neighbors under MM-A's stock base-arm embedding (buildable only after embeddings land; everything else first).

**The holdout is the encoder's 10 channels, unchanged** (`scripts/composition/fit.mjs` reads it). Zero held-out videos in any group, as anchor, positive or negative — verify programmatically and record the check in the bench file, the house pattern.

**Harness:** PyTorch. A projection head on frozen embeddings — 2 layers, input the stock dimension, output 512, L2-normalized. InfoNCE at temperature 0.02 over semantic groups plus behavioral groups at λ = 0.144 — the text recipe's exact shape. Rehearse end to end on a 1-in-20 slice; slice numbers never quoted.

## Stage 2 — train and gate (starts when MM-A's base-arm embeddings land in S3)

**Gate M3, registered here, before any full run:** the trained head's held-out pair accuracy, read by MM-A's exact Gate M1 scorer (PCA-32 on training videos, Bradley–Terry L2 0.001 no intercept, the 590 held-out media pairs, channel-block bootstrap 95%), must be **at least stock base-arm's M1 + 0.02, and above the rung-0 control**. Secondary reads, reported not gated: the Gate B analog (mean cosine to the channel's prior outliers, 45-day pairs) and the M2 classifier add re-read with the trained embedding.

**Iterations:** more than one training run is welcome tonight. Each variant (λ, head width, group mix) is declared in the ledger with its hypothesis BEFORE it runs; selection between variants happens on a validation split carved from training channels — never on the 590 held-out pairs, which are read once per declared variant and reported every time, pass or fail. A failed variant gets one retry at the same bar only if the ledger names what changed and why, the overnight rule.

**Secondary reads at 5× and 10×:** every bench also reports the outperformed-5× and outperformed-10× reads, under MM-A's definitions and rules (pooled only, with interval, subset sizes stated). They pass or fail nothing and never enter variant selection; the training label and Gate M3 stay on outperformed 3×.

**Verification:** upload per-pair predictions; the Mac rescores every arm before any number is reported.

## Report

Ledger: `docs/VIDEO-RESONANCE.md` — every run, its declaration, its numbers, in order. Commit per step with the run card in the message. Publish the selected head (and the recipe, groups manifest, bench) to `NYSgpt/martian-video-encoder`. Message the models window at: harness ready, first full run done, each gate read, and close-out. Confirm your box terminated.
