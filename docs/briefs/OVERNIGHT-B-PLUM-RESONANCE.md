# Overnight window B — PLUM baseline + the resonance encoder (behavior into the embedding)

Brendan signed off 2026-10-20 ~03:00 Eastern. Context: arXiv 2510.07784 (PLUM — YouTube's generative retrieval over Semantic IDs). The portable lessons we are taking: (1) the item representation is the asset; (2) a co-occurrence contrastive signal was their largest single ablation win (Recall@10 12.6→14.4, SID uniqueness 91.8→96.7); (3) domain adaptation beats model size. We are NOT building generative retrieval — 18k videos, no watch logs. Rules: `docs/LEAD-LOOP.md` — real service names, boxes self-terminate, stage by pathspec, never push, no unmeasured numbers. Spend ceiling: **$4**.

## Part 1 — PLUM baseline: semantic IDs over the current embeddings (Mac-scale, no spend)

Quantize the passing encoder's corpus embeddings (serving index under `s3://pax-2-638175140432/model/encoder-index/`, pointer in `current.json`) into hierarchical semantic IDs: residual k-means, 3 levels, codebook sizes chosen so level-1 ≈ the existing k=40 clusters remain legible. New scripts under `scripts/plum/`, pure Node or a small Python venv on the Mac. Outputs: `data/generated/model/semantic-ids.json` (id → [c1,c2,c3]), plus measured ID uniqueness and a nearest-neighbor agreement check against raw cosine neighbors. This is the baseline every later version is judged against.

## Part 2 — the behavioral signal table (Mac-scale, no spend)

One table, `data/generated/model/co-occurrence.json`: for each short, its behavioral neighbors by signals we actually have — (a) same-channel outcome pairs (the 18,531 settled rows `src/lib/pairwise.ts` reads), (b) co-surge: shorts crossing their channel's 1x line in the same week within the same cluster (the poller's series + catalog), (c) same-commenter overlap where comment data exists. Document each signal's coverage honestly — how many shorts have at least one behavioral neighbor.

## Part 3 — the resonance encoder (one GPU run, ~$1.40)

The existing encoder training (`scripts/encoder/`) gains a contrastive co-occurrence term from Part 2's table (PLUM's Lcon, eq. 1: pull behavioral neighbors together, push the batch apart), weighted so the semantic objective still dominates. Launch on the `scripts/encoder/launch.sh` pattern with a 1% rehearsal first. Gates, pre-registered:
- Gate E unchanged (+0.02 pooled over stock) — the behavioral term must not break semantic quality.
- **Gate B (new):** held-out same-channel pair ranking — does cosine similarity to known Hits separate Hit from non-Hit better than the pure-semantic encoder? Both encoders scored on the identical held-out pairs; the resonance encoder ships only if it wins both gates.

## The docs page — Brendan's requirement, not optional

`docs/PLUM-RESONANCE.md`: a before/after ledger of EVERY standing measured metric — classifier pooled/within AUC and top-decile lift, Gate C 0.604, encoder Gate E numbers, reranker, velocity AUCs at 1/3/6 h, pairwise 0.550, the cluster-lift findings (+11.9 / −7.9), semantic-ID uniqueness from Part 1. Columns: metric, value before (run id, date), value after, delta, protocol note. Metrics untouched by this work are listed as unchanged. Snapshot the "before" column FIRST, before any training. The same ledger shape applies to window C's page.

Commit per part with explicit paths; fitted weights publish private under NYSgpt and join the PAX collection; findings in the morning handoff with measured costs.
