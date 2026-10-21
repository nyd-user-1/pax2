#!/usr/bin/env bash
# Window MM-A: one self-terminating GPU box (g6e.xlarge L40S first; g6.xlarge L4 or g5.xlarge A10G on capacity errors) on the PyTorch DLAMI running scripts/video/box.sh —
# stock VideoPrism (base, large) and the CLIP rung-0 control over every catalog-media short, then Gates
# M1 and M2. The scripts/encoder/launch.sh pattern: role nsr-embed (pax2-rig covers pax-2-*), sg
# nsr-embed-sg, the default VPC's subnets in turn, terminate on shutdown, watchdog first line, 300 GB gp3.
#
#   SLICE=20 ./scripts/video/launch.sh                         # plan only
#   APPLY=1 SLICE=20 WATCHDOG_MIN=60 ./scripts/video/launch.sh   # the rehearsal (1 in 20)
#   APPLY=1 SLICE=1 WATCHDOG_MIN=<from the rehearsal> ./scripts/video/launch.sh
# Prints the run prefix and instance id; watch s3://pax-2-638175140432/<RUN>box.log
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1; ROLE=nsr-embed; BUCKET=pax-2-638175140432
AMI=ami-012ba162b9cd2729c
MENU=(${TYPES:-g6e.xlarge g6.2xlarge g5.2xlarge})  # 32 GB host RAM each; g6.xlarge (15 GB) was killed out of memory in the rehearsal  # the encoder menu; capacity errors move on
SLICE=${SLICE:?set SLICE=20 for the rehearsal or 1 for the full pass}
WATCHDOG_MIN=${WATCHDOG_MIN:-60}
V3B=model/v3/20261020T112854Zb/
RUNID=$(date -u +%Y%m%d-%H%M%S)-$([ "$SLICE" = 1 ] && echo full || echo slice$SLICE)
RUN=model/video-embeddings/$RUNID/
NAME=pax2-video-mm-a
awk -v wd=$WATCHDOG_MIN 'BEGIN { split("g6e.xlarge 1.861|g6.2xlarge 0.9776|g5.2xlarge 1.212", r, "|"); for (i = 1; i <= 3; i++) { split(r[i], p, " "); printf "plan: %s $%.3f/h, watchdog %d min caps it at $%.2f\n", p[1], p[2], wd, wd / 60 * p[2] } }'
echo "run $RUN slice $SLICE"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

LIVE=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running --query 'Reservations[].Instances[].InstanceId' --output text)
[ -z "$LIVE" ] || { echo "an MM-A box is already up: $LIVE"; exit 1; }

node scripts/video/pairs.mjs
STAGE=$(mktemp -d)
cp scripts/video/box.sh scripts/video/embed.py scripts/video/clip_embed.py scripts/video/gate_m1.py scripts/video/bench_m2.py scripts/classifier/train_v3.py scripts/rig/common.py "$STAGE/"
aws s3 cp --only-show-errors --recursive "$STAGE/" "s3://$BUCKET/${RUN}code/" --region $REGION
aws s3 cp --only-show-errors data/generated/model/video-pairs.json "s3://$BUCKET/${RUN}video-pairs.json" --region $REGION
rm -rf "$STAGE"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-video.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /work/code && aws s3 cp --only-show-errors --recursive s3://$BUCKET/${RUN}code/ /work/code/
BUCKET=$BUCKET RUN=$RUN SLICE=$SLICE V3B=$V3B bash /work/code/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-video.log s3://$BUCKET/${RUN}box.log
shutdown -h now
EOS
)

for TYPE in "${MENU[@]}"; do
for SUBNET in "${SUBNETS[@]}"; do
  if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --count 1 \
    --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
    --instance-initiated-shutdown-behavior terminate \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":300,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Run,Value=$RUN}]" \
    --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
    echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET"
    echo "instance: $OUT"
    echo "log: s3://$BUCKET/${RUN}box.log"
    exit 0
  fi
  if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then echo "no $TYPE in $SUBNET"; continue; fi
  echo "run-instances failed: $OUT"; exit 1
done
done
echo "no capacity on the menu: ${MENU[*]}"; exit 1
