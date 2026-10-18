#!/usr/bin/env bash
# Publish one directory to a private Hugging Face repository under NYSgpt from a self-terminating
# t3.small. Copied from nsr/scripts/publish-nsr/launch.sh (token from SSM /nsr/hf/token, read on the box
# with --with-decryption, never echoed), with the watchdog as the user-data's first line (rule 3) and,
# after the upload, the repository's files and sizes listed into the log beside the source's (rule 26).
#
#   SRC=s3://nsr-embed-v2/pax2/publish/<name>/ REPO=NYSgpt/<name> [TYPE=model|dataset] ./scripts/encoder/publish.sh
# SRC carries README.md (the card). Prints the instance id and the log key.
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed; BUCKET=nsr-embed-v2
SRC=${SRC:?}; REPO=${REPO:?}; TYPE=${TYPE:-model}
NAME=pax2-publish-$(echo "$REPO" | tr '/' '-')
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG_KEY=pax2/logs/$NAME-$TS.log
VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
AMI=$(aws ssm get-parameter --region $REGION --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id --query Parameter.Value --output text)
USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +30
set -uo pipefail
exec > /var/log/publish.log 2>&1
export AWS_DEFAULT_REGION=$REGION
apt-get update -q && apt-get install -y -q python3-venv awscli >/dev/null
python3 -m venv /opt/hf && /opt/hf/bin/pip install -q huggingface_hub
mkdir -p /work && aws s3 sync --only-show-errors --exclude "checkpoint-*/*" $SRC /work/
echo "source:"; (cd /work && find . -type f -printf '%s %P\n' | sort -k2)
export HF_TOKEN=\$(aws ssm get-parameter --region $REGION --with-decryption --name /nsr/hf/token --query Parameter.Value --output text)
/opt/hf/bin/python - <<'PY'
import os
from huggingface_hub import HfApi
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo("$REPO", repo_type="$TYPE", private=True, exist_ok=True)
info = api.upload_folder(folder_path="/work", repo_id="$REPO", repo_type="$TYPE", commit_message="PAX2: files and card")
print("UPLOADED", "$REPO", getattr(info, "commit_url", info))
print("repo:")
for f in sorted(api.list_repo_tree("$REPO", repo_type="$TYPE", recursive=True), key=lambda f: f.path):
    if hasattr(f, "size"):
        print(f.size, f.path)
PY
echo "PUBLISH-EXIT=\$?"
aws s3 cp --only-show-errors /var/log/publish.log s3://$BUCKET/$LOG_KEY
shutdown -h now
EOS
)
ID=$(aws ec2 run-instances --region $REGION --image-id $AMI --instance-type t3.small --count 1 \
  --iam-instance-profile Name=$ROLE --security-group-ids $SG \
  --instance-initiated-shutdown-behavior terminate \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
  --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text)
echo "$(date -u +%FT%TZ) launched $ID t3.small publish $REPO" | tee -a data/generated/model/encoder/boots.log
echo "instance: $ID"
echo "log: $LOG_KEY"
