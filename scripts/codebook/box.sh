#!/bin/bash
# Codebook 5K, the GPU box (PyTorch DLAMI) — scripts/vqa/box.sh's pattern. Launched by scripts/codebook/launch.sh;
# user-data's first line is the watchdog. Installs vLLM in a uv venv, runs codebook.py, logs every step with
# EXIT=<code> and uploads this log to s3://$BUCKET/${RUN}box.log every 60 s.
# env: BUCKET RUN MODEL TAG LIMIT, CB_ENV (extra NAME=value pairs for codebook.py)
set -uo pipefail
: "${BUCKET:?}" "${RUN:?}"
LOG=/var/log/pax2-codebook.log
S3=s3://$BUCKET/$RUN
export HF_HOME=/work/hf PYTHONUNBUFFERED=1 AWS_DEFAULT_REGION=us-east-1 VLLM_LOGGING_LEVEL=WARNING VLLM_USE_FLASHINFER_SAMPLER=0 PATH=/opt/q/bin:$PATH
up() { aws s3 cp --only-show-errors "$LOG" "${S3}box.log"; }
step() { echo "===== $* $(date -u +%FT%TZ) +$(( $(date +%s) - BOOT ))s"; up; }
BOOT=$(date +%s -d "$(uptime -s)")
(while sleep 60; do up; done) &

step "boot $(curl -s http://169.254.169.254/latest/meta-data/instance-type) $(curl -s http://169.254.169.254/latest/meta-data/instance-life-cycle) $(nproc) vCPU $(free -g | awk '/Mem/{print $2}') GB"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

export HF_TOKEN=$(aws ssm get-parameter --name /nsr/hf/token --with-decryption --query Parameter.Value --output text 2>/dev/null)
echo "hf token: $([ -n "$HF_TOKEN" ] && echo yes || echo no)"
step "install"
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh >/dev/null
uv venv -q -p 3.12 /opt/q && VIRTUAL_ENV=/opt/q uv pip install -q vllm boto3 ninja
RC=$?; echo "install EXIT=$RC"
VIRTUAL_ENV=/opt/q uv pip freeze | grep -i -E '^(vllm|torch|transformers)=='
[ $RC -eq 0 ] || { echo "EXIT=install"; up; exit 1; }

step "run"
aws s3 cp --only-show-errors ${S3}code/codebook.py /work/codebook.py
aws s3 cp --only-show-errors ${S3}prompts.jsonl /work/prompts.jsonl
aws s3 cp --only-show-errors ${S3}order.txt /work/order.txt
cd /work && env BUCKET=$BUCKET RUN=$RUN MODEL=$MODEL TAG=$TAG LIMIT=$LIMIT ${CB_ENV:-} /opt/q/bin/python codebook.py
RC=$?; echo "codebook.py EXIT=$RC"
step "end"
exit $RC
