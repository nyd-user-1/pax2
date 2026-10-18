#!/usr/bin/env bash
# Deploys lambda/analyze as pax2-analyze: Node 22, 256 MB, 60 s, the execution role pax2-analyze
# (RunInstances with the nsr-embed instance profile, the EC2 and SSM reads it needs, S3 head and put
# under features/ in the bucket, CloudWatch Logs), the box role's inline policy pax2-analyze (DynamoDB
# PutItem on pax2-ledger, S3 under features/ and logs/), the rig code under code/rig/, and the bucket's
# S3 notification for uploads/ *.mp4 merged beside pax2-transcode's.
#
#   ./scripts/analyze/deploy.sh            # dry run: what exists, what it would make
#   ./scripts/analyze/deploy.sh --apply    # makes or updates every piece, prints each
#   ./scripts/analyze/deploy.sh --test <original-id>   # re-puts that original's mp4 so the chain runs on a real record
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
ACCOUNT=638175140432
BUCKET=pax-2-638175140432
TABLE=pax2-ledger
FN=pax2-analyze
ROLE=pax2-analyze
BOX_ROLE=nsr-embed
NOTIFY_ID=pax2-analyze-mp4
MODE=dry; case "${1:-}" in --apply) MODE=apply ;; --test) MODE=test; TEST_ID=${2:?original id} ;; "") ;; *) echo "usage: $0 [--apply|--test <original-id>]"; exit 1 ;; esac
AWS_BIN=$(type -P aws)
aws() { "$AWS_BIN" --region $REGION "$@"; }

if [ $MODE = test ]; then
  KEY=$(aws dynamodb get-item --table-name $TABLE --key "{\"pk\":{\"S\":\"ORIG#$TEST_ID\"},\"sk\":{\"S\":\"META\"}}" --query 'Item.key.S' --output text)
  [ -n "$KEY" ] && [ "$KEY" != None ] || { echo "no original $TEST_ID"; exit 1; }
  case "$KEY" in *.mp4) ;; *) echo "the original's key is $KEY, not an mp4; the transcode Lambda makes the mp4 for webm uploads"; exit 1 ;; esac
  aws s3 rm --only-show-errors s3://$BUCKET/features/$TEST_ID.launched 2>/dev/null || true
  aws s3 rm --only-show-errors s3://$BUCKET/features/$TEST_ID.json 2>/dev/null || true
  T0=$(date +%s)
  aws s3 cp --only-show-errors s3://$BUCKET/$KEY s3://$BUCKET/$KEY --metadata-directive REPLACE --metadata pax2-analyze-test=$(date -u +%Y%m%dT%H%M%SZ)
  echo "re-put s3://$BUCKET/$KEY at $(date -u +%FT%TZ); the Lambda should start a box within a minute"
  sleep 20
  aws logs filter-log-events --log-group-name /aws/lambda/$FN --start-time $(( T0 * 1000 )) --query 'events[].message' --output json | jq -r '.[]' | grep -E "$TEST_ID|REPORT" | tr '\t' ' ' | sed 's/^/  /' || true
  ID=$(aws ec2 describe-instances --filters Name=tag:Name,Values=pax2-analyze-$TEST_ID Name=instance-state-name,Values=pending,running --query 'Reservations[0].Instances[0].InstanceId' --output text)
  echo "box: $ID"
  echo "watch: ./scripts/rig/watch.sh $ID $(aws s3 ls s3://$BUCKET/logs/ | grep "analyze-$TEST_ID" | tail -1 | awk '{print "logs/"$4}')"
  exit 0
