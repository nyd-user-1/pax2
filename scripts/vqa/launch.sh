#!/usr/bin/env bash
# Window Q: one self-terminating spot GPU box (g6e.xlarge L40S first; then L4 g6.2xlarge, g6.xlarge and A10G g5.2xlarge, g5.xlarge on spot capacity errors) on the
# PyTorch DLAMI running scripts/vqa/box.sh. The scripts/video/launch.sh pattern (role nsr-embed, sg
# nsr-embed-sg, the default VPC's subnets in turn, terminate on shutdown, watchdog first line), on the spot
# market, one-time, terminate on interruption. A rerun resumes: done ids skip.
#
#   LIMIT=20 ./scripts/vqa/launch.sh                                  # plan only
#   APPLY=1 LIMIT=20 WATCHDOG_MIN=40 ./scripts/vqa/launch.sh          # the 20-video verification
#   APPLY=1 WATCHDOG_MIN=<from the 20> ./scripts/vqa/launch.sh        # the batch over data/raw/vqa/set.tsv
#   MODE=ask ASK_RUN=<prefix> ...                                     # used by scripts/vqa/ask.mjs
#   MODEL=Qwen/Qwen3-VL-8B-Instruct TAG=qwen3-vl-8b-p2 VQA_ENV="MAX_LEN=4096 GPU_UTIL=0.95 MAX_SEQS=8 MAX_BATCHED=4096"
# Prints the run prefix and instance id; the log is s3://pax-2-638175140432/<RUN>box.log
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1; ROLE=nsr-embed; BUCKET=pax-2-638175140432
AMI=ami-012ba162b9cd2729c
MENU=(${TYPES:-g6e.xlarge g6.2xlarge g6.xlarge g5.2xlarge g5.xlarge})
MODE=${MODE:-batch}
MODEL=${MODEL:-Qwen/Qwen3-VL-4B-Instruct}
TAG=${TAG:-qwen3-vl-4b-p3}
LIMIT=${LIMIT:-0}
WATCHDOG_MIN=${WATCHDOG_MIN:-40}
RUN=${ASK_RUN:-vqa/runs/$(date -u +%Y%m%d-%H%M%S)-$MODE${LIMIT/#0/}/}
NAME=pax2-vqa-$MODE
echo "run $RUN mode $MODE model $MODEL tag $TAG limit $LIMIT; watchdog $WATCHDOG_MIN min caps g6e.xlarge at \$$(awk -v m=$WATCHDOG_MIN 'BEGIN{printf "%.2f", m/60*1.861}') (on-demand ceiling)"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

if [ "$MODE" = batch ]; then
  LIVE=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running --query 'Reservations[].Instances[].InstanceId' --output text)
  [ -z "$LIVE" ] || { echo "a batch box is already up: $LIVE"; exit 1; }
  aws s3 cp --only-show-errors data/raw/vqa/set.tsv "s3://$BUCKET/${RUN}ids.tsv" --region $REGION
fi
aws s3 cp --only-show-errors scripts/vqa/vqa.py "s3://$BUCKET/${RUN}code/vqa.py" --region $REGION
aws s3 cp --only-show-errors scripts/vqa/box.sh "s3://$BUCKET/${RUN}code/box.sh" --region $REGION

# A spot request can stay "active" after its box terminates and hold the 8-vCPU spot quota; cancel those.
for SIR in $(aws ec2 describe-spot-instance-requests --region $REGION --filters Name=state,Values=active --query 'SpotInstanceRequests[].[SpotInstanceRequestId,InstanceId]' --output text | while read R I; do
  [ "$(aws ec2 describe-instances --region $REGION --instance-ids $I --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)" = terminated ] && echo $R; done); do
  aws ec2 cancel-spot-instance-requests --region $REGION --spot-instance-request-ids $SIR >/dev/null && echo "cancelled stale spot request $SIR" && sleep 45
done

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-vqa.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /work && aws s3 cp --only-show-errors s3://$BUCKET/${RUN}code/box.sh /work/box.sh
BUCKET=$BUCKET RUN=$RUN MODE=$MODE MODEL=$MODEL TAG=$TAG LIMIT=$LIMIT VQA_ENV="${VQA_ENV:-}" bash /work/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-vqa.log s3://$BUCKET/${RUN}box.log
shutdown -h now
EOS
)

# Spot first, always. ONDEMAND_FALLBACK=1 (asks only: a person is waiting) tries on-demand g6.2xlarge after the
# whole spot menu refuses; at 2026-10-22 spot was $0.86-0.93/h against $0.98/h on-demand.
MARKETS=(spot); [ "${ONDEMAND_FALLBACK:-}" = 1 ] && MARKETS+=(ondemand)
for MARKET in "${MARKETS[@]}"; do
[ $MARKET = spot ] && MKT=(--instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time","InstanceInterruptionBehavior":"terminate"}}') || { MKT=(); MENU=(g6.2xlarge); }
for TYPE in "${MENU[@]}"; do
for SUBNET in "${SUBNETS[@]}"; do
  if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $TYPE --count 1 \
    --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
    "${MKT[@]}" \
    --instance-initiated-shutdown-behavior terminate \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":150,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Run,Value=$RUN}]" \
    --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
    echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET $MARKET"
    echo "instance: $OUT"
    echo "run: $RUN"
    echo "log: s3://$BUCKET/${RUN}box.log"
    exit 0
  fi
  if grep -q -E 'InsufficientInstanceCapacity|Unsupported|SpotMaxPriceTooLow|capacity' <<<"$OUT"; then echo "no $TYPE in $SUBNET: $(grep -o -E "\(\w+\)[^.]*" <<<"$OUT" | head -1)"; continue; fi
  echo "run-instances failed: $OUT"; [ $MARKET = spot ] && grep -q MaxSpotInstanceCountExceeded <<<"$OUT" && break 2; exit 1
done
done
done
echo "no capacity on the menu: ${MENU[*]}"; exit 1
