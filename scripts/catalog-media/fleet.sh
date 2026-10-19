#!/usr/bin/env bash
# The proxy fleet (Brendan bought 20 Webshare static residential IPs, $6/mo, 2026-10-19): t3.micro
# boxes, each behind its own residential IP from SSM /pax2/webshare/proxies, fetch catalog media to
# s3://pax-2-638175140432/catalog-media/ at the Mac-proven pace (sleep 8, requests 1s apart — the
# 10-id gate through one IP measured 10/10 at 13s a video, 2026-10-19 09:0x UTC). The Mac crawls the
# target list from the front, so the rehearsal takes ids from the back: zero collision.
#
#   ./scripts/catalog-media/fleet.sh                     # census and plan, no launch
#   APPLY=1 REHEARSAL=1 ./scripts/catalog-media/fleet.sh # one box, 10 ids, one IP (the gate on EC2)
#   APPLY=1 ./scripts/catalog-media/fleet.sh             # the fleet; stop the Mac run first
#   MODE=audio TARGETS=path ./scripts/catalog-media/fleet.sh  # audio-only over another id list
# Census is S3 itself (an id's .m4a under catalog-media/ means done); rerun any time, done ids skip.
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
MODE=${MODE:-pairs}            # pairs: 360p mp4 + m4a; audio: m4a only
TARGETS=${TARGETS:-data/raw/videos/targets.txt}
BOXES=${BOXES:-20}
RUN=fleet-$(date -u +%Y%m%d-%H%M%S)
case $MODE in
  pairs) FMT='bv*[height<=360][ext=mp4],ba[ext=m4a]' ;;
  audio) FMT='ba[ext=m4a]' ;;
  *) echo "MODE must be pairs or audio"; exit 1 ;;
esac

# Remaining = targets minus ids whose m4a already sits in S3 (same census whisper.sh trusts).
DONE=$(mktemp); REMAIN=$(mktemp)
aws s3 ls s3://$BUCKET/catalog-media/ --region $REGION | awk '{print $4}' | grep '\.m4a$' | sed 's/\.m4a$//' > "$DONE" || true
grep -vxF -f "$DONE" "$TARGETS" > "$REMAIN" || true
N_REMAIN=$(wc -l < "$REMAIN" | tr -d ' ')
if [ "${REHEARSAL:-}" = 1 ]; then BOXES=1; tail -10 "$REMAIN" > "$REMAIN.r"; mv "$REMAIN.r" "$REMAIN"; N_REMAIN=$(wc -l < "$REMAIN" | tr -d ' '); WATCHDOG_MIN=${WATCHDOG_MIN:-30}; else WATCHDOG_MIN=${WATCHDOG_MIN:-150}; fi
PER_BOX=$(( (N_REMAIN + BOXES - 1) / BOXES ))
# Rule 6: minutes and dollars. The gate measured 13s a video through one IP, sleep included.
EST_MIN=$(( PER_BOX * 13 / 60 + 6 ))
echo "mode $MODE, targets $(wc -l < "$TARGETS" | tr -d ' '), done $(wc -l < "$DONE" | tr -d ' '), remaining $N_REMAIN"
echo "plan: $BOXES t3.micro \$0.0104/h, $PER_BOX ids a box, about $EST_MIN min, about \$$(echo "$BOXES $EST_MIN" | awk '{printf "%.2f", $1*$2/60*0.0104}'); watchdog $WATCHDOG_MIN min caps \$$(echo "$BOXES $WATCHDOG_MIN" | awk '{printf "%.2f", $1*$2/60*0.0104}')"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; rm -f "$DONE" "$REMAIN"; exit 0; }

# Id slices to S3, box i takes slice i and proxy line i (US proxies ordered first in the parameter).
aws s3 rm --only-show-errors --recursive s3://$BUCKET/code/fleet/$RUN/ --region $REGION 2>/dev/null || true
split -d -a 2 -n l/$BOXES "$REMAIN" /tmp/pax2-fleet-slice- 2>/dev/null || split -d -a 2 -l $PER_BOX "$REMAIN" /tmp/pax2-fleet-slice-
i=0
for f in /tmp/pax2-fleet-slice-*; do
  aws s3 cp --only-show-errors "$f" s3://$BUCKET/code/fleet/$RUN/box$i.txt --region $REGION
  i=$((i+1)); rm -f "$f"
