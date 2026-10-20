#!/bin/bash
# The resonance encoder, GPU box. Launched by scripts/plum/launch.sh on the PyTorch DLAMI; the user-data's
# first line is the watchdog. scripts/encoder/box.sh's install, Phase 1 and Phase 2 unchanged (same
# FlagEmbedding flags, batch 16, the OOM fallback to gradient checkpointing), with three differences:
#   - the corpus comes from s3://$BUCKET/pax2/plum/corpus/, a pinned copy of the corpus run
#     20261019-094112-train trained on, so the only change against that encoder is the co-occurrence term
#   - Phase 2 trains once per arm in $ARMS (default "behavior full"), each on Phase 1's semantic groups plus
#     that arm's co-occurrence groups (con_pairs.py), re-embeds and benches it as bench-encoder-<arm>.json
#   - no B0 (the Swayable listing exists) and no reranker
# Each arm uploads its weights, embeddings and bench before the next begins.
set -uo pipefail
: "${MODE:?}" "${RUN_ID:?}" "${BUCKET:?}"
ARMS=${ARMS:-behavior full}
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

phase "boot $MODE $RUN_ID $(curl -s http://169.254.169.254/latest/meta-data/instance-type) arms=$ARMS"
nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv

phase "install"
$PY -m pip install -q -U FlagEmbedding "transformers>=4.44.2,<5" "huggingface-hub<1" 2>&1 | tail -5
$PY -m pip freeze | grep -i -E '^(torch|transformers|FlagEmbedding|sentence.transformers|accelerate|numpy|datasets|huggingface.hub)=='
$PY -c 'import FlagEmbedding.finetune.embedder.encoder_only.m3' 2>/dev/null || { echo "FlagEmbedding does not import"; finish 1; }
$PY -m FlagEmbedding.finetune.embedder.encoder_only.m3 --help > "$WORK/flagembed-help.txt" 2>&1
docker pull -q "ghcr.io/huggingface/text-embeddings-inference:$(cd $CODE && $PY -c 'from common import tei_tag; print(tei_tag())')"
aws s3 cp --only-show-errors s3://$BUCKET/pax2/plum/corpus/corpus.jsonl "$WORK/corpus.jsonl"
aws s3 cp --only-show-errors s3://$BUCKET/pax2/plum/corpus/holdout.json "$WORK/holdout.json"
echo "corpus $(wc -l < "$WORK/corpus.jsonl") rows md5 $(md5sum "$WORK/corpus.jsonl" | cut -c1-32)"

phase "phase 1 embed and mine"
cd $CODE && $PY phase1.py; RC=$?
echo "phase1 EXIT=$RC"
put embeddings-stock.npy ids.json pairs-stats.json bench-stock.json neighbors-stock.json
[ $RC -eq 0 ] || finish $RC

export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
EXTRA=()
grep -q -- '--save_total_limit' "$WORK/flagembed-help.txt" && EXTRA+=(--save_total_limit 1)
grep -q -- '--report_to' "$WORK/flagembed-help.txt" && EXTRA+=(--report_to none)
FAILED=0
for ARM in $ARMS; do
  phase "phase 2 $ARM: co-occurrence groups"
  cd $CODE && $PY con_pairs.py "$ARM"; RC=$?
  put "con-$ARM.json"
  [ $RC -eq 0 ] || finish $RC
  OUT=/opt/pax2/encoder-$ARM
  mkdir -p "$OUT"
  N_PAIRS=$(wc -l < "$WORK/pairs-$ARM.jsonl")
  BATCH=16
  STEPS=$(( N_PAIRS / BATCH ))
  WARMUP=$(( STEPS / 10 )); [ $WARMUP -lt 1 ] && WARMUP=1
  SAVE=$(( STEPS + 1 ))
  echo "arm=$ARM pairs=$N_PAIRS batch=$BATCH steps=$STEPS warmup=$WARMUP"
  phase "phase 2 $ARM: train"
  T0=$(date +%s)
  for CKPT_FLAG in "" "--gradient_checkpointing"; do
    echo "attempt: batch=$BATCH ${CKPT_FLAG:-no gradient checkpointing} $(date -u +%FT%TZ)"
    $PY -m FlagEmbedding.finetune.embedder.encoder_only.m3 \
      --model_name_or_path BAAI/bge-m3 --cache_dir /opt/pax2/hf \
      --train_data "$WORK/pairs-$ARM.jsonl" --cache_path /opt/pax2/data-cache-$ARM \
      --train_group_size 8 --query_max_len 128 --passage_max_len 256 --pad_to_multiple_of 8 \
      --knowledge_distillation False --unified_finetuning False --use_self_distill False \
      --output_dir "$OUT" --learning_rate 1e-5 --bf16 --num_train_epochs 1 \
      --per_device_train_batch_size $BATCH --dataloader_drop_last True --warmup_steps $WARMUP \
      --logging_steps 10 --save_steps $SAVE --temperature 0.02 \
      --sentence_pooling_method cls --normalize_embeddings True $CKPT_FLAG "${EXTRA[@]}" \
      > "$WORK/encoder-train-$ARM.log" 2>&1
    RC=$?
    [ $RC -eq 0 ] && break
    grep -q -i -E 'out of memory|OutOfMemoryError' "$WORK/encoder-train-$ARM.log" || break
    echo "OOM at batch $BATCH ${CKPT_FLAG:-without checkpointing} after $(( $(date +%s) - T0 ))s"
  done
  tail -15 "$WORK/encoder-train-$ARM.log"
  echo "encoder $ARM train EXIT=$RC wall=$(( $(date +%s) - T0 ))s pairs=$N_PAIRS"
  put "encoder-train-$ARM.log"
  if [ $RC -ne 0 ]; then FAILED=1; continue; fi
  rm -rf "$OUT"/checkpoint-*
  aws s3 cp --only-show-errors --recursive "$OUT" "$MODELS/encoder-$ARM/"
  echo "encoder $ARM weights uploaded: $MODELS/encoder-$ARM/"
  phase "phase 2 $ARM: re-embed and bench"
  cd $CODE && $PY phase2.py "$OUT"; RC=$?
  echo "phase2 $ARM EXIT=$RC"
  aws s3 cp --only-show-errors --recursive "$OUT" "$MODELS/encoder-$ARM/"
  for f in embeddings-pax2.npy bench-encoder.json neighbors-encoder.json; do
    [ -f "$WORK/$f" ] && mv "$WORK/$f" "$WORK/${f%.*}-$ARM.${f##*.}"
  done
  put "embeddings-pax2-$ARM.npy" "bench-encoder-$ARM.json" "neighbors-encoder-$ARM.json"
  [ $RC -eq 0 ] || FAILED=1
  rm -rf "$OUT"
done
finish $FAILED
