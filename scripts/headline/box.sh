#!/bin/bash
# PAX2 Headline Ranker v1, the GPU box. Launched by scripts/headline/launch.sh on the PyTorch DLAMI
# (ami-012ba162b9cd2729c); the user-data's first line is the watchdog. Box facts from
# nsr/scripts/train-nsr/README.md: /opt/pytorch/bin/python3, LD_LIBRARY_PATH over every nvidia/*/lib,
# transformers>=4.44.2,<5. One job: scripts/headline/train.py on the staged Upworthy parquet. Every
# output and this log go to s3://$BUCKET/pax2/headline/runs/$RUN_ID/ before the box turns off (rule 14).
set -uo pipefail
: "${MODE:?}" "${RUN_ID:?}" "${BUCKET:?}"
LOG=/var/log/pax2-headline.log
S3=s3://$BUCKET/pax2/headline/runs/$RUN_ID
MODELS=s3://$BUCKET/pax2/headline/models/$RUN_ID
CODE=/opt/pax2/code
export WORK=/opt/pax2/work
mkdir -p "$WORK" /opt/pax2/hf
PY=/opt/pytorch/bin/python3
SP=$($PY -c 'import site; print(site.getsitepackages()[0])')
export LD_LIBRARY_PATH="$(find "$SP/nvidia" -maxdepth 2 -type d -name lib | tr '\n' ':')${LD_LIBRARY_PATH:-}"
export HF_HOME=/opt/pax2/hf PYTHONUNBUFFERED=1
[ "$MODE" = rehearse ] && export REHEARSE=${REHEARSE:-60}
up() { aws s3 cp --only-show-errors "$LOG" "$S3/box.log"; }
put() { for f in "$@"; do [ -f "$WORK/$f" ] && aws s3 cp --only-show-errors "$WORK/$f" "$S3/$f"; done; }
phase() { echo "===== $* $(date -u +%FT%TZ)"; up; }
finish() { echo "EXIT=$1 $(date -u +%FT%TZ)"; up; exit "$1"; }

phase "boot $MODE $RUN_ID $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv

phase "install"
$PY -m pip install -q -U "transformers>=4.44.2,<5" "huggingface-hub<1" pandas pyarrow onnx 2>&1 | tail -3
$PY -m pip freeze | grep -i -E '^(torch|transformers|numpy|pandas|pyarrow|onnx|huggingface.hub)=='
$PY -c 'import transformers, pandas, pyarrow; print("import ok")' 2>&1 | tail -1 || finish 1
aws s3 cp --only-show-errors s3://$BUCKET/pax2/headline/upworthy.parquet "$WORK/upworthy.parquet" || finish 1
echo "parquet $(stat -c %s "$WORK/upworthy.parquet") bytes"

phase "train"
cd $CODE && $PY train.py; RC=$?
echo "train EXIT=$RC"
put headline-v1.json held-pairs-v1.jsonl checks-v1.json
if [ -d "$WORK/model-v1" ]; then
  aws s3 cp --only-show-errors --recursive "$WORK/model-v1/" "$MODELS/model-v1/"
  [ -f "$WORK/model-v1.onnx" ] && aws s3 cp --only-show-errors "$WORK/model-v1.onnx" "$MODELS/model-v1.onnx"
  echo "models: $(aws s3 ls --recursive "$MODELS/" | wc -l) files under $MODELS/"
fi
[ "$RC" = 0 ] || finish "$RC"
phase "done"
cat "$WORK/headline-v1.json" | head -40
finish 0
