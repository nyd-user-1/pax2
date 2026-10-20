#!/usr/bin/env bash
# PAX2 Classifier v2: one self-terminating c7i.xlarge running scripts/classifier/box.sh, on the
# scripts/encoder/launch.sh pattern (role nsr-embed with its pax2-rig policy, sg nsr-embed-sg, the default
# VPC's subnets in turn, --instance-initiated-shutdown-behavior terminate). Authorized 2026-10-18: one box,
# ceiling $1. The type is fixed to c7i.xlarge, so the menu walks subnets only.
#
#   RUN=model/v2/<run>/ ./scripts/classifier/launch.sh
#   TRAINER=train_v3.py RUN=model/v3/<run>/ ./scripts/classifier/launch.sh   # v3 also needs embeddings.npy, rows.json, holdout.json under RUN
# The inputs (training-set.jsonl, training-set.manifest.json, transcript-features.json) must already be
# under s3://pax-2-638175140432/<RUN>; scripts/classifier/when-captions-land.sh puts them there.
# Prints "instance: <id>" on success.
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
PROFILE=nsr-embed
TYPE=c7i.xlarge
PRICE=0.1785
WATCHDOG_MIN=45
CEILING=1.00
RUN=${RUN:?set RUN=model/v2/<run>/}
TRAINER=${TRAINER:-train_v2.py}
NAME=pax2-classifier-$(sed -E 's/^train_(v[0-9]+)\.py$/\1/' <<<"$TRAINER")

# Rule 6: time and money, this box and the next rung (not authorized; for the record).
awk -v wd=$WATCHDOG_MIN -v p=$PRICE -v c=$CEILING 'BEGIN {
  printf "plan: install 4 min + train_v2 about 8 min (4 variants x 64 leave-one-channel-out fits, 18,455 rows, up to 441 features)\n"
  printf "  c7i.xlarge  $%.4f/h: about 15 min, $%.2f; watchdog %d min caps it at $%.2f\n", p, 15 / 60 * p, wd, wd / 60 * p
  printf "  c7i.2xlarge $0.3570/h: about 10 min, $0.06 (not authorized)\n"
  if (wd / 60 * p > c) { print "watchdog cost over the $" c " ceiling"; exit 1 }
}'

# One box only: refuse when a v2 box is already pending or running.
LIVE=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running --query 'Reservations[].Instances[].InstanceId' --output text)
[ -z "$LIVE" ] || { echo "a PAX2 Classifier v2 box is already up: $LIVE"; exit 1; }

INPUTS="training-set.jsonl training-set.manifest.json transcript-features.json"
[ "$TRAINER" = train_v3.py ] && INPUTS="$INPUTS embeddings.npy rows.json holdout.json"; [ "${COMPOSITION:-}" = 1 ] && INPUTS="$INPUTS composition.json"
for k in $INPUTS; do
  aws s3api head-object --region $REGION --bucket $BUCKET --key "$RUN$k" >/dev/null || { echo "missing s3://$BUCKET/$RUN$k"; exit 1; }
done
STAGE=$(mktemp -d)
cp scripts/classifier/box.sh scripts/classifier/$TRAINER scripts/rig/common.py "$STAGE/"
aws s3 cp --only-show-errors --recursive "$STAGE/" "s3://$BUCKET/${RUN}code/" --region $REGION
rm -rf "$STAGE"
echo "code: s3://$BUCKET/${RUN}code/"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)
echo "vpc $VPC sg $SG ami $AMI subnets ${SUBNETS[*]}"

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-classifier.log 2>&1
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
echo "user-data \$(date -u +%FT%TZ)"
apt-get update -q && apt-get install -y -q python3-venv awscli >/dev/null
echo "apt EXIT=\$?"
mkdir -p /work/code && aws s3 cp --only-show-errors --recursive s3://$BUCKET/${RUN}code/ /work/code/
BUCKET=$BUCKET RUN=$RUN TRAINER=$TRAINER COMPOSITION=${COMPOSITION:-} INDEX_RUN=${INDEX_RUN:-} bash /work/code/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-classifier.log s3://$BUCKET/${RUN}box.log
shutdown -h now
EOS
)

for SUBNET in "${SUBNETS[@]}"; do
  if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --count 1 \
    --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
    --instance-initiated-shutdown-behavior terminate \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Run,Value=$RUN}]" \
    --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
    echo "launched $TYPE in $SUBNET"
    echo "instance: $OUT"
    echo "log: s3://$BUCKET/${RUN}box.log"
    exit 0
  fi
  if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then
    echo "no $TYPE in $SUBNET: $(grep -o -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" | head -1)"
    continue
  fi
  echo "run-instances failed: $OUT"; exit 1
done
echo "no $TYPE capacity in any subnet"; exit 1