fi

ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text 2>/dev/null || true)
FN_ARN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text 2>/dev/null || true)
echo "role:     ${ROLE_ARN:-(would create $ROLE)}"
echo "function: ${FN_ARN:-(would create $FN)}"
echo "box:      c7i.large under the $BOX_ROLE profile, 30-minute watchdog, about 5 minutes a video, about \$0.01 at \$0.085/h, plus Pegasus 1.2 on Bedrock reading the video, about \$0.04"
echo "trigger:  s3://$BUCKET uploads/*.mp4, notification $NOTIFY_ID (pax2-transcode's webm trigger stays)"
[ $MODE = dry ] && { echo "dry run; --apply writes"; exit 0; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# The box's extra rights: the event in DynamoDB and the features file.
aws iam put-role-policy --role-name $BOX_ROLE --policy-name pax2-analyze --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":\"dynamodb:PutItem\",\"Resource\":\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE\"},
  {\"Effect\":\"Allow\",\"Action\":\"bedrock:InvokeModel\",\"Resource\":[\"arn:aws:bedrock:*::foundation-model/twelvelabs.pegasus-1-2-v1:0\",\"arn:aws:bedrock:$REGION:$ACCOUNT:inference-profile/us.twelvelabs.pegasus-1-2-v1:0\"]}]}"
echo "box role $BOX_ROLE: inline pax2-analyze (dynamodb PutItem $TABLE, bedrock InvokeModel Pegasus 1.2); S3 comes from its pax2-rig policy"

# The rig code the box pulls.
aws s3 cp --only-show-errors scripts/rig/analyze_common.py s3://$BUCKET/code/rig/analyze_common.py
aws s3 cp --only-show-errors scripts/rig/analyze_upload.py s3://$BUCKET/code/rig/analyze_upload.py
aws s3 cp --only-show-errors scripts/rig/requirements.txt s3://$BUCKET/code/rig/requirements.txt
echo "code: s3://$BUCKET/code/rig/ analyze_common.py analyze_upload.py requirements.txt"

# The execution role.
if [ -z "$ROLE_ARN" ]; then
  ROLE_ARN=$(aws iam create-role --role-name $ROLE --description "pax2-analyze Lambda: one box per uploaded mp4" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query Role.Arn --output text)
  echo "created role $ROLE_ARN"
fi
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name $ROLE --policy-name pax2-analyze --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/features/*\"},
  {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\",\"Condition\":{\"StringLike\":{\"s3:prefix\":\"features/*\"}}},
  {\"Effect\":\"Allow\",\"Action\":[\"ec2:RunInstances\",\"ec2:CreateTags\",\"ec2:DescribeVpcs\",\"ec2:DescribeSubnets\",\"ec2:DescribeSecurityGroups\",\"ec2:DescribeInstances\",\"ec2:DescribeImages\"],\"Resource\":\"*\"},
  {\"Effect\":\"Allow\",\"Action\":\"iam:PassRole\",\"Resource\":\"arn:aws:iam::$ACCOUNT:role/$BOX_ROLE\"},
  {\"Effect\":\"Allow\",\"Action\":\"ssm:GetParameter\",\"Resource\":\"arn:aws:ssm:$REGION::parameter/aws/service/canonical/*\"}]}"
echo "role policy: AWSLambdaBasicExecutionRole + inline pax2-analyze (s3 features/*, ec2 RunInstances and reads, PassRole $BOX_ROLE, ssm canonical AMI)"

# The function.
(cd lambda/analyze && zip -q "$STAGE/fn.zip" index.mjs)
ENV="Variables={PAX2_LEDGER_TABLE=$TABLE,PAX2_BOX_PROFILE=$BOX_ROLE}"
DESC="pax2 analyze: one self-terminating box per uploaded mp4, features and an analyzed event on the original"
if [ -z "$FN_ARN" ]; then
  for i in 1 2 3 4 5 6; do
    if FN_ARN=$(aws lambda create-function --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
      --zip-file fileb://$STAGE/fn.zip --memory-size 256 --timeout 60 --architectures x86_64 \
      --environment "$ENV" --description "$DESC" --query FunctionArn --output text 2>"$STAGE/err"); then break; fi
    grep -q -i -E 'role|assume' "$STAGE/err" && [ $i -lt 6 ] && { sleep 10; continue; }
    cat "$STAGE/err"; exit 1
  done
  echo "created function $FN_ARN"
  aws lambda wait function-active-v2 --function-name $FN
else
  aws lambda update-function-code --function-name $FN --zip-file fileb://$STAGE/fn.zip --query LastModified --output text >/dev/null
  aws lambda wait function-updated-v2 --function-name $FN
  aws lambda update-function-configuration --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
    --memory-size 256 --timeout 60 --environment "$ENV" --description "$DESC" --query LastModified --output text >/dev/null
  aws lambda wait function-updated-v2 --function-name $FN
  echo "updated function $FN_ARN"
fi
aws lambda get-function-configuration --function-name $FN --query '{runtime:Runtime,memory:MemorySize,timeout:Timeout,state:State}' --output json

if aws lambda remove-permission --function-name $FN --statement-id s3-uploads >/dev/null 2>&1; then :; fi
aws lambda add-permission --function-name $FN --statement-id s3-uploads --action lambda:InvokeFunction --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::$BUCKET --source-account $ACCOUNT --query Statement --output text >/dev/null
echo "permission: s3.amazonaws.com may invoke $FN from arn:aws:s3:::$BUCKET"

# The notification, merged beside the transcode one.
aws s3api get-bucket-notification-configuration --bucket $BUCKET --output json > "$STAGE/cur.json" || echo '{}' > "$STAGE/cur.json"
[ -s "$STAGE/cur.json" ] || echo '{}' > "$STAGE/cur.json"
jq --arg id $NOTIFY_ID --arg fn "$FN_ARN" 'del(.EventBridgeConfiguration | select(. == null)) |
  .LambdaFunctionConfigurations = ([(.LambdaFunctionConfigurations // [])[] | select(.Id != $id)] + [{
    Id: $id, LambdaFunctionArn: $fn, Events: ["s3:ObjectCreated:*"],
    Filter: { Key: { FilterRules: [{ Name: "prefix", Value: "uploads/" }, { Name: "suffix", Value: ".mp4" }] } } }])' "$STAGE/cur.json" > "$STAGE/new.json"
aws s3api put-bucket-notification-configuration --bucket $BUCKET --notification-configuration "file://$STAGE/new.json"
echo "notification on s3://$BUCKET:"
aws s3api get-bucket-notification-configuration --bucket $BUCKET --query 'LambdaFunctionConfigurations[].{id:Id,fn:LambdaFunctionArn,filter:Filter.Key.FilterRules}' --output json
