#!/usr/bin/env bash
# Composition extraction box (window C, 2026-10-20): one self-terminating CPU box runs extract.py over
# every catalog-media short without a composition/raw/<id>.json yet, pairs strongest-first (order.txt,
# from scripts/composition/order.mjs), and shuts down. Ubuntu 24.04 for apt's ffmpeg and tesseract;
# role nsr-embed (its pax2-rig policy covers the pax-2-* buckets); watchdog first line (rule 3).
#
#   LIMIT=20 ./scripts/composition/launch.sh                       # plan only
#   APPLY=1 LIMIT=20 TYPES="c7i.xlarge" ./scripts/composition/launch.sh   # the rehearsal
#   APPLY=1 TYPES="c7i.8xlarge c6i.8xlarge" WATCHDOG_MIN=150 ./scripts/composition/launch.sh
# Then: node scripts/composition/merge.mjs
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed
BUCKET=pax-2-638175140432
RUN=composition-$(date -u +%Y%m%d-%H%M%S)
LIMIT=${LIMIT:-0}
FPS=${FPS:-1}
WATCHDOG_MIN=${WATCHDOG_MIN:-40}
TYPES=${TYPES:-c7i.xlarge}
HERE=$(cd "$(dirname "$0")" && pwd)
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)

echo "run $RUN, types $TYPES, limit $LIMIT, fps $FPS, watchdog $WATCHDOG_MIN min, ami $AMI"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

aws s3 cp --only-show-errors --region $REGION "$HERE/extract.py" "s3://$BUCKET/code/composition/$RUN/extract.py"
aws s3 cp --only-show-errors --region $REGION "$HERE/../../data/raw/composition/order.txt" "s3://$BUCKET/code/composition/$RUN/order.txt"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
LOG=s3://$BUCKET/logs/pax2-$RUN.log

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec > /var/log/pax2-composition.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive FPS=$FPS
apt-get update -q && apt-get install -y -q ffmpeg tesseract-ocr python3-pil unzip >/dev/null
curl -sS https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install
ffmpeg -version | head -1; tesseract --version | head -1
mkdir -p /opt/work && cd /opt/work
aws s3 cp --only-show-errors s3://$BUCKET/code/composition/$RUN/extract.py .
aws s3 cp --only-show-errors s3://$BUCKET/code/composition/$RUN/order.txt .
aws s3 ls s3://$BUCKET/catalog-media/ | awk '{print \$4}' | grep '\.mp4\$' > media.txt
aws s3 ls s3://$BUCKET/composition/raw/ 2>/dev/null | awk '{print \$4}' > done.txt || true
python3 extract.py $BUCKET $LIMIT $LOG
echo "EXIT=\$?"
aws s3 cp --only-show-errors /var/log/pax2-composition.log $LOG
shutdown -h now
EOS
)

for TYPE in $TYPES; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET run=$RUN"
      echo "log: $LOG"
      exit 0
    fi
    grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" && { echo "no $TYPE in $SUBNET"; continue; }
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity on the menu"; exit 1
