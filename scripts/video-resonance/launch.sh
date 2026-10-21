#!/usr/bin/env bash
# PAX2 Video Resonance head training (window MM-B): one self-terminating CPU box (c7i.xlarge, Ubuntu
# 24.04, CPU PyTorch) runs train.py over the declared variants and uploads everything under
# s3://pax-2-638175140432/model/video-resonance/<run>/. The scripts/composition/launch.sh pattern: role
# nsr-embed (its pax2-rig policy covers pax-2-*), sg nsr-embed-sg, watchdog shutdown as user-data's first line.
#
#   STANDIN=768 SLICE=20 NAMES=v1 APPLY=1 ./scripts/video-resonance/launch.sh            # plumbing rehearsal
#   STOCK=model/video-embeddings/<run>/base.jsonl RUNG0=.../clip.jsonl NAMES=v1 APPLY=1 ./scripts/video-resonance/launch.sh
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed
BUCKET=pax-2-638175140432
RUN=${RUN:-vres-$(date -u +%Y%m%d-%H%M%S)}
NAMES=${NAMES:?set NAMES to declared variants, comma-separated}
SLICE=${SLICE:-0}; STANDIN=${STANDIN:-0}
STOCK=${STOCK:-}; RUNG0=${RUNG0:-}
WATCHDOG_MIN=${WATCHDOG_MIN:-45}
TYPES=${TYPES:-c7i.xlarge c6i.xlarge}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOTDIR=$(cd "$HERE/../.." && pwd)
[ "$STANDIN" != 0 ] || [ -n "$STOCK" ] || { echo "set STOCK (S3 key) or STANDIN"; exit 1; }
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
echo "run $RUN types $TYPES names $NAMES slice $SLICE standin $STANDIN stock ${STOCK:-none} rung0 ${RUNG0:-none} watchdog $WATCHDOG_MIN min (c7i.xlarge \$0.1785/h: cap \$$(awk -v m=$WATCHDOG_MIN 'BEGIN{printf "%.2f", m/60*0.1785}'))"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

CODE=s3://$BUCKET/code/video-resonance/$RUN
aws s3 cp --only-show-errors --region $REGION "$HERE/train.py" "$CODE/train.py"
aws s3 cp --only-show-errors --region $REGION "$HERE/variants.json" "$CODE/variants.json"
aws s3 cp --only-show-errors --region $REGION "$ROOTDIR/data/generated/model/video-resonance/groups.json" "$CODE/groups.json"
OUT=s3://$BUCKET/model/video-resonance/$RUN
LOG=$OUT/box.log

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

ARGS="--groups groups.json --variants variants.json --names $NAMES --out out"
[ "$SLICE" != 0 ] && ARGS="$ARGS --slice $SLICE"
[ "$STANDIN" != 0 ] && ARGS="$ARGS --standin $STANDIN"
FETCH=""
[ -n "$STOCK" ] && { FETCH="aws s3 cp --only-show-errors s3://$BUCKET/$STOCK stock.jsonl"; ARGS="$ARGS --stock stock.jsonl"; }
[ -n "$RUNG0" ] && { FETCH="$FETCH; aws s3 cp --only-show-errors s3://$BUCKET/$RUNG0 rung0.jsonl"; ARGS="$ARGS --rung0 rung0.jsonl"; }

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec > /var/log/pax2-vres.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
up() { aws s3 cp --only-show-errors /var/log/pax2-vres.log $LOG; }
apt-get update -q && apt-get install -y -q python3-venv unzip >/dev/null
curl -sS https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install
python3 -m venv /opt/venv && /opt/venv/bin/pip install -q torch --index-url https://download.pytorch.org/whl/cpu && /opt/venv/bin/pip install -q numpy
/opt/venv/bin/python -c 'import torch, numpy; print("torch", torch.__version__, "numpy", numpy.__version__)'
mkdir -p /opt/work && cd /opt/work
aws s3 cp --only-show-errors --recursive $CODE/ .
$FETCH
up
/opt/venv/bin/python train.py $ARGS
echo "EXIT=\$?"
aws s3 cp --only-show-errors --recursive out/ $OUT/
up
shutdown -h now
EOS
)

for TYPE in $TYPES; do
  for SUBNET in "${SUBNETS[@]}"; do
    if ID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $ID $TYPE $SUBNET run=$RUN"
      echo "out: $OUT"
      exit 0
    fi
    grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$ID" && { echo "no $TYPE in $SUBNET"; continue; }
    echo "run-instances failed: $ID"; exit 1
  done
done
echo "no capacity on the menu"; exit 1