done
rm -f "$DONE" "$REMAIN"

# The fleet reads one SSM SecureString; scope the read onto the rig's role the way launch-cpu.sh does.
if aws iam get-instance-profile --instance-profile-name pax2-worker --region $REGION >/dev/null 2>&1; then PROFILE=pax2-worker; ROLE=pax2-worker; else PROFILE=nsr-embed; ROLE=nsr-embed; fi
aws iam put-role-policy --role-name $ROLE --policy-name pax2-fleet --region $REGION --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"ssm:GetParameter\",\"Resource\":\"arn:aws:ssm:$REGION:*:parameter/pax2/webshare/proxies\"}]}"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)

LAUNCHED=0
for BOX in $(seq 0 $((BOXES-1))); do
  LOG_KEY=logs/pax2-$RUN-box$BOX.log
  USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec > /var/log/pax2-fleet.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
apt-get update -q >/dev/null && apt-get install -y -q python3-venv awscli >/dev/null
python3 -m venv /opt/yt && /opt/yt/bin/pip install -q -U yt-dlp
mkdir -p /work && cd /work
aws s3 cp --only-show-errors s3://$BUCKET/code/fleet/$RUN/box$BOX.txt ids.txt
LINE=\$(aws ssm get-parameter --with-decryption --name /pax2/webshare/proxies --query Parameter.Value --output text | sed -n "$((BOX+1))p")
PIP=\$(cut -d: -f1 <<<"\$LINE"); PPORT=\$(cut -d: -f2 <<<"\$LINE"); PUSER=\$(cut -d: -f3 <<<"\$LINE"); PPASS=\$(cut -d: -f4 <<<"\$LINE")
PROXY="http://\$PUSER:\$PPASS@\$PIP:\$PPORT"
echo "box $BOX proxy \$PIP ids \$(wc -l < ids.txt)"
OK=0; TRIED=0
while read -r id; do
  [ -z "\$id" ] && continue
  TRIED=\$((TRIED+1))
  /opt/yt/bin/yt-dlp -f "$FMT" --max-filesize 100M --proxy "\$PROXY" --socket-timeout 30 --sleep-requests 1 --retries 3 --retry-sleep http:30 --no-warnings -o "/work/%(id)s.%(ext)s" -- "\$id" || echo "FAIL \$id"
  GOT=0
  for f in "/work/\$id.mp4" "/work/\$id.m4a"; do
    if [ -f "\$f" ]; then aws s3 cp --only-show-errors "\$f" "s3://$BUCKET/catalog-media/\$(basename "\$f")" && rm -f "\$f" && GOT=\$((GOT+1)); fi
  done
  [ "\$GOT" -gt 0 ] && OK=\$((OK+1))
  # Five straight empty-handed attempts at the top means the IP is walled, not the files (rule 14).
  if [ "\$TRIED" -eq 5 ] && [ "\$OK" -eq 0 ]; then echo "ABORT box $BOX: 0 of first 5"; break; fi
  [ \$((TRIED % 25)) -eq 0 ] && echo "progress \$OK/\$TRIED \$(date -u +%FT%TZ)"
  sleep 8
done < ids.txt
echo "DONE box $BOX \$OK of \$TRIED"
aws s3 cp --only-show-errors /var/log/pax2-fleet.log s3://$BUCKET/$LOG_KEY
shutdown -h now
EOS
)
  OUT=""
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type t3.micro --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN-box$BOX}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched box $BOX $OUT $SUBNET log s3://$BUCKET/$LOG_KEY"
      LAUNCHED=$((LAUNCHED+1)); break
    fi
    grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" && continue
    echo "box $BOX run-instances failed: $OUT"; exit 1
  done
done
echo "launched $LAUNCHED of $BOXES boxes, run $RUN"
