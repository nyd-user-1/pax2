#!/usr/bin/env bash
# One self-terminating CPU box that projects the encoder index to the 2-D cluster map
# (scripts/encoder/map.py). Rerun after every index rebuild.
#
#   RUN=20261019-094112-train ./scripts/encoder/map-launch.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
RUN=${RUN:?run id}
WATCHDOG=${WATCHDOG:-40}
LOG_KEY=logs/encoder-map-$RUN.log

aws s3 cp --only-show-errors scripts/encoder/map.py s3://$BUCKET/code/encoder-index/map.py --region $REGION
if aws iam get-instance-profile --instance-profile-name pax2-worker --region $REGION >/dev/null 2>&1; then PROFILE=pax2-worker; else PROFILE=nsr-embed; fi
VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNET=$(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG
exec > /var/log/map.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION DEBIAN_FRONTEND=noninteractive
apt-get update -q >/dev/null && apt-get install -y -q python3-venv awscli >/dev/null
python3 -m venv /opt/map
/opt/map/bin/pip install -q --upgrade pip
/opt/map/bin/pip install -q numpy scikit-learn umap-learn boto3
mkdir -p /work && cd /work
aws s3 cp --only-show-errors s3://$BUCKET/code/encoder-index/map.py /work/map.py
BUCKET=$BUCKET RUN=$RUN /opt/map/bin/python /work/map.py
aws s3 cp --only-show-errors /var/log/map.log s3://$BUCKET/$LOG_KEY
shutdown -h now
EOS
)

ID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type c7i.xlarge --count 1 \
  --subnet-id "$SUBNET" --iam-instance-profile Name=$PROFILE --security-group-ids "$SG" \
  --instance-initiated-shutdown-behavior terminate \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-encoder-map}]" \
  --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text)
echo "launched c7i.xlarge $ID; log s3://$BUCKET/$LOG_KEY"
