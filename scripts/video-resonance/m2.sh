#!/usr/bin/env bash
# PAX2 Video Resonance, the M2 classifier-add re-read with a trained head (window MM-B; reported, never
# gated). MM-A's own staged train_v3.py, common.py and bench_m2.py and its m2 inputs (run
# 20261021-040633-full), with video.jsonl replaced by the head's embedding, on one self-terminating
# c7i.xlarge. Inputs are copied server-side into this run's prefix; nothing heavy touches the Mac.
#
#   HEAD=model/video-resonance/<run>/head-v3.jsonl ARM=v3 APPLY=1 ./scripts/video-resonance/m2.sh
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed; BUCKET=pax-2-638175140432
MMA=model/video-embeddings/20261021-040633-full
HEAD=${HEAD:?}; ARM=${ARM:?}
RUN=${RUN:-vres-m2-$ARM-$(date -u +%Y%m%d-%H%M%S)}
P=model/video-resonance/$RUN/
WATCHDOG_MIN=${WATCHDOG_MIN:-30}
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
echo "run $RUN head $HEAD watchdog $WATCHDOG_MIN"
[ "${APPLY:-}" = 1 ] || { echo "dry run"; exit 0; }
for k in composition.json embeddings.npy holdout.json rows.json training-set.jsonl training-set.manifest.json transcript-features.json; do
  aws s3 cp --only-show-errors --region $REGION s3://$BUCKET/$MMA/m2/$k s3://$BUCKET/${P}m2/$k
done
aws s3 cp --only-show-errors --region $REGION s3://$BUCKET/$HEAD s3://$BUCKET/${P}m2/video.jsonl
for k in train_v3.py common.py bench_m2.py; do aws s3 cp --only-show-errors --region $REGION s3://$BUCKET/$MMA/code/$k s3://$BUCKET/${P}code/$k; done
VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNET=$(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)
USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec > /var/log/pax2-m2.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
apt-get update -q && apt-get install -y -q python3-venv unzip >/dev/null
curl -sS https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install
python3 -m venv /opt/venv && /opt/venv/bin/pip install -q numpy boto3
mkdir -p /work/out && cd /work && aws s3 cp --only-show-errors --recursive s3://$BUCKET/${P}code/ .
md5sum train_v3.py common.py bench_m2.py
BUCKET=$BUCKET RUN=${P}m2/ OUT=/work/out VIDEO=1 /opt/venv/bin/python train_v3.py; echo "train_v3 EXIT=\$?"
OUT=/work/out ARM=$ARM /opt/venv/bin/python bench_m2.py; echo "bench_m2 EXIT=\$?"
aws s3 cp --only-show-errors --recursive /work/out/ s3://$BUCKET/${P}out/
aws s3 cp --only-show-errors /var/log/pax2-m2.log s3://$BUCKET/${P}box.log
shutdown -h now
EOS
)
ID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type c7i.xlarge --count 1 --subnet-id "$SUBNET" \
  --iam-instance-profile Name=$ROLE --security-group-ids "$SG" --instance-initiated-shutdown-behavior terminate \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN}]" --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text)
echo "$(date -u +%FT%TZ) launched $ID run=$RUN out s3://$BUCKET/$P"
