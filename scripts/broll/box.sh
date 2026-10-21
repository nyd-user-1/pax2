#!/bin/bash
# The b-roll box (PyTorch DLAMI, launched by scripts/broll/launch.sh; user-data's first line is the
# watchdog). One job: Wan 2.2 TI2V-5B through diffusers over the eight shots in gen.py, each clip
# uploaded the moment it exists. Logs EXIT=<code> per step and uploads this log throughout.
set -uo pipefail
: "${BUCKET:?}" "${RUN:?}"
LOG=/var/log/pax2-broll.log
S3=s3://$BUCKET/$RUN
export HF_HOME=/work/hf PYTHONUNBUFFERED=1 AWS_DEFAULT_REGION=us-east-1 SHARD=${SHARD:-0} SHARDS=${SHARDS:-1}
mkdir -p /work/out $HF_HOME
up() { aws s3 cp --only-show-errors "$LOG" "${S3}box-$SHARD.log"; }
step() { echo "===== $* $(date -u +%FT%TZ)"; up; }
(while sleep 120; do up; done) &

step "boot $(curl -s http://169.254.169.254/latest/meta-data/instance-type) $(free -g | awk '/Mem/{print $2}') GB"
nvidia-smi --query-gpu=name,memory.total --format=csv || true

step install
# The DLAMI's activate script reads variables set -u calls unbound; relax around the source.
set +u
if [ -f /opt/pytorch/bin/activate ]; then source /opt/pytorch/bin/activate; else source activate pytorch; fi
set -u
pip install -q -U diffusers transformers accelerate ftfy imageio imageio-ffmpeg sentencepiece
echo "EXIT=$?"

step generate
python3 /work/code/gen.py
echo "EXIT=$?"
up
