# Overnight window A — the data chain (captions, media, Whisper, both retrains, task 7, rebuilds)

Brendan signed off 2026-10-20 ~03:00 Eastern. Read `docs/LEAD-LOOP.md` rules first: real service names; nothing heavy on the Mac; every box self-terminates with a watchdog `shutdown` first; stage by explicit pathspec and never push; never quote an unmeasured number; no local typechecks. Spend ceiling for this window: **$8** total, each launch logged with measured cost.

## The chain, in order (1–2 run in parallel with 3)

1. **Captions fleet relaunch.** `APPLY=1 MODE=captions TARGETS=data/raw/captions/fleet-targets.txt ./scripts/catalog-media/fleet.sh`. Read one aborted box's log first (`s3://pax-2-638175140432/logs/pax2-fleet-20261019-191717-box1.log`) to see whether the walled IPs recovered. Measured rate last run: 4,136 transcripts / 140 min / 8 working IPs. 6,860 ids remain. ~$0.25.
2. **Media fleet, rest of catalog.** `APPLY=1 ./scripts/catalog-media/fleet.sh` (pairs mode, default targets) — resumes by S3 census, done ids skip. ~$0.50, ~2.5 h. Stop any Mac downloader first.
3. **Encoder retrain at the current 9,368-transcript corpus — now, not after captions.** `node scripts/encoder/corpus.mjs --upload`, then `MODE=train ./scripts/encoder/launch.sh` (g6e.xlarge, ~35 min, ~$1.40), watched to termination, Mac rescore with `scripts/encoder/rescore.mjs`. Gate E as always (+0.02 pooled over stock bge-m3; last pass 0.6080 vs 0.5775 at 5,232 transcripts). This is the second measured point on the transcripts→score curve.
4. **When 1 and 2 finish: Whisper the gaps.** Only ids still lacking text whose audio is now in S3 — the catalog-audio pattern (`scripts/catalog-audio/`, av pinned 15.1.0, decode-probe preflight, watchdog). Merge with `node scripts/catalog-audio/merge.mjs`. Budget $3 hard stop.
5. **Full-corpus retrain.** Corpus rebuild, retrain, rescore, Gate E. If E passes, the reranker trains on the same run (Gate R). ~$1.40.
6. **Task 7 — classifier retrain with the new features.** The training set gains each short's encoder embedding (from the serving index run that passed) and transcript features. Gate C: held-out AUC must beat v1's 0.604 (v2 read 0.597 on 3,424 transcripts). c7i-class box, ~$0.25. The app reads the new model only on a pass, by the existing `modelFor` rule.
7. **Rebuilds on every passing retrain:** serving index + `current.json` pointer (`scripts/encoder/` launcher), vector-graph rebuild (`scripts/encoder/map-launch.sh`).

## Raised bar (Brendan, ~03:25 Eastern)

Task 7 ends in a shipped model, not an attempt: if Gate C fails, take ONE more measured iteration (feature mix, calibration, regularization) at the same 0.604 bar before reporting. And a task 7b if window C's `composition.json` lands before ~06:30 Eastern: retrain once more with compositional features added — a second classifier, same gate, its own ledger row. Open Hugging Face models may be pulled where they help; ceilings unchanged — if a ceiling blocks a likely-passing run, flag it in the handoff instead of spending.

## After each step
Update the model cards, `src/lib/project-management.ts` rows, the SPEC status lines; commit per finished step with explicit paths; publish fitted models private under NYSgpt (`scripts/hf-upload.mjs` small files, `scripts/encoder/publish.sh` weights) — they join the PAX collection. Record every measured number (cost, duration, gate values) in the morning handoff. If a gate fails, stop that branch and say so plainly; the previous model keeps serving.
