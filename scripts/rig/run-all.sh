#!/bin/bash
# The PAX2 rig's job list, run on the box by launch-cpu.sh's user-data. Each job runs even when an
# earlier one failed (set +e), logs its real exit code as EXIT=<code> as the last line of its
# section, and uploads its outputs and the log the moment it ends (rule 14). A job whose outputs are
# already in S3 is skipped, so a relaunch resumes (rule 11).
#   env: BUCKET RIG_PREFIX RIG_MODE RIG_LIMIT LOG_KEY PY
set +e
cd "$(dirname "$0")"
LOG=/var/log/rig.log
up_log() { aws s3 cp --only-show-errors "$LOG" "s3://$BUCKET/$LOG_KEY" --region us-east-1; }
have() { for k in "$@"; do aws s3api head-object --bucket "$BUCKET" --key "$RIG_PREFIX$k" --region us-east-1 >/dev/null 2>&1 || return 1; done; }

run() {
  local job=$1 script=$2; shift 2
  echo "===== $job ($script) $(date -u +%FT%TZ)"
  if have "$@"; then
    echo "skip: $* already in s3://$BUCKET/$RIG_PREFIX"
    echo "EXIT=skipped"
  else
    local t0=$(date +%s)
    $PY "$script"
    local rc=$?
    mkdir -p "/work/out/$job"
    aws s3 cp --only-show-errors --recursive "/work/out/$job/" "s3://$BUCKET/$RIG_PREFIX" --region us-east-1
    echo "uploaded: $(ls /work/out/$job | tr '\n' ' ') in $(( $(date +%s) - t0 ))s"
    echo "EXIT=$rc"
  fi
  up_log
}

echo "rig: mode=$RIG_MODE prefix=$RIG_PREFIX limit=$RIG_LIMIT $(nproc) vCPU $(free -g | awk '/Mem/{print $2}') GB"
# The thumbnails live only on this box's disk, so they are fetched whenever the encoder still has work.
run thumbs thumbs.py thumb-failures.json thumb-features.json
run encode encode_images.py thumb-embeddings.npy ids.json thumb-pca.json thumb-features.json
run train_var train_var.py var-model.json
run velocity velocity.py velocity-model.json
run platform_sim platform_sim.py platform-sim.json
run headline headline_v0.py headline-model.json
run retention retention_v0.py retention-v0.json
echo "ALL JOBS ENDED $(date -u +%FT%TZ)"
grep -E "^(=====|EXIT=)" "$LOG" | paste - - 
up_log
