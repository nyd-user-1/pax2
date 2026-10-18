#!/bin/bash
# PAX2 Encoder and PAX2 Reranker, the GPU box. Launched by scripts/encoder/launch.sh on the PyTorch DLAMI
# (ami-012ba162b9cd2729c); the user-data's first line is the watchdog. Box facts from
# nsr/scripts/train-nsr/README.md: /opt/pytorch/bin/python3, LD_LIBRARY_PATH over every nvidia/*/lib,
# FlagEmbedding with transformers>=4.44.2,<5, batch 16 at query 128 and passage 256, --warmup_steps,
# no --overwrite_output_dir, and the pooling config the checkpoint lacks.
#
#   B0       the Swayable archive's listing and codebook members (once; skipped when the listing exists)
#   Phase 1  stock bge-m3 through TEI, pairs, bench-stock.json
#   Phase 2  PAX2 Encoder: FlagEmbedding m3 dense-only, 1 epoch, batch 16 or stop, checkpoints to S3 at
#            each quarter epoch and resume from the latest; re-embed, bench-encoder.json, Gate E
#   Phase 3  PAX2 Reranker: 44b train.py unchanged on gte-reranker-modernbert-base, 2 epochs; rerank the
#            encoder's top 50, bench-reranker.json, Gate R
# Each phase uploads its outputs and this log before the next starts (rule 14). MODE=rehearse runs all three
# on a 400-document slice of the longest texts, so the batch-16 memory test is the worst case.
set -uo pipefail
: "${MODE:?}" "${RUN_ID:?}" "${BUCKET:?}"
LOG=/var/log/pax2-encoder.log
S3=s3://$BUCKET/pax2/runs/$RUN_ID
MODELS=s3://$BUCKET/pax2/models/$RUN_ID
CODE=/opt/pax2/code
export WORK=/opt/pax2/work
mkdir -p "$WORK" /opt/pax2/hf
PY=/opt/pytorch/bin/python3
SP=$($PY -c 'import site; print(site.getsitepackages()[0])')
export LD_LIBRARY_PATH="$(find "$SP/nvidia" -maxdepth 2 -type d -name lib | tr '\n' ':')${LD_LIBRARY_PATH:-}"
export HF_HOME=/opt/pax2/hf PYTHONUNBUFFERED=1
[ "$MODE" = rehearse ] && export REHEARSE=400
up() { aws s3 cp --only-show-errors "$LOG" "$S3/box.log"; }
put() { for f in "$@"; do [ -f "$WORK/$f" ] && aws s3 cp --only-show-errors "$WORK/$f" "$S3/$f"; done; }
phase() { echo "===== $* $(date -u +%FT%TZ)"; up; }
finish() { echo "EXIT=$1 $(date -u +%FT%TZ)"; up; exit "$1"; }

phase "boot $MODE $RUN_ID $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv

# ── B0 ────────────────────────────────────────────────────────────────────────
SW=s3://pax-2-638175140432/raw/swayable
if ! aws s3 ls "$SW/listing.txt" >/dev/null 2>&1; then
  phase "B0 swayable archive"
  mkdir -p /opt/pax2/swayable && cd /opt/pax2/swayable
  aws s3 cp --only-show-errors "$SW/replication_archive.zip" a.zip
  unzip -l a.zip > listing.txt; echo "B0 rc=$?"
  aws s3 cp --only-show-errors listing.txt "$SW/listing.txt"
  awk 'NR>3 && $4 != "" {sub(/^ *[0-9]+ +[0-9-]+ +[0-9:]+ +/, ""); print}' listing.txt \
    | grep -i -E 'code.?book|questionnaire|rater|tagg|instruction|appendix|annotat' \
    | grep -v '/$' > members.txt || true
  echo "B0 $(grep -c . listing.txt) listing lines, $(grep -c . members.txt) codebook-like members:"; cat members.txt
  while IFS= read -r m; do
    unzip -o -q a.zip "$m" -d out && aws s3 cp --only-show-errors "out/$m" "$SW/codebook/$m"
  done < members.txt
  echo "B0 uploaded $(find out -type f 2>/dev/null | wc -l) files to $SW/codebook/"
  cd /opt/pax2; rm -rf /opt/pax2/swayable
else
  echo "B0 skipped: $SW/listing.txt exists"
fi

