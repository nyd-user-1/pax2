#!/usr/bin/env bash
# The resonance encoder (docs/briefs/OVERNIGHT-B-PLUM-RESONANCE.md, Part 3): one self-terminating GPU box
# running scripts/plum/box.sh — two arms of the PAX2 Encoder trained back to back on the pinned corpus of
# run 20261019-094112-train, each with a co-occurrence term (scripts/plum/con_pairs.py). A copy of
# scripts/encoder/launch.sh so the other window's encoder launches stay untouched; what changed: the code
# staged, the pinned corpus check, the watchdog for two arms, the plan's minutes, the Name tag.
#
# Original header follows.
# PAX2 Encoder and PAX2 Reranker: one self-terminating GPU box running scripts/encoder/box.sh.
# Copied from nsr/scripts/train-nsr/launch.sh (role nsr-embed, sg nsr-embed-sg, bucket nsr-embed-v2, the
# PyTorch DLAMI) with the DB url step removed, the pax2/ prefix, and a menu: g6.xlarge, g6e.xlarge,
# g5.xlarge across the default VPC's subnets, moving on only on capacity errors (rule 8).
#
#   MODE=rehearse ./scripts/encoder/launch.sh    # all three phases on a 400-document slice
#   MODE=train    ./scripts/encoder/launch.sh    # the whole corpus
#   TYPES="g6e.xlarge" overrides the menu; RUN_ID=<id> relaunches a run and resumes its encoder checkpoint.
# Then: BUCKET=nsr-embed-v2 ./scripts/rig/watch.sh <instance-id> pax2/runs/<run>/box.log
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
ROLE=nsr-embed
BUCKET=nsr-embed-v2
AMI=ami-012ba162b9cd2729c
MODE=${MODE:?set MODE=rehearse or train}
case $MODE in
  rehearse) WATCHDOG_MIN=${WATCHDOG_MIN:-40} ;;
  train) WATCHDOG_MIN=${WATCHDOG_MIN:-100} ;;
  *) echo "MODE must be rehearse or train"; exit 1 ;;
esac
MENU=(${TYPES:-g6e.xlarge g6.xlarge g5.xlarge})
RUN_ID=${RUN_ID:-$(date -u +%Y%m%d-%H%M%S)-resonance-$MODE}
ARMS=${ARMS:-behavior full}
echo "run_id: $RUN_ID"

# Rule 6: minutes and dollars on each rung. Training minutes scale with the measured pairs/s when the
# rehearsal has given it (PAIRS_PER_S, on that rehearsal's GPU), else NSR's 14.7 on the L40S.
PAIRS=${PAIRS:-34905}  # both arms: 16,689 + 18,216 groups
awk -v mode="$MODE" -v wd="$WATCHDOG_MIN" -v pairs="$PAIRS" -v pps="${PAIRS_PER_S:-}" 'BEGIN {
  split("g6.xlarge L4 0.8048 0.40|g6e.xlarge L40S 1.861 1.00|g5.xlarge A10G 1.006 0.45", r, "|")
  printf "plan (%s): minutes and dollars per rung (on-demand, us-east-1); watchdog %d min\n", mode, wd
  for (i = 1; i <= 3; i++) {
    split(r[i], p, " ")
    if (mode == "rehearse") { m = 20 }
    else {
      rate = (pps != "") ? pps * p[4] : 16.98 * p[4]
      enc = pairs / rate / 60
      m = 4 + 2 + enc + 2 * (2 + 2)
    }
    printf "  %-11s %-5s $%.3f/h  %4.0f min  $%.2f   (watchdog caps at $%.2f)%s\n", p[1], p[2], p[3], m, m / 60 * p[3], wd / 60 * p[3], (m > wd ? "  OVER WATCHDOG" : "")
  }
  if (mode == "train") printf "  train minutes = install 4 + phase 1 2 + %d groups at the rung'"'"'s rate (16.98/s measured on the L40S, run 20261019-094112-train) + 2 arms x (re-embed 2 + uploads 2)\n", pairs
}'

# Rule 7: the real G quota and what is already running against it.
QUOTA=$(aws service-quotas get-service-quota --region $REGION --service-code ec2 --quota-code L-DB2E81BA --query 'Quota.Value' --output text)
USED=$(aws ec2 describe-instances --region $REGION --filters Name=instance-state-name,Values=pending,running \
  --query 'Reservations[].Instances[?starts_with(InstanceType, `g`) || starts_with(InstanceType, `vt`)].[CpuOptions.CoreCount,CpuOptions.ThreadsPerCore]' --output text \
  | awk '{s += $1 * $2} END {print s + 0}')
echo "G quota: ${QUOTA%.*} vCPUs, ${USED} in use, this box needs 4"
[ $(( ${QUOTA%.*} - USED )) -ge 4 ] || { echo "no G quota headroom"; exit 1; }

# The role writes under pax2/ in this bucket and reads the Swayable archive (pax2-rig covers pax-2-*).
aws iam put-role-policy --role-name $ROLE --policy-name pax2-encoder --region $REGION --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:DeleteObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/pax2/*\"}]}"

# Code to S3, fresh per run. train.py is 44b's reranker trainer, unchanged.
aws s3api head-object --region $REGION --bucket $BUCKET --key pax2/plum/corpus/corpus.jsonl >/dev/null \
  || { echo "pinned corpus missing under s3://$BUCKET/pax2/plum/corpus/"; exit 1; }
STAGE=$(mktemp -d)
cp scripts/plum/box.sh scripts/plum/con_pairs.py scripts/encoder/common.py scripts/encoder/phase1.py scripts/encoder/phase2.py "$STAGE/"
cp data/generated/model/co-occurrence.json "$STAGE/"
aws s3 cp --only-show-errors --recursive "$STAGE/" s3://$BUCKET/pax2/code/$RUN_ID/ --region $REGION
rm -rf "$STAGE"
echo "code: s3://$BUCKET/pax2/code/$RUN_ID/"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
echo "vpc $VPC sg $SG ami $AMI subnets ${SUBNETS[*]}"

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec >> /var/log/pax2-encoder.log 2>&1
export AWS_DEFAULT_REGION=$REGION
mkdir -p /opt/pax2/code
aws s3 cp --only-show-errors --recursive s3://$BUCKET/pax2/code/$RUN_ID/ /opt/pax2/code/
MODE=$MODE RUN_ID=$RUN_ID BUCKET=$BUCKET ARMS='$ARMS' bash /opt/pax2/code/box.sh
echo "box.sh returned \$? \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/pax2-encoder.log s3://$BUCKET/pax2/runs/$RUN_ID/box.log
shutdown -h now
EOS
)

BOOTS=data/generated/model/encoder/boots.log
for TYPE in "${MENU[@]}"; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":150,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-resonance-$RUN_ID},{Key=RigMode,Value=$MODE}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET run=$RUN_ID mode=$MODE" | tee -a $BOOTS
      echo "watch: BUCKET=$BUCKET ./scripts/rig/watch.sh $OUT pax2/runs/$RUN_ID/box.log"
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
