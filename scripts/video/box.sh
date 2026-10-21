#!/bin/bash
# Window MM-A, the GPU box (g6e.xlarge, the PyTorch DLAMI). Launched by scripts/video/launch.sh; user-data's
# first line is the watchdog. Every step logs EXIT=<code> and uploads this log (rule 14).
#   1 install   a Python 3.11 venv (uv) with jax[cuda12] + VideoPrism + PyAV; open_clip into the DLAMI torch
#   2 embed     embed.py (VideoPrism base + large) and clip_embed.py (rung 0) side by side, streaming media
#   3 upload    the three arms to s3://$BUCKET/$RUN the moment they exist (MM-B trains on base)
#   4 M1        gate_m1.py over all three arms
#   5 M2        train_v3.py VIDEO=1 on the best M1 arm with v3b's inputs, then bench_m2.py
# env: BUCKET RUN (model/video-embeddings/<runid>/) SLICE (20 rehearsal, 1 full) V3B (v3b's s3 prefix)
set -uo pipefail
: "${BUCKET:?}" "${RUN:?}" "${SLICE:?}" "${V3B:?}"
LOG=/var/log/pax2-video.log
S3=s3://$BUCKET/$RUN
CODE=/work/code
export OUT=/work/out HF_HOME=/work/hf PYTHONUNBUFFERED=1 AWS_DEFAULT_REGION=us-east-1
mkdir -p $OUT $HF_HOME
up() { aws s3 cp --only-show-errors "$LOG" "${S3}box.log"; }
step() { echo "===== $* $(date -u +%FT%TZ)"; up; }
put() { for f in "$@"; do [ -f "$OUT/$f" ] && aws s3 cp --only-show-errors "$OUT/$f" "$S3$f" && echo "uploaded $f $(stat -c %s "$OUT/$f") bytes"; done; up; }

(while sleep 120; do up; done) &  # progress mid-step
step "boot $(curl -s http://169.254.169.254/latest/meta-data/instance-type) $(nproc) vCPU $(free -g | awk '/Mem/{print $2}') GB slice=$SLICE"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
df -h / | tail -1

step "install"
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
cd /work && git clone -q https://github.com/google-deepmind/videoprism.git && git -C videoprism rev-parse HEAD
uv venv -q -p 3.11 /opt/jx && VIRTUAL_ENV=/opt/jx uv pip install -q "jax[cuda12]" ./videoprism av pillow boto3 numpy
RC=$?; echo "jax venv EXIT=$RC"
VIRTUAL_ENV=/opt/jx uv pip freeze | grep -i -E '^(jax|jaxlib|flax|av|numpy|videoprism)=='
/opt/pytorch/bin/pip install -q open_clip_torch; RC2=$?; echo "open_clip EXIT=$RC2"
/opt/pytorch/bin/pip freeze | grep -i -E '^(torch|open.clip.torch)=='
[ $RC -eq 0 ] && [ $RC2 -eq 0 ] || { echo "EXIT=install"; up; exit 1; }
SP=$(/opt/pytorch/bin/python3 -c 'import site; print(site.getsitepackages()[0])')
TORCH_LD="$(find "$SP/nvidia" -maxdepth 2 -type d -name lib 2>/dev/null | tr '\n' ':')"

step "embed"
aws s3 ls s3://$BUCKET/catalog-media/ | awk '{print $4}' | grep '\.mp4$' > /work/media.txt
echo "media: $(wc -l < /work/media.txt) mp4"
EMBED_ENV=""
if [ "${BLIND:-}" = 1 ]; then  # the label-blind set: its ids only, base and rung 0, no gates
  aws s3 cp --only-show-errors s3://$BUCKET/${RUN}ids.txt /work/ids.txt
  EMBED_ENV="IDS=/work/ids.txt ARMS=base"
fi
mkdir -p /work/clipq
LD_LIBRARY_PATH="$TORCH_LD${LD_LIBRARY_PATH:-}" /opt/pytorch/bin/python3 $CODE/clip_embed.py > /var/log/clip.log 2>&1 &
CLIP=$!
T0=$(date +%s)
env $EMBED_ENV XLA_PYTHON_CLIENT_MEM_FRACTION=0.75 MEDIA_LIST=/work/media.txt /opt/jx/bin/python $CODE/embed.py
RC=$?; echo "embed.py EXIT=$RC wall=$(( $(date +%s) - T0 ))s"
[ $RC -eq 0 ] || touch /work/clipq/DONE
wait $CLIP; echo "clip_embed.py EXIT=$? wall=$(( $(date +%s) - T0 ))s"; tail -3 /var/log/clip.log
[ $RC -eq 0 ] || { tail -40 /var/log/clip.log; echo "EXIT=embed"; up; exit 1; }

step "upload embeddings"
put videoprism-base.jsonl videoprism-large.jsonl clip-frame-mean.jsonl embed-summary.json
wc -l $OUT/*.jsonl
echo "EMBEDDINGS UPLOADED $(date -u +%FT%TZ)"; up
[ "${BLIND:-}" = 1 ] && { echo "EXIT=0 blind set, no gates $(date -u +%FT%TZ)"; up; exit 0; }

step "gate M1"
aws s3 cp --only-show-errors s3://$BUCKET/${RUN}video-pairs.json /work/video-pairs.json
PAIRS=/work/video-pairs.json ARMS="base=$OUT/videoprism-base.jsonl,large=$OUT/videoprism-large.jsonl,rung0=$OUT/clip-frame-mean.jsonl" /opt/jx/bin/python $CODE/gate_m1.py
echo "gate_m1.py EXIT=$?"
put bench-m1.json video-pair-predictions.jsonl

step "gate M2"
BEST=$(/opt/jx/bin/python -c "import json; print(json.load(open('$OUT/bench-m1.json'))['bestArm'])")
case $BEST in base) F=videoprism-base.jsonl ;; large) F=videoprism-large.jsonl ;; *) F=clip-frame-mean.jsonl ;; esac
echo "best M1 arm $BEST ($F)"
aws s3 cp --only-show-errors $OUT/$F ${S3}m2/video.jsonl
for k in training-set.jsonl training-set.manifest.json transcript-features.json embeddings.npy rows.json holdout.json composition.json; do
  aws s3 cp --only-show-errors s3://$BUCKET/$V3B$k ${S3}m2/$k
done
cp $CODE/common.py $CODE/train_v3.py /work/
T0=$(date +%s)
cd /work && BUCKET=$BUCKET RUN=${RUN}m2/ OUT=$OUT VIDEO=1 /opt/jx/bin/python train_v3.py
echo "train_v3.py EXIT=$? wall=$(( $(date +%s) - T0 ))s"
ARM=$BEST /opt/jx/bin/python $CODE/bench_m2.py; echo "bench_m2.py EXIT=$?"
put var-model-v3v.json predictions-v3v.jsonl bench-m2.json
echo "EXIT=0 $(date -u +%FT%TZ)"; up
