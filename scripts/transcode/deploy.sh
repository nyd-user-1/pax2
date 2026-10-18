#!/usr/bin/env bash
# Deploys lambda/transcode as pax2-transcode: Node 22, 2048 MB, 300 s, 2048 MB of /tmp, the pax2-ffmpeg
# layer, the execution role pax2-transcode (S3 read and write under uploads/ in the bucket, DynamoDB
# PutItem on pax2-ledger, CloudWatch Logs), and the bucket's S3 notification for uploads/ *.webm.
#
#   ./scripts/transcode/deploy.sh            # dry run: what exists, what it would make
#   ./scripts/transcode/deploy.sh --apply    # makes or updates every piece, prints each
#   ./scripts/transcode/deploy.sh --test     # one small webm through the deployed function, then cleans up
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
ACCOUNT=638175140432
BUCKET=pax-2-638175140432
TABLE=pax2-ledger
FN=pax2-transcode
ROLE=pax2-transcode
LAYER=pax2-ffmpeg
NOTIFY_ID=pax2-transcode-webm
MODE=dry; case "${1:-}" in --apply) MODE=apply ;; --test) MODE=test ;; "") ;; *) echo "usage: $0 [--apply|--test]"; exit 1 ;; esac
AWS_BIN=$(type -P aws)
# Not `command aws`: bash 3.2 lets set -e fire through `command` even inside an if.
aws() { "$AWS_BIN" --region $REGION "$@"; }

if [ $MODE = test ]; then
  # A 5-second CC0 clip (MDN's flower.webm, VP9 and Opus like a browser recording), cached on first use.
  CACHE=scripts/transcode/.cache/flower.webm
  [ -s $CACHE ] || { mkdir -p "$(dirname $CACHE)"; curl -sSfL -o $CACHE https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm; }
  ID=test-$(date -u +%Y%m%dT%H%M%SZ)
  IN=uploads/test/$ID.webm; OUT=uploads/test/$ID.mp4
  T0=$(date +%s)
  aws s3 cp --only-show-errors --content-type video/webm $CACHE s3://$BUCKET/$IN
  echo "uploaded s3://$BUCKET/$IN ($(wc -c < $CACHE | tr -d ' ') bytes)"
  for i in $(seq 1 60); do
    if aws s3api head-object --bucket $BUCKET --key $OUT >/dev/null 2>&1; then break; fi
    sleep 5
  done
  aws s3api head-object --bucket $BUCKET --key $OUT --query '{bytes:ContentLength,type:ContentType}' --output json || { echo "no mp4 after 300 s"; FAIL=1; }
  echo "upload to mp4: $(( $(date +%s) - T0 )) s"
  sleep 10
  echo "CloudWatch, /aws/lambda/$FN since the upload:"
  aws logs filter-log-events --log-group-name /aws/lambda/$FN --start-time $(( T0 * 1000 )) --query 'events[].message' --output json | jq -r '.[]' | grep -E "$ID|REPORT" | tr '\t' ' ' | sed 's/^/  /'
  echo "DynamoDB ORIG#$ID:"
  aws dynamodb query --table-name $TABLE --key-condition-expression 'pk = :p' --expression-attribute-values "{\":p\":{\"S\":\"ORIG#$ID\"}}" --query 'Items[].{sk:sk.S,kind:kind.S,key:key.S,seconds:seconds.N,bytes:bytes.N}' --output json
  aws s3 rm --only-show-errors s3://$BUCKET/$IN
  aws s3 rm --only-show-errors s3://$BUCKET/$OUT
  echo "deleted $IN and $OUT"
  exit ${FAIL:-0}
fi

