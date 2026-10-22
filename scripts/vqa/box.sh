#!/bin/bash
# Window Q, the GPU box (PyTorch DLAMI). Launched by scripts/vqa/launch.sh; user-data's first line is the
# watchdog. Installs vLLM in a uv venv, runs vqa.py (MODE=batch or ask), logs every step with EXIT=<code>
# and uploads this log to s3://$BUCKET/${RUN}box.log, every 60 s while running.
# env: BUCKET RUN MODE MODEL TAG LIMIT, VQA_ENV (extra NAME=value pairs for vqa.py, e.g. the 8B's memory settings)
set -uo pipefail
: "${BUCKET:?}" "${RUN:?}" "${MODE:?}"
LOG=/var/log/pax2-vqa.log
S3=s3://$BUCKET/$RUN
# The FlashInfer sampler JIT-compiles on first use and needs nvcc + ninja; the first verification box died there.
export HF_HOME=/work/hf PYTHONUNBUFFERED=1 AWS_DEFAULT_REGION=us-east-1 VLLM_LOGGING_LEVEL=WARNING VLLM_USE_FLASHINFER_SAMPLER=0 PATH=/opt/q/bin:$PATH
up() { aws s3 cp --only-show-errors "$LOG" "${S3}box.log"; }
step() { echo "===== $* $(date -u +%FT%TZ) +$(( $(date +%s) - BOOT ))s"; up; }
BOOT=$(date +%s -d "$(uptime -s)")
(while sleep 60; do up; done) &

step "boot $(curl -s http://169.254.169.254/latest/meta-data/instance-type) $(curl -s http://169.254.169.254/latest/meta-data/instance-life-cycle) $(nproc) vCPU $(free -g | awk '/Mem/{print $2}') GB mode=$MODE"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

export HF_TOKEN=$(aws ssm get-parameter --name /nsr/hf/token --with-decryption --query Parameter.Value --output text 2>/dev/null)
echo "hf token: $([ -n "$HF_TOKEN" ] && echo yes || echo no)"
step "install"
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh >/dev/null
uv venv -q -p 3.12 /opt/q && VIRTUAL_ENV=/opt/q uv pip install -q vllm av pillow boto3 ninja
RC=$?; echo "install EXIT=$RC"
VIRTUAL_ENV=/opt/q uv pip freeze | grep -i -E '^(vllm|torch|transformers|av)=='
[ $RC -eq 0 ] || { echo "EXIT=install"; up; exit 1; }

step "run $MODE"
aws s3 cp --only-show-errors ${S3}code/vqa.py /work/vqa.py
[ "$MODE" = batch ] && aws s3 cp --only-show-errors ${S3}ids.tsv /work/ids.tsv
cd /work && env BUCKET=$BUCKET RUN=$RUN MODE=$MODE MODEL=$MODEL TAG=$TAG LIMIT=$LIMIT ${VQA_ENV:-} /opt/q/bin/python vqa.py
RC=$?; echo "vqa.py EXIT=$RC"
step "end"
exit $RC
