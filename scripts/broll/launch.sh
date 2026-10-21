#!/usr/bin/env bash
# One self-terminating GPU box (g6e.xlarge L40S first; g6.2xlarge L4 or g5.2xlarge A10G on capacity
# errors) on the PyTorch DLAMI running scripts/broll/box.sh — Wan 2.2 TI2V-5B over gen.py's eight
# shots, clips landing flat in studio/clip/ as wan-<slug>.mp4. The scripts/video/launch.sh pattern:
# role nsr-embed, sg nsr-embed-sg, the default VPC's subnets in turn, terminate on shutdown,
# watchdog first line, 300 GB gp3.
#
#   ./scripts/broll/launch.sh                       # plan only
#   APPLY=1 WATCHDOG_MIN=200 ./scripts/broll/launch.sh
# Watch s3://pax-2-638175140432/<RUN>box.log; clips at s3://pax-2-638175140432/studio/clip/wan-*.mp4
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1; ROLE=nsr-embed; BUCKET=pax-2-638175140432
AMI=ami-012ba162b9cd2729c
MENU=(${TYPES:-g6e.xlarge g6.2xlarge g5.2xlarge})
WATCHDOG_MIN=${WATCHDOG_MIN:-200}
COUNT=${COUNT:-1}  # boxes; box i takes shots i, i+COUNT, … — throughput scales linearly
RUNID=$(date -u +%Y%m%d-%H%M%S)
RUN=model/broll/$RUNID/
NAME=pax2-broll
awk -v wd=$WATCHDOG_MIN 'BEGIN { split("g6e.xlarge 1.861|g6.2xlarge 0.9776|g5.2xlarge 1.212", r, "|"); for (i = 1; i <= 3; i++) { split(r[i], p, " "); printf "plan: %s $%.3f/h, watchdog %d min caps it at $%.2f\n", p[1], p[2], wd, wd / 60 * p[2] } }'
echo "run $RUN boxes $COUNT"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

LIVE=$(aws ec2 describe-instances --region $REGION --filters "Name=tag:Name,Values=$NAME,$NAME-*" Name=instance-state-name,Values=pending,running --query 'Reservations[].Instances[].InstanceId' --output text)
[ -z "$LIVE" ] || { echo "a b-roll box is already up: $LIVE"; exit 1; }

STAGE=$(mktemp -d)
cp scripts/broll/box.sh scripts/broll/gen.py "$STAGE/"
aws s3 cp --only-show-errors --recursive "$STAGE/" "s3://$BUCKET/${RUN}code/" --region $REGION
rm -rf "$STAGE"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

LAUNCHED=0
for ((I = 0; I < COUNT; I++)); do
  USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-broll.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /work/code && aws s3 cp --only-show-errors --recursive s3://$BUCKET/${RUN}code/ /work/code/
BUCKET=$BUCKET RUN=$RUN SHARD=$I SHARDS=$COUNT bash /work/code/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-broll.log s3://$BUCKET/${RUN}box-$I.log
shutdown -h now
EOS
)
  UP=
  for TYPE in "${MENU[@]}"; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":300,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME-$I},{Key=Run,Value=$RUN}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched shard $I: $OUT $TYPE $SUBNET · log s3://$BUCKET/${RUN}box-$I.log"
      UP=1; LAUNCHED=$((LAUNCHED + 1)); break 2
    fi
    if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then echo "no $TYPE in $SUBNET"; continue; fi
    echo "run-instances failed on shard $I: $OUT"; exit 1
  done
  done
  [ -n "$UP" ] || echo "shard $I found no capacity on any type; its shots go unmade this run"
done
echo "launched $LAUNCHED of $COUNT boxes"
[ "$LAUNCHED" -gt 0 ] || exit 1