# What exists.
LAYER_ARN=$(aws lambda list-layer-versions --layer-name $LAYER --query 'LayerVersions[0].LayerVersionArn' --output text 2>/dev/null || true)
[[ $LAYER_ARN == arn:* ]] || { echo "no $LAYER layer: run scripts/transcode/build-layer.sh --apply first"; exit 1; }
ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text 2>/dev/null || true)
FN_ARN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text 2>/dev/null || true)
echo "layer:    $LAYER_ARN"
echo "role:     ${ROLE_ARN:-(would create $ROLE)}"
echo "function: ${FN_ARN:-(would create $FN)}"
echo "trigger:  s3://$BUCKET uploads/*.webm, notification $NOTIFY_ID"
# Rule 6: a 60-second phone recording transcodes in roughly its own length at 2048 MB; at
# $0.0000333 per GB-second that is about $0.004 a video, plus requests.
echo "cost:     about \$0.0000667 per second of run at 2048 MB; the --test run measures it"
[ $MODE = dry ] && { echo "dry run; --apply writes"; exit 0; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# The execution role.
if [ -z "$ROLE_ARN" ]; then
  ROLE_ARN=$(aws iam create-role --role-name $ROLE --description "pax2-transcode Lambda: webm uploads to mp4" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query Role.Arn --output text)
  echo "created role $ROLE_ARN"
fi
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
# ListBucket on uploads/ so a missing mp4 reads as 404, not 403.
aws iam put-role-policy --role-name $ROLE --policy-name pax2-transcode --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/uploads/*\"},
  {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\",\"Condition\":{\"StringLike\":{\"s3:prefix\":\"uploads/*\"}}},
  {\"Effect\":\"Allow\",\"Action\":\"dynamodb:PutItem\",\"Resource\":\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE\"}]}"
echo "role policy: AWSLambdaBasicExecutionRole + inline pax2-transcode (s3 get/put uploads/*, list uploads/, dynamodb PutItem $TABLE)"

# The function.
(cd lambda/transcode && zip -q "$STAGE/fn.zip" index.mjs)
ENV="Variables={PAX2_LEDGER_TABLE=$TABLE}"
DESC="pax2 transcode: S3 uploads/*.webm to mp4 beside it, a transcoded event on the original"
if [ -z "$FN_ARN" ]; then
  for i in 1 2 3 4 5 6; do
    if FN_ARN=$(aws lambda create-function --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
      --zip-file fileb://$STAGE/fn.zip --memory-size 2048 --timeout 300 --ephemeral-storage Size=2048 --architectures x86_64 \
      --layers "$LAYER_ARN" --environment "$ENV" --description "$DESC" --query FunctionArn --output text 2>"$STAGE/err"); then break; fi
    grep -q -i -E 'role|assume' "$STAGE/err" && [ $i -lt 6 ] && { sleep 10; continue; }
    cat "$STAGE/err"; exit 1
  done
  echo "created function $FN_ARN"
  aws lambda wait function-active-v2 --function-name $FN
else
  aws lambda update-function-code --function-name $FN --zip-file fileb://$STAGE/fn.zip --query LastModified --output text >/dev/null
  aws lambda wait function-updated-v2 --function-name $FN
  aws lambda update-function-configuration --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
    --memory-size 2048 --timeout 300 --ephemeral-storage Size=2048 --layers "$LAYER_ARN" --environment "$ENV" --description "$DESC" --query LastModified --output text >/dev/null
  aws lambda wait function-updated-v2 --function-name $FN
  echo "updated function $FN_ARN"
fi
aws lambda get-function-configuration --function-name $FN --query '{runtime:Runtime,memory:MemorySize,timeout:Timeout,tmp:EphemeralStorage.Size,layers:Layers[].Arn,state:State}' --output json

# S3 may invoke it, from this bucket in this account only.
if aws lambda remove-permission --function-name $FN --statement-id s3-uploads >/dev/null 2>&1; then :; fi
aws lambda add-permission --function-name $FN --statement-id s3-uploads --action lambda:InvokeFunction --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::$BUCKET --source-account $ACCOUNT --query Statement --output text >/dev/null
echo "permission: s3.amazonaws.com may invoke $FN from arn:aws:s3:::$BUCKET"

# The notification, merged into whatever the bucket already has (the put replaces the whole set).
aws s3api get-bucket-notification-configuration --bucket $BUCKET --output json > "$STAGE/cur.json" || echo '{}' > "$STAGE/cur.json"
[ -s "$STAGE/cur.json" ] || echo '{}' > "$STAGE/cur.json"
jq --arg id $NOTIFY_ID --arg fn "$FN_ARN" 'del(.EventBridgeConfiguration | select(. == null)) |
  .LambdaFunctionConfigurations = ([(.LambdaFunctionConfigurations // [])[] | select(.Id != $id)] + [{
    Id: $id, LambdaFunctionArn: $fn, Events: ["s3:ObjectCreated:*"],
    Filter: { Key: { FilterRules: [{ Name: "prefix", Value: "uploads/" }, { Name: "suffix", Value: ".webm" }] } } }])' "$STAGE/cur.json" > "$STAGE/new.json"
aws s3api put-bucket-notification-configuration --bucket $BUCKET --notification-configuration "file://$STAGE/new.json"
echo "notification on s3://$BUCKET:"
aws s3api get-bucket-notification-configuration --bucket $BUCKET --query 'LambdaFunctionConfigurations[].{id:Id,fn:LambdaFunctionArn,events:Events,filter:Filter.Key.FilterRules}' --output json
