#!/usr/bin/env bash
# Codebook 5K: one self-terminating GPU box on the PyTorch DLAMI running scripts/codebook/box.sh — the
# scripts/vqa/launch.sh pattern (role nsr-embed, sg nsr-embed-sg, the default VPC's subnets in turn, terminate
# on shutdown, watchdog first line). Spot g6.xlarge first; the 8-vCPU spot G quota is Window Q's while its
# census box runs, so on any spot quota or capacity error it launches on-demand g6.xlarge (~$0.80/h).
# A rerun resumes: ids with both outputs skip.
#
#   LIMIT=20 ./scripts/codebook/launch.sh                               # plan only
#   APPLY=1 LIMIT=20 WATCHDOG_MIN=40 ./scripts/codebook/launch.sh       # the 20-video verification
#   APPLY=1 WATCHDOG_MIN=<from the 20> ./scripts/codebook/launch.sh     # the batch over prompts.jsonl
#   PROMPTS=data/raw/codebook/prompts-all.jsonl ...                     # the stretch
#   SECOND=1 CB_ENV="... REVERSE=1"                                      # a second box beside a running one
#   ORDER=<ids file>                                                    # ids to run first (default the verification 20)
# Prints the run prefix and instance id; the log is s3://pax-2-638175140432/<RUN>box.log
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1; ROLE=nsr-embed; BUCKET=pax-2-638175140432
AMI=ami-012ba162b9cd2729c
TYPE=${TYPE:-g6.xlarge}
MODEL=${MODEL:-Qwen/Qwen3-8B}
TAG=${TAG:-qwen3-8b-v1}
LIMIT=${LIMIT:-0}
WATCHDOG_MIN=${WATCHDOG_MIN:-40}
PROMPTS=${PROMPTS:-data/raw/codebook/prompts.jsonl}
CB_ENV=${CB_ENV:-QUANT=fp8 KV_DTYPE=fp8}
RUN=codebook/runs/$(date -u +%Y%m%d-%H%M%S)${LIMIT/#0/}/
NAME=pax2-codebook
echo "run $RUN model $MODEL tag $TAG limit $LIMIT env '$CB_ENV'; watchdog $WATCHDOG_MIN min caps on-demand $TYPE at \$$(awk -v m=$WATCHDOG_MIN 'BEGIN{printf "%.2f", m/60*0.8048}')"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

[ "${SECOND:-}" = 1 ] || LIVE=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running --query 'Reservations[].Instances[].InstanceId' --output text)
[ -z "${LIVE:-}" ] || { echo "a codebook box is already up: $LIVE"; exit 1; }
aws s3 cp --only-show-errors "$PROMPTS" "s3://$BUCKET/${RUN}prompts.jsonl" --region $REGION
aws s3 cp --only-show-errors ${ORDER:-data/raw/codebook/verify-ids.txt} "s3://$BUCKET/${RUN}order.txt" --region $REGION
aws s3 cp --only-show-errors scripts/codebook/codebook.py "s3://$BUCKET/${RUN}code/codebook.py" --region $REGION
aws s3 cp --only-show-errors scripts/codebook/box.sh "s3://$BUCKET/${RUN}code/box.sh" --region $REGION

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-codebook.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /work && aws s3 cp --only-show-errors s3://$BUCKET/${RUN}code/box.sh /work/box.sh
BUCKET=$BUCKET RUN=$RUN MODEL=$MODEL TAG=$TAG LIMIT=$LIMIT CB_ENV="$CB_ENV" bash /work/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-codebook.log s3://$BUCKET/${RUN}box.log
shutdown -h now
EOS
)

SPOT='--instance-market-options {"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time","InstanceInterruptionBehavior":"terminate"}}'
for MARKET in ${MARKETS:-spot on-demand}; do
for SUBNET in "${SUBNETS[@]}"; do
  if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --count 1 \
    --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
    $([ $MARKET = spot ] && echo "$SPOT") \
    --instance-initiated-shutdown-behavior terminate \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Run,Value=$RUN},{Key=Market,Value=$MARKET}]" \
    --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
    echo "$(date -u +%FT%TZ) launched $OUT $TYPE $MARKET $SUBNET"
    echo "instance: $OUT"
    echo "run: $RUN"
    echo "log: s3://$BUCKET/${RUN}box.log"
    exit 0
  fi
  if grep -q -E 'MaxSpotInstanceCountExceeded|VcpuLimitExceeded' <<<"$OUT"; then echo "$MARKET quota: $(grep -o -E '\(\w+\)' <<<"$OUT" | head -1)"; continue 2; fi
  if grep -q -E 'InsufficientInstanceCapacity|Unsupported|SpotMaxPriceTooLow|capacity' <<<"$OUT"; then echo "no $TYPE $MARKET in $SUBNET"; continue; fi
  echo "run-instances failed: $OUT"; exit 1
done
done
echo "no capacity: $TYPE spot or on-demand"; exit 1
