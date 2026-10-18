# Brief 3: the Encoder and the Reranker on the GPU rig, published private to Hugging Face

Written 2026-10-17 by the lead session for an executing window. Budget for this brief: $3.50 of AWS, approved by Brendan on 2026-10-17 as part of a $5 total with Brief 1. Every box is self-terminating with a watchdog; the measured cost from instance run times goes in the final commit message. Nothing heavy runs on the Mac. Do not spawn subagents. Do not push. Commit per part, staging by explicit pathspec only. Run this brief after Brief 1 has committed, so `training-set.jsonl` carries the Google ad rows.

## Model names

One convention, no exceptions: the project name and the kind of model. PAX2 Classifier (the VAR model, the chance of a Hit), PAX2 Encoder, PAX2 Reranker, PAX2 Audio Encoder, PAX2 Vision Encoder (borrowed: CLIP and ResMem), PAX2 Feed Ranker, PAX2 Velocity Classifier, PAX2 Retention Regressor, PAX2 Headline Ranker, PAX2 Platform Simulator, PAX2 Trait Labeler (the language model that labels videos on Swayable's traits), PAX2GPT (a retrieval-grounded language model, rented: Claude on Bedrock behind PAX2's prompts and records; the script writer and the chat). Version delta is a computation, not a model. These names go on every card, page, file comment and commit; no nicknames.

## Read first, in full

- `docs/briefs/RIG-RULES.md`: twenty-nine rules distilled from NSR, CSHL and 44b. Every one applies. The numbered rules are cited below where a part leans on one.
- `/Users/brendanstanton/Code/nsr/docs/NSR-CPT-REPORT.md`: the whole program, its gates, its costs, and its honest caveats. This brief is that program on PAX2's corpus with one change: the benchmark is a prediction task, not a retrieval task.
- `/Users/brendanstanton/Code/nsr/scripts/train-nsr/README.md`, `launch.sh`, `train.sh`, `to-flag.mjs`, `upload-slice.sh`, `candidate-embed.py`: the rig, and the box facts found by hand. Every one of those facts applies: AMI `ami-012ba162b9cd2729c`, `/opt/pytorch/bin/python3`, the `LD_LIBRARY_PATH` of every `nvidia/*/lib`, `transformers>=4.44.2,<5`, batch 16 at query 128 and passage 256, `--warmup_steps` not `--warmup_ratio`, no `--overwrite_output_dir`, the pooling config the checkpoint lacks and `ensure_pooling_config()` writes. Reuse them; do not rediscover them.
- `/Users/brendanstanton/Code/nsr/scripts/rerank-nsr/` and `scripts/embed-nsr/` and `scripts/publish-nsr/launch.sh`: the reranker trainer, the embed box, and the publisher that pulls the HF token from SSM `/nsr/hf/token`.
- `docs/SPEC.md`, `data/generated/model/training-set.manifest.json`, `scripts/training-set.mjs`.

The account already holds the rig: role `nsr-embed`, security group `nsr-embed-sg` (`sg-0dd06bbd6183462a4`), bucket `nsr-embed-v2`, and the on-demand G quota is 64 vCPUs. Use the `pax2-` prefix for every new S3 key under that bucket: `s3://nsr-embed-v2/pax2/...`.

## Part A: the corpus and the pairs, Node on the Mac

A1. `scripts/encoder/corpus.mjs`. From `training-set.jsonl`: one document per row, `text` = title, then description, then the transcript's text when `content` is present, joined by newlines, capped at 1,200 characters. Fields kept: `id`, `channelId`, `family`, `tier`, `breakout`, `group`. Held-out channels, fixed by rule and written into `holdout.json`: within each family, every channel whose id's last hexadecimal-looking character sorts into the top eighth when the family's channel ids are sorted; at least one channel per family; the paid-ad rows are never held out and never positives. Write `corpus.jsonl` and `holdout.json` and upload both to `s3://nsr-embed-v2/pax2/corpus/`.

A2. Pair mining happens on the box (Part B), because it needs stock bge-m3 embeddings of 18k documents and that is not Mac work.

## Part B: one GPU box, three phases, `scripts/encoder/`

B0. A one-minute errand on the same box before Phase 1: pull `s3://pax-2-638175140432/raw/swayable/replication_archive.zip`, `unzip -l` it, write the listing to `s3://pax-2-638175140432/raw/swayable/listing.txt`, and extract and upload to `s3://pax-2-638175140432/raw/swayable/codebook/` every member whose name suggests a codebook, questionnaire, rater or tagging instructions, or an appendix. Report what was found. The labeling page's trait definitions are PAX2's own reading until the archive's wording is in hand.