# ── install ───────────────────────────────────────────────────────────────────
phase "install"
# One resolve, so the transformers<5 pin and the hub it needs choose a datasets that works with both
# (two separate installs left datasets 5.1 beside huggingface-hub 0.36 on 2026-10-18 and nothing imported).
$PY -m pip install -q -U FlagEmbedding "transformers>=4.44.2,<5" "huggingface-hub<1" 2>&1 | tail -5
$PY -m pip freeze | grep -i -E '^(torch|transformers|FlagEmbedding|sentence.transformers|accelerate|numpy|datasets|huggingface.hub)=='
$PY -c 'import FlagEmbedding.finetune.embedder.encoder_only.m3, datasets, transformers; print("import ok")' 2>&1 | tail -3
$PY -c 'import FlagEmbedding.finetune.embedder.encoder_only.m3' 2>/dev/null || { echo "FlagEmbedding does not import"; finish 1; }
$PY -m FlagEmbedding.finetune.embedder.encoder_only.m3 --help > "$WORK/flagembed-help.txt" 2>&1
echo "help: $(wc -l < "$WORK/flagembed-help.txt") lines"; put flagembed-help.txt
for f in save_total_limit report_to resume_from_checkpoint warmup_steps save_steps; do
  grep -q -- "--$f" "$WORK/flagembed-help.txt" && echo "flag ok: --$f" || echo "flag MISSING: --$f"
done
docker pull -q "ghcr.io/huggingface/text-embeddings-inference:$(cd $CODE && $PY -c 'from common import tei_tag; print(tei_tag())')"
aws s3 cp --only-show-errors s3://$BUCKET/pax2/corpus/corpus.jsonl "$WORK/corpus.jsonl"
aws s3 cp --only-show-errors s3://$BUCKET/pax2/corpus/holdout.json "$WORK/holdout.json"
echo "corpus $(wc -l < "$WORK/corpus.jsonl") rows"

# ── Phase 1 ───────────────────────────────────────────────────────────────────
phase "phase 1 embed and mine"
cd $CODE && $PY phase1.py; RC=$?
echo "phase1 EXIT=$RC"
put embeddings-stock.npy ids.json pairs.jsonl pairs-ids.jsonl train-groups.jsonl pairs-stats.json bench-stock.json neighbors-stock.json
[ $RC -eq 0 ] || finish $RC

# ── Phase 2 ───────────────────────────────────────────────────────────────────
phase "phase 2 train PAX2 Encoder"
OUT=/opt/pax2/encoder
N_PAIRS=$(wc -l < "$WORK/pairs.jsonl")
BATCH=16
STEPS=$(( N_PAIRS / BATCH ))
WARMUP=$(( STEPS / 10 )); [ $WARMUP -lt 1 ] && WARMUP=1
SAVE=$(( STEPS / 4 )); [ $SAVE -lt 1 ] && SAVE=1
[ "$MODE" = rehearse ] && SAVE=$(( STEPS / 2 ))
EXTRA=()
grep -q -- '--save_total_limit' "$WORK/flagembed-help.txt" && EXTRA+=(--save_total_limit 1)
grep -q -- '--report_to' "$WORK/flagembed-help.txt" && EXTRA+=(--report_to none)
# Resume from the latest checkpoint this run synced to S3 (rule 11).
mkdir -p "$OUT"
aws s3 sync --only-show-errors "$S3/encoder-ckpt/" "$OUT/"
LATEST=$(ls -d "$OUT"/checkpoint-* 2>/dev/null | sort -t- -k2 -n | tail -1)
[ -n "$LATEST" ] && { echo "resuming from $LATEST"; EXTRA+=(--resume_from_checkpoint "$LATEST"); }
echo "pairs=$N_PAIRS batch=$BATCH steps=$STEPS warmup=$WARMUP save_steps=$SAVE extra=${EXTRA[*]}"
( while sleep 60; do
    for c in "$OUT"/checkpoint-*; do
      [ -f "$c/trainer_state.json" ] && aws s3 sync --only-show-errors --delete "$c/" "$S3/encoder-ckpt/$(basename "$c")/"
    done
  done ) & SYNC=$!
