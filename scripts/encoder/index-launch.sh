#!/usr/bin/env bash
# One self-terminating CPU box that builds PAX2 Encoder's serving index (scripts/encoder/index.py):
# the corpus embedded by the run's fine-tuned weights into s3://pax-2-638175140432/model/encoder-index/<run>/.
# Shape copied from scripts/rig/launch-cpu.sh. Rerun after every encoder retrain that passes its gate.
#
#   RUN=20261019-094112-train ./scripts/encoder/index-launch.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
RUN=${RUN:?run id, e.g. 20261019-094112-train}
MODEL_S3=${MODEL_S3:-s3://nsr-embed-v2/pax2/models/$RUN/encoder/}
WATCHDOG=${WATCHDOG:-90}
LOG_KEY=logs/encoder-index-$RUN.log

aws s3 cp --only-show-errors data/generated/model/encoder/corpus.jsonl s3://$BUCKET/model/encoder-index/corpus.jsonl --region $REGION
aws s3 cp --only-show-errors scripts/encoder/index.py s3://$BUCKET/code/encoder-index/index.py --region $REGION
echo "staged corpus ($(wc -l < data/generated/model/encoder/corpus.jsonl | tr -d ' ') documents) and index.py"

if aws iam get-instance-profile --instance-profile-name pax2-worker --region $REGION >/dev/null 2>&1; then PROFILE=pax2-worker; ROLE=pax2-worker; else PROFILE=nsr-embed; ROLE=nsr-embed; fi
# The weights live in the encoder runs' bucket; scope a read onto the role the way fleet.sh does.
aws iam put-role-policy --role-name $ROLE --policy-name pax2-encoder-index --region $REGION --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:ListBucket","Resource":"arn:aws:s3:::nsr-embed-v2"},{"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::nsr-embed-v2/*"}]}'
VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNET=$(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG
exec > /var/log/index.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
apt-get update -q >/dev/null && apt-get install -y -q python3-venv awscli >/dev/null
python3 -m venv /opt/idx
/opt/idx/bin/pip install -q --upgrade pip
/opt/idx/bin/pip install -q torch --index-url https://download.pytorch.org/whl/cpu
/opt/idx/bin/pip install -q sentence-transformers boto3 numpy
mkdir -p /work && cd /work
aws s3 cp --only-show-errors s3://$BUCKET/code/encoder-index/index.py /work/index.py
BUCKET=$BUCKET MODEL_S3=$MODEL_S3 RUN=$RUN /opt/idx/bin/python /work/index.py
aws s3 cp --only-show-errors /var/log/index.log s3://$BUCKET/$LOG_KEY
shutdown -h now
EOS
)

ID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type c7i.2xlarge --count 1 \
  --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
  --instance-initiated-shutdown-behavior terminate \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":40,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-encoder-index}]" \
  --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text)
echo "launched c7i.2xlarge $ID; log s3://$BUCKET/$LOG_KEY"