B1. `launch.sh`, copied from `train-nsr/launch.sh` with these changes: the launcher walks a menu across the default VPC's subnets, `g6.xlarge` (L4, about $0.80 an hour), then `g6e.xlarge` (L40S, about $1.86), then `g5.xlarge`, on `InsufficientInstanceCapacity` (rule 8); it prints the time and dollars for the run on each rung before launching (rule 6) and checks the G quota first (rule 7); `WATCHDOG_MIN=90`; the bucket prefix `pax2/`; the DB url step removed (no database here); `MODE=rehearse` runs Phase 1 on a 400-document slice and stops; `MODE=train` runs all three phases. One rehearsal, then one training run. If the rehearsal fails twice, stop and tell Brendan; do not iterate blind. Every boot that fails is logged with its reason and its minutes.

B2. `box.sh`, the box-side script, three phases, each uploading its outputs and the log before the next starts:

Phase 1, embed and mine. Stock bge-m3 through TEI as `embed-nsr/worker.mjs` does, over `corpus.jsonl`; write `embeddings-stock.npy` and `ids.json`. Mine pairs for training rows (not held out, not paid): for each anchor, positives are its 3 nearest same-channel, same-tier documents by cosine; hard negatives its 5 nearest different-tier documents from any training channel, plus 2 random training documents; FlagEmbedding jsonl `{"query","pos","neg"}`. Zero held-out documents anywhere in the pairs; assert it and write the count. Benchmark the stock model: for every held-out document, the 20 nearest training documents by cosine; score = share breakout; AUC against truth pooled and within each held-out channel; write `bench-stock.json`.

Phase 2, train the encoder. `FlagEmbedding.finetune.embedder.encoder_only.m3`, dense only, the NSR flags, 1 epoch, batch 16, the pairs from Phase 1, `--save_steps` at a quarter of an epoch with checkpoints synced to S3 and resume-from-latest on relaunch (rule 11). If batch 16 does not fit, the run stops and reports instead of halving; the next rung is `g6e.xlarge` (rule 12). The document text recipe is `corpus.mjs`'s alone; the box reads `corpus.jsonl` and never rebuilds text (rule 15). Save, `ensure_pooling_config()`, re-embed the whole corpus with the trained model through TEI with `--pooling cls`, write `embeddings-pax2.npy`, and run the same kNN benchmark: `bench-encoder.json`. Gate E, pre-registered: pooled kNN-AUC on held-out channels at least 0.02 above stock, and the within-channel kNN-AUC not below stock. Write the verdict into the JSON.

Phase 3, train the reranker. `gte-reranker-modernbert-base` as in `rerank-nsr/train.sh`, groups from the Phase 1 pairs, 2 epochs. Benchmark: for every held-out document, take the trained encoder's top 50 training neighbors, rerank, keep 20, recompute the kNN-AUC: `bench-reranker.json`. Gate R: pooled kNN-AUC at least the encoder's, within-channel not below. Upload both model directories to `s3://nsr-embed-v2/pax2/models/<run>/`.

B3. Cost. One rehearsal of about 10 minutes and one training box of at most 90 minutes on g6.xlarge is about $1.40. The $3.50 ceiling allows one retry of the training box. A third box needs Brendan's word.

## Part C: publish, private, under NYSgpt

C0. Before anything is published, the Mac re-scores the box's benchmark from its uploaded neighbor lists with a small Node script, a second implementation of the kNN-AUC (rule 25), and re-runs the held-out assertion against `corpus.jsonl` with its timestamp and row count written into the bench files (rules 21 and 22). The two AUCs must agree to three decimals; if they do not, stop and report.

C1. Cards. `docs/cards/pax2-shorts-training-set.md`, `pax2-encoder-bge-m3.md`, `pax2-reranker-gte-modernbert.md`, `pax2-breakout-benchmark.md`: what it is, how it was built, the measured numbers from the bench files, the gates and whether they passed, and the caveats in the style of the NSR report: observational labels, the channel-relative target, the paid rows, private because the texts are YouTube titles and descriptions.

C2. Publish through `publish-nsr/launch.sh` with `SRC` pointing at the pax2 model directories and `REPO=NYSgpt/pax2-encoder-bge-m3`, then the reranker, then the benchmark (`TYPE=dataset`: `holdout.json`, the three bench files, and the held-out document ids), then the training set (`TYPE=dataset`: `corpus.jsonl` with the manifest as the card). Four t3.small boxes of minutes each. Publish a model only if its gate passed; publish the benchmark and dataset regardless. After each upload, list the repository's files and sizes with the Hugging Face API and compare with the S3 source; an incomplete repository is deleted and re-uploaded, never left (rule 26). The window stays attached until every publisher box has terminated (rule 13).

C3. `data/generated/model/encoder.json` in the repo: the run id, the gate verdicts, the four Hugging Face ids, and the bench numbers, so the recipe cards and `/ml` can read them. Flip `m-encoder` and `m-reranker` on the Memorable template to `exists` with their Hugging Face ids and metrics where the gate passed.

## Commits

Three: A, B with the measured box cost and both gate verdicts in the message, C. When done, tell Brendan in a few lines: both gate results with the numbers, the Hugging Face ids, the total cost from run times, and what was skipped.
