#!/usr/bin/env bash
# PAX2 Headline Ranker v1: one self-terminating GPU box running scripts/headline/box.sh. The
# scripts/encoder/launch.sh pattern (role nsr-embed, sg nsr-embed-sg, bucket nsr-embed-v2, the PyTorch
# DLAMI), with the menu led by the cheapest rung, since this job is small: g6.xlarge, g5.xlarge,
# g6e.xlarge across the default VPC's subnets, moving on only on capacity errors (rule 8).
#
#   MODE=rehearse ./scripts/headline/launch.sh    # 60 tests, every step, the memory and install test
#   MODE=train    ./scripts/headline/launch.sh    # every pair, 3 epochs
# Then: BUCKET=nsr-embed-v2 ./scripts/rig/watch.sh <instance-id> pax2/headline/runs/<run>/box.log
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
ROLE=nsr-embed
BUCKET=nsr-embed-v2
AMI=ami-012ba162b9cd2729c
MODE=${MODE:?set MODE=rehearse or train}
case $MODE in
  rehearse) WATCHDOG_MIN=${WATCHDOG_MIN:-25} ;;
  train) WATCHDOG_MIN=${WATCHDOG_MIN:-60} ;;
  *) echo "MODE must be rehearse or train"; exit 1 ;;
esac
MENU=(${TYPES:-g6.xlarge g5.xlarge g6e.xlarge})
RUN_ID=${RUN_ID:-$(date -u +%Y%m%d-%H%M%S)-$MODE}
echo "run_id: $RUN_ID"

# Rule 6: minutes and dollars on each rung. Train minutes: install 6, data 1, three epochs of 41,000
# pairs at bert-base, max length 40, batch 64 (estimate 4 min an epoch on the L4, scaled by the rung),
# export and uploads 3.
awk -v mode="$MODE" -v wd="$WATCHDOG_MIN" 'BEGIN {
  split("g6.xlarge L4 0.8048 1.0|g5.xlarge A10G 1.006 0.9|g6e.xlarge L40S 1.861 0.45", r, "|")
  printf "plan (%s): minutes and dollars per rung (on-demand, us-east-1); watchdog %d min\n", mode, wd
  for (i = 1; i <= 3; i++) {
    split(r[i], p, " ")
    m = (mode == "rehearse") ? 10 : 6 + 1 + 3 * 4 * p[4] + 3
    printf "  %-11s %-5s $%.3f/h  %4.0f min  $%.2f   (watchdog caps at $%.2f)\n", p[1], p[2], p[3], m, m / 60 * p[3], wd / 60 * p[3]
  }
}'

# Rule 7: the real G quota and what is already running against it.
QUOTA=$(aws service-quotas get-service-quota --region $REGION --service-code ec2 --quota-code L-DB2E81BA --query 'Quota.Value' --output text)
USED=$(aws ec2 describe-instances --region $REGION --filters Name=instance-state-name,Values=pending,running \
  --query 'Reservations[].Instances[?starts_with(InstanceType, `g`) || starts_with(InstanceType, `vt`)].[CpuOptions.CoreCount,CpuOptions.ThreadsPerCore]' --output text \
  | awk '{s += $1 * $2} END {print s + 0}')
echo "G quota: ${QUOTA%.*} vCPUs, ${USED} in use, this box needs 4"
[ $(( ${QUOTA%.*} - USED )) -ge 4 ] || { echo "no G quota headroom"; exit 1; }

# The role reads and writes under pax2/ in this bucket (the pax2-encoder policy already grants it).
aws s3api head-object --region $REGION --bucket $BUCKET --key pax2/headline/upworthy.parquet >/dev/null \
  || { echo "parquet missing: copy curated/upworthy/upworthy-archive-confirmatory-packages-03.12.2020.parquet to s3://$BUCKET/pax2/headline/upworthy.parquet"; exit 1; }
STAGE=$(mktemp -d)
cp scripts/headline/box.sh scripts/headline/train.py "$STAGE/"
aws s3 cp --only-show-errors --recursive "$STAGE/" s3://$BUCKET/pax2/headline/code/$RUN_ID/ --region $REGION
rm -rf "$STAGE"
echo "code: s3://$BUCKET/pax2/headline/code/$RUN_ID/"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
echo "vpc $VPC sg $SG ami $AMI subnets ${SUBNETS[*]}"

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-headline.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /opt/pax2/code
aws s3 cp --only-show-errors --recursive s3://$BUCKET/pax2/headline/code/$RUN_ID/ /opt/pax2/code/
MODE=$MODE RUN_ID=$RUN_ID BUCKET=$BUCKET bash /opt/pax2/code/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-headline.log s3://$BUCKET/pax2/headline/runs/$RUN_ID/box.log
shutdown -h now
EOS
)

mkdir -p data/generated/model/headline
BOOTS=data/generated/model/headline/boots.log
for TYPE in "${MENU[@]}"; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-headline-$RUN_ID},{Key=RigMode,Value=$MODE}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET run=$RUN_ID mode=$MODE" | tee -a $BOOTS
      echo "watch: BUCKET=$BUCKET ./scripts/rig/watch.sh $OUT pax2/headline/runs/$RUN_ID/box.log"
      exit 0
    fi
    if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then
      echo "$(date -u +%FT%TZ) no $TYPE in $SUBNET: $(grep -o -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" | head -1)" | tee -a $BOOTS
      continue
    fi
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity anywhere on the menu: ${MENU[*]}"; exit 1