# Batch 16 is fixed (rule 12). PAX2's queries are whole titles and descriptions that fill the 128-token
# limit, where NSR's were short keyword lists, and batch 16 ran out of memory on the L4 and the L40S on
# 2026-10-18. So: first expandable_segments alone (3.66 GB sat reserved and unallocated), then gradient
# checkpointing, which recomputes activations in the backward pass; same gradients, slower steps.
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
T0=$(date +%s)
for CKPT_FLAG in "" "--gradient_checkpointing"; do
  echo "attempt: batch=$BATCH ${CKPT_FLAG:-no gradient checkpointing} $(date -u +%FT%TZ)"
  $PY -m FlagEmbedding.finetune.embedder.encoder_only.m3 \
    --model_name_or_path BAAI/bge-m3 --cache_dir /opt/pax2/hf \
    --train_data "$WORK/pairs.jsonl" --cache_path /opt/pax2/data-cache \
    --train_group_size 8 --query_max_len 128 --passage_max_len 256 --pad_to_multiple_of 8 \
    --knowledge_distillation False --unified_finetuning False --use_self_distill False \
    --output_dir "$OUT" --learning_rate 1e-5 --bf16 --num_train_epochs 1 \
    --per_device_train_batch_size $BATCH --dataloader_drop_last True --warmup_steps $WARMUP \
    --logging_steps 10 --save_steps $SAVE --temperature 0.02 \
    --sentence_pooling_method cls --normalize_embeddings True $CKPT_FLAG "${EXTRA[@]}" \
    > "$WORK/encoder-train.log" 2>&1
  RC=$?
  [ $RC -eq 0 ] && break
  grep -q -i -E 'out of memory|OutOfMemoryError' "$WORK/encoder-train.log" || break
  echo "OOM at batch $BATCH ${CKPT_FLAG:-without checkpointing} after $(( $(date +%s) - T0 ))s"
  cp "$WORK/encoder-train.log" "$WORK/encoder-train-oom${CKPT_FLAG:+-ckpt}.log"; put "encoder-train-oom${CKPT_FLAG:+-ckpt}.log"
done
echo "encoder trained with: batch=$BATCH ${CKPT_FLAG:-no gradient checkpointing}"
kill $SYNC 2>/dev/null
TRAIN_S=$(( $(date +%s) - T0 ))
tail -40 "$WORK/encoder-train.log"
grep -o "'train_samples_per_second': [0-9.]*" "$WORK/encoder-train.log" | tail -1
echo "encoder train EXIT=$RC wall=${TRAIN_S}s pairs=$N_PAIRS batch=$BATCH"
put encoder-train.log
ENC_OK=0
if [ $RC -ne 0 ]; then
  if grep -q -i -E 'out of memory|OutOfMemoryError' "$WORK/encoder-train.log"; then
    echo "ENCODER OOM at batch $BATCH on $(nvidia-smi --query-gpu=name --format=csv,noheader): stopping, not halving (rule 12)"
  fi
  [ "$MODE" = rehearse ] || finish $RC
else
  # Weights first: the run's durable artifact (nsr rerank-nsr lost a run to upload order).
  aws s3 cp --only-show-errors --recursive "$OUT" "$MODELS/encoder/" --exclude "checkpoint-*"
  echo "encoder weights uploaded: $MODELS/encoder/"
  phase "phase 2 re-embed and bench"
  cd $CODE && $PY phase2.py "$OUT"; RC=$?
  echo "phase2 EXIT=$RC"
  aws s3 cp --only-show-errors --recursive "$OUT" "$MODELS/encoder/" --exclude "checkpoint-*"
  put embeddings-pax2.npy bench-encoder.json neighbors-encoder.json
  [ $RC -eq 0 ] && ENC_OK=1
  [ $RC -eq 0 ] || [ "$MODE" = rehearse ] || finish $RC
  aws s3 rm --only-show-errors --recursive "$S3/encoder-ckpt/"
fi

# ── Phase 3 ───────────────────────────────────────────────────────────────────
phase "phase 3 train PAX2 Reranker"
[ $ENC_OK -eq 1 ] && rm -rf "$OUT"/checkpoint-*
RR=/opt/pax2/reranker
mkdir -p "$RR/run"
cp "$WORK/train-groups.jsonl" "$RR/run/train-groups.jsonl"
EPOCHS=2; MAXH=0.75
[ "$MODE" = rehearse ] && { EPOCHS=1; MAXH=0.2; }
T0=$(date +%s)
$PY $CODE/train.py --dir "$RR/run" --base Alibaba-NLP/gte-reranker-modernbert-base \
  --epochs $EPOCHS --bulk 0 --max-hours $MAXH > "$WORK/reranker-train.log" 2>&1
RC=$?
tail -20 "$WORK/reranker-train.log"
echo "reranker train EXIT=$RC wall=$(( $(date +%s) - T0 ))s groups=$(wc -l < "$WORK/train-groups.jsonl") epochs=$EPOCHS"
put reranker-train.log
[ $RC -eq 0 ] || finish $RC
aws s3 cp --only-show-errors --recursive "$RR/run/model/final" "$MODELS/reranker/"
echo "reranker weights uploaded: $MODELS/reranker/"
phase "phase 3 rerank and bench"
cd $CODE && $PY phase3.py "$RR/run/model/final"; RC=$?
echo "phase3 EXIT=$RC"
put bench-reranker.json neighbors-reranker.json
finish $RC
