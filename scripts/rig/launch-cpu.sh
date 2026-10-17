#!/usr/bin/env bash
# The PAX2 rig: one self-terminating CPU box that runs scripts/rig/run-all.sh (thumbnails, PAX2 Vision
# Encoder features, PAX2 Classifier, PAX2 Velocity Classifier, PAX2 Platform Simulator, PAX2 Headline
# Ranker, PAX2 Retention Regressor) and turns itself off. Shape copied from nsr/scripts/publish-nsr/
# launch.sh: Ubuntu 22.04 from the public SSM parameter, user-data does the work, uploads its log, and
# shutdown -h now with --instance-initiated-shutdown-behavior terminate.
#
#   MODE=rehearse ./scripts/rig/launch-cpu.sh   # every 100th training row, outputs under model/rehearsal/
#   MODE=full     ./scripts/rig/launch-cpu.sh   # everything, outputs under model/
# Then: ./scripts/rig/watch.sh <instance-id> <log key>
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
MODE=${MODE:-full}
TS=$(date -u +%Y%m%dT%H%M%SZ)
case $MODE in
  rehearse) PREFIX=model/rehearsal/; LIMIT=100; WATCHDOG=${WATCHDOG:-40}; LOG_KEY=logs/rig-rehearsal-$TS.log ;;
  full) PREFIX=model/; LIMIT=1; WATCHDOG=${WATCHDOG:-150}; LOG_KEY=logs/rig-$TS.log ;;
  *) echo "MODE must be rehearse or full"; exit 1 ;;
esac
MENU=(${TYPES:-c7i.xlarge c6i.xlarge m7i.xlarge})

# Rule 6: time and money together, this box and the next rung. On-demand Linux, us-east-1.
# Minutes for the full run; the encoder's are from the rehearsal's measured rate when it has run.
ENC_MIN=${ENC_MIN:-35}
awk -v enc="$ENC_MIN" -v mode="$MODE" -v wd="$WATCHDOG" 'BEGIN {
  split("install 6|thumbs 5|encode " enc "|train_var 3|velocity 1|platform_sim 1|headline 4|retention 20", j, "|")
  t = 0; t2 = 0
  printf "plan (%s): expected minutes per job on c7i.xlarge (4 vCPU) and c7i.2xlarge (8 vCPU)\n", mode
  for (i = 1; i <= 8; i++) { split(j[i], p, " "); m2 = (p[1] == "encode") ? p[2] / 2 : p[2]; printf "  %-13s %5.0f  %5.0f\n", p[1], p[2], m2; t += p[2]; t2 += m2 }
  if (mode == "rehearse") { t = 25; t2 = 22; print "  rehearsal: 1% of rows and KuaiRand-Pure, about 25 minutes" }
  printf "  c7i.xlarge  $0.1785/h: %3.0f min, $%.2f   (watchdog %d min caps it at $%.2f)\n", t, t / 60 * 0.1785, wd, wd / 60 * 0.1785
  printf "  c7i.2xlarge $0.3570/h: %3.0f min, $%.2f\n", t2, t2 / 60 * 0.357
  printf "  fallbacks: c6i.xlarge $0.1700/h, m7i.xlarge $0.2016/h\n"
}'

# Instance profile: pax2-worker if it exists, else nsr-embed with the pax2-rig inline policy.
if aws iam get-instance-profile --instance-profile-name pax2-worker --region $REGION >/dev/null 2>&1; then
  PROFILE=pax2-worker
else
  PROFILE=nsr-embed
  aws iam put-role-policy --role-name nsr-embed --policy-name pax2-rig --region $REGION --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:ListBucket","Resource":["arn:aws:s3:::pax-2-638175140432","arn:aws:s3:::pax-2-velocity-638175140432"]},{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::pax-2-638175140432/*","arn:aws:s3:::pax-2-velocity-638175140432/*"]}]}'
fi
echo "profile: $PROFILE"

# Code and inputs to S3. The fixtures carry the TypeScript definitions the jobs assert against (rule 15).
STAGE=$(mktemp -d)
aws s3 cp --only-show-errors s3://pax-2-velocity-638175140432/velocity/meta.json "$STAGE/meta.json" --region $REGION
aws s3 cp --only-show-errors s3://pax-2-velocity-638175140432/velocity/baselines.json "$STAGE/baselines.json" --region $REGION
node --experimental-strip-types --no-warnings scripts/rig/export-fixtures.mjs "$STAGE/code" "$STAGE/meta.json" "$STAGE/baselines.json"
cp scripts/rig/*.py scripts/rig/run-all.sh scripts/rig/requirements.txt "$STAGE/code/"
aws s3 rm --only-show-errors --recursive s3://$BUCKET/code/rig/ --region $REGION
aws s3 cp --only-show-errors --recursive "$STAGE/code/" s3://$BUCKET/code/rig/ --region $REGION
aws s3 cp --only-show-errors data/generated/model/training-set.jsonl s3://$BUCKET/model/training-set.jsonl --region $REGION
aws s3 cp --only-show-errors data/generated/model/training-set.manifest.json s3://$BUCKET/model/training-set.manifest.json --region $REGION
echo "uploaded: s3://$BUCKET/code/rig/ ($(ls "$STAGE/code" | wc -l | tr -d ' ') files), model/training-set.jsonl ($(wc -l < data/generated/model/training-set.jsonl | tr -d ' ') rows)"
rm -rf "$STAGE"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)
echo "vpc $VPC sg $SG ami $AMI subnets ${SUBNETS[*]}"

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG
exec >> /var/log/rig.log 2>&1
set -uo pipefail
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
echo "boot \$(date -u +%FT%TZ) \$(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
apt-get update -q && apt-get install -y -q python3-venv awscli aria2 >/dev/null
mkdir -p /work/code && aws s3 cp --only-show-errors --recursive s3://$BUCKET/code/rig/ /work/code/
python3 -m venv /opt/rig
/opt/rig/bin/pip install -q --upgrade pip
/opt/rig/bin/pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu
grep -v -E '^(#|resmem|$)' /work/code/requirements.txt > /work/req-core.txt
/opt/rig/bin/pip install -q -r /work/req-core.txt
/opt/rig/bin/pip install -q resmem || echo "resmem install FAILED; memorability will be null"
/opt/rig/bin/pip freeze | grep -i -E '^(torch|torchvision|open.clip.torch|resmem|numpy|pandas|scikit.learn|pyarrow|pillow)=='
echo "installed \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/rig.log s3://$BUCKET/$LOG_KEY
chmod +x /work/code/run-all.sh
BUCKET=$BUCKET RIG_PREFIX=$PREFIX RIG_MODE=$MODE RIG_LIMIT=$LIMIT LOG_KEY=$LOG_KEY PY=/opt/rig/bin/python /work/code/run-all.sh
echo "rig done \$(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/rig.log s3://$BUCKET/$LOG_KEY
shutdown -h now
EOS
)

# Rule 8: a menu of types across the default VPC's subnets; capacity errors move on, anything else stops.
for TYPE in "${MENU[@]}"; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":60,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-rig-cpu},{Key=RigMode,Value=$MODE}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "launched $TYPE in $SUBNET"
      echo "instance: $OUT"
      echo "log: s3://$BUCKET/$LOG_KEY"
      echo "watch: ./scripts/rig/watch.sh $OUT $LOG_KEY"
      exit 0
    fi
    if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then
      echo "no $TYPE in $SUBNET: $(grep -o -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" | head -1)"
      continue
    fi
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity anywhere on the menu: ${MENU[*]}"; exit 1
