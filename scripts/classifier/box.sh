#!/bin/bash
# PAX2 Classifier v2, the CPU box. Launched by scripts/classifier/launch.sh on Ubuntu 22.04; the user-data's
# first line is the watchdog (shutdown -h +45), it installs the AWS CLI, pulls this code, runs this file and
# shuts down. numpy and boto3 only: the regression is common.py's Newton fit, no torch.
#   env: BUCKET RUN (model/v2/<run>/)
# Every step's exit code is logged as EXIT=<code>, and the log is uploaded after each step (rule 14).
set -uo pipefail
: "${BUCKET:?}" "${RUN:?}"
LOG=/var/log/pax2-classifier.log
S3=s3://$BUCKET/$RUN
OUT=/work/out
mkdir -p $OUT
up() { aws s3 cp --only-show-errors "$LOG" "${S3}box.log" --region us-east-1; }
step() { echo "===== $* $(date -u +%FT%TZ)"; up; }

step "boot $(curl -s http://169.254.169.254/latest/meta-data/instance-type) $(nproc) vCPU $(free -g | awk '/Mem/{print $2}') GB"
step "install"
python3 -m venv /opt/c && /opt/c/bin/pip install -q --upgrade pip && /opt/c/bin/pip install -q numpy boto3
RC=$?
/opt/c/bin/pip freeze | grep -i -E '^(numpy|boto3)=='
echo "install EXIT=$RC"
[ $RC -eq 0 ] || { echo "EXIT=$RC"; up; exit $RC; }

step "train_v2"
T0=$(date +%s)
cd /work/code && BUCKET=$BUCKET RUN=$RUN OUT=$OUT PYTHONUNBUFFERED=1 /opt/c/bin/python train_v2.py
RC=$?
echo "train_v2 EXIT=$RC wall=$(( $(date +%s) - T0 ))s"
for f in var-model-v2.json predictions-v2.jsonl; do
  [ -f "$OUT/$f" ] && aws s3 cp --only-show-errors "$OUT/$f" "$S3$f" --region us-east-1 && echo "uploaded $f $(stat -c %s "$OUT/$f") bytes"
done
echo "EXIT=$RC $(date -u +%FT%TZ)"
up
exit $RC
