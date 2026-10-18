#!/usr/bin/env bash
# The ffmpeg layer for the pax2-transcode Lambda, built on one self-terminating t3.small: the static
# amd64 build from johnvansickle.com, bin/ffmpeg zipped as a Lambda layer (it lands at /opt/bin/ffmpeg),
# the zip uploaded to s3://pax-2-638175140432/lambda/layers/, the layer published as pax2-ffmpeg, and
# the box shuts itself down. Shape copied from scripts/rig/launch-cpu.sh.
#
#   ./scripts/transcode/build-layer.sh            # the plan, the profile and the menu; launches nothing
#   ./scripts/transcode/build-layer.sh --apply    # launches the box and prints the instance to poll
# Then poll: aws ec2 describe-instances --region us-east-1 --instance-ids <id> --query 'Reservations[0].Instances[0].State.Name'
# The log, the ffmpeg -version and -encoders dumps, and the published layer ARN land under lambda/layers/.
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
LAYER=pax2-ffmpeg
PROFILE=nsr-embed
WATCHDOG=20
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG_KEY=lambda/layers/build-$TS.log
MENU=(${TYPES:-t3.small t3a.small})
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1

# Rule 6: time and money. Boot and apt 3 min, the 40 MB download and zip 2 min, the S3 upload and
# publish 1 min; the watchdog caps the worst case.
awk -v wd=$WATCHDOG 'BEGIN {
  printf "plan: about 6 minutes on t3.small, $%.4f at $0.0208/h; the %d-minute watchdog caps it at $%.4f\n", 6 / 60 * 0.0208, wd, wd / 60 * 0.0208
  printf "  next rung t3.medium $0.0416/h, same minutes (the job is download-bound), $%.4f\n", 6 / 60 * 0.0416
}'

if aws lambda list-layer-versions --region $REGION --layer-name $LAYER --query 'LayerVersions[0].LayerVersionArn' --output text 2>/dev/null | grep -q arn; then
  echo "layer $LAYER already published: $(aws lambda list-layer-versions --region $REGION --layer-name $LAYER --query 'LayerVersions[0].LayerVersionArn' --output text)"
  exit 0
fi

POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:PublishLayerVersion\",\"Resource\":\"arn:aws:lambda:$REGION:638175140432:layer:$LAYER\"},{\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/lambda/layers/*\"}]}"
VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)
echo "profile $PROFILE (inline policy pax2-layer: publish $LAYER, put lambda/layers/*)"
echo "vpc $VPC sg $SG ami $AMI subnets ${SUBNETS[*]} menu ${MENU[*]}"
echo "log: s3://$BUCKET/$LOG_KEY"

if [ $APPLY = 0 ]; then echo "dry run; --apply launches"; exit 0; fi
aws iam put-role-policy --role-name $PROFILE --policy-name pax2-layer --region $REGION --policy-document "$POLICY"

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG
exec >> /var/log/layer.log 2>&1
set -uo pipefail
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
up() { aws s3 cp --only-show-errors /var/log/layer.log s3://$BUCKET/$LOG_KEY; }
echo "boot \$(date -u +%FT%TZ) \$(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
apt-get update -q && apt-get install -y -q awscli zip xz-utils curl >/dev/null
echo "installed \$(date -u +%FT%TZ)"
# A failed step stops the script: record its exit code, upload the log, and let the box go.
trap 'c=\$?; if [ \$c -ne 0 ]; then echo "exit \$c \$(date -u +%FT%TZ)"; up; shutdown -h now; fi' EXIT
set -e
mkdir -p /work/layer/bin && cd /work
curl -sSfLO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
curl -sSfLO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5
md5sum -c ffmpeg-release-amd64-static.tar.xz.md5
tar xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-amd64-static/ffmpeg layer/bin/ffmpeg && chmod 755 layer/bin/ffmpeg
layer/bin/ffmpeg -hide_banner -version > ffmpeg-version.txt
layer/bin/ffmpeg -hide_banner -encoders > ffmpeg-encoders.txt
layer/bin/ffmpeg -hide_banner -h full > ffmpeg-help.txt
grep -q libx264 ffmpeg-encoders.txt && grep -q ' aac ' ffmpeg-encoders.txt
head -1 ffmpeg-version.txt
(cd layer && zip -q -9 ../$LAYER.zip bin/ffmpeg)
ls -l $LAYER.zip layer/bin/ffmpeg
for f in ffmpeg-version.txt ffmpeg-encoders.txt ffmpeg-help.txt; do aws s3 cp --only-show-errors \$f s3://$BUCKET/lambda/layers/$TS-\$f; done
aws s3 cp --only-show-errors $LAYER.zip s3://$BUCKET/lambda/layers/$LAYER-$TS.zip
aws lambda publish-layer-version --layer-name $LAYER --description "ffmpeg static amd64 (johnvansickle.com), \$(head -1 ffmpeg-version.txt | cut -d' ' -f3)" \
  --content S3Bucket=$BUCKET,S3Key=lambda/layers/$LAYER-$TS.zip --compatible-runtimes nodejs22.x --compatible-architectures x86_64 \
  --query LayerVersionArn --output text | tee layer-arn.txt
aws s3 cp --only-show-errors layer-arn.txt s3://$BUCKET/lambda/layers/$TS-layer-arn.txt
set +e
echo "exit 0 \$(date -u +%FT%TZ)"
up
shutdown -h now
EOS
)
for TYPE in "${MENU[@]}"; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":10,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-ffmpeg-layer}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $TYPE in $SUBNET"
      echo "instance: $OUT"
      exit 0
    fi
    if grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT"; then
      echo "no $TYPE in $SUBNET"; continue
    fi
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity anywhere on the menu: ${MENU[*]}"; exit 1
