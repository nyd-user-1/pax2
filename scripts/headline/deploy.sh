#!/usr/bin/env bash
# Deploys lambda/headline as pax2-headline: Node 22, 3008 MB, 60 s, 2048 MB of /tmp, the pax2-onnxruntime
# layer (onnxruntime-node pruned to its Linux x64 binary, built on this Mac from the registry, no box),
# the execution role pax2-headline (S3 read under pax2/headline/ in nsr-embed-v2, CloudWatch Logs).
# Then a parity test: the eight held-out headlines train.py scored on the box (checks-v1.json) scored
# again by the function, which must agree to four decimals (rig rule 25).
#
#   ./scripts/headline/deploy.sh            # dry run
#   ./scripts/headline/deploy.sh --apply    # layer, role, function, parity test
#   ./scripts/headline/deploy.sh --test     # the parity test alone
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
ACCOUNT=638175140432
BUCKET=nsr-embed-v2
RUN=${RUN:-20261018-060508-train}
FN=pax2-headline
ROLE=pax2-headline
LAYER=pax2-onnxruntime
ORT_VERSION=1.30.0
MODE=dry; case "${1:-}" in --apply) MODE=apply ;; --test) MODE=test ;; "") ;; *) echo "usage: $0 [--apply|--test]"; exit 1 ;; esac
AWS_BIN=$(type -P aws)
aws() { "$AWS_BIN" --region $REGION "$@"; }

parity() {
  local checks=data/generated/model/headline-v1-checks.json
  local texts; texts=$(node -e 'console.log(JSON.stringify({texts: require("./'"$checks"'").map(c => c.text)}))')
  local out; out=$(mktemp)
  aws lambda invoke --function-name $FN --cli-binary-format raw-in-base64-out --payload "$texts" "$out" --query '[StatusCode,FunctionError]' --output text
  node -e '
    const want = require("./'"$checks"'"); const got = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    if (!got.scores) { console.log("no scores:", JSON.stringify(got).slice(0, 300)); process.exit(1) }
    // The box scored its checks under bf16 autocast; the ONNX graph runs in fp32, so scores agree to about
    // 0.02 (measured 0.015 on 2026-10-18), and the order of the eight must match exactly.
    let worst = 0
    want.forEach((c, i) => { const d = Math.abs(c.score - got.scores[i]); worst = Math.max(worst, d); console.log(`  ${got.scores[i].toFixed(4)} vs ${c.score.toFixed(4)}  ${d < 0.02 ? "ok " : "BAD"}  ${c.text.slice(0, 70)}`) })
    const rank = (xs) => xs.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]).map((p) => p[1]).join(",")
    const sameOrder = rank(want.map((c) => c.score)) === rank(got.scores)
    console.log(`parity: worst gap ${worst.toFixed(5)} over ${want.length} held-out headlines (bf16 on the box, fp32 here), order ${sameOrder ? "identical" : "DIFFERS"}: ${worst < 0.02 && sameOrder ? "AGREE" : "DISAGREE"}`)
    process.exit(worst < 0.02 && sameOrder ? 0 : 1)' "$out"
}
if [ $MODE = test ]; then parity; exit $?; fi

LAYER_ARN=$(aws lambda list-layer-versions --layer-name $LAYER --query 'LayerVersions[0].LayerVersionArn' --output text 2>/dev/null || true)
[[ $LAYER_ARN == arn:* ]] || LAYER_ARN=""
ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text 2>/dev/null || true)
FN_ARN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text 2>/dev/null || true)
echo "layer:    ${LAYER_ARN:-(would build $LAYER from onnxruntime-node $ORT_VERSION, Linux x64 only)}"
echo "role:     ${ROLE_ARN:-(would create $ROLE)}"
echo "function: ${FN_ARN:-(would create $FN)}"
echo "model:    s3://$BUCKET/pax2/headline/models/$RUN/model-v1.onnx, 436 MB, read into /tmp on a cold start"
echo "cost:     idle nothing; a call about 1 to 3 s at 3008 MB, about \$0.0001; the cold start about 15 s"
[ $MODE = dry ] && { echo "dry run; --apply writes"; exit 0; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

if [ -z "$LAYER_ARN" ]; then
  mkdir -p "$STAGE/layer/nodejs"
  (cd "$STAGE/layer/nodejs" && npm install --silent --no-package-lock --no-audit --no-fund "onnxruntime-node@$ORT_VERSION" >/dev/null)
  BIN="$STAGE/layer/nodejs/node_modules/onnxruntime-node/bin/napi-v6"
  ls "$BIN"
  find "$BIN" -mindepth 1 -maxdepth 1 ! -name linux -exec rm -rf {} +
  find "$BIN/linux" -mindepth 1 -maxdepth 1 ! -name x64 -exec rm -rf {} +
  echo "layer unpacked: $(du -sh "$STAGE/layer" | cut -f1)"
  (cd "$STAGE/layer" && zip -q -r "$STAGE/layer.zip" nodejs)
  echo "layer zip: $(du -sh "$STAGE/layer.zip" | cut -f1)"
  aws s3 cp --only-show-errors "$STAGE/layer.zip" s3://$BUCKET/pax2/headline/layers/onnxruntime-$ORT_VERSION.zip
  LAYER_ARN=$(aws lambda publish-layer-version --layer-name $LAYER --description "onnxruntime-node $ORT_VERSION, Linux x64" \
    --content S3Bucket=$BUCKET,S3Key=pax2/headline/layers/onnxruntime-$ORT_VERSION.zip --compatible-runtimes nodejs22.x --compatible-architectures x86_64 \
    --query LayerVersionArn --output text)
  echo "published layer $LAYER_ARN"
fi

if [ -z "$ROLE_ARN" ]; then
  ROLE_ARN=$(aws iam create-role --role-name $ROLE --description "pax2-headline Lambda: PAX2 Headline Ranker v1 at request time" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query Role.Arn --output text)
  echo "created role $ROLE_ARN"
fi
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name $ROLE --policy-name pax2-headline --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/pax2/headline/*\"}]}"
echo "role policy: AWSLambdaBasicExecutionRole + inline pax2-headline (s3 get pax2/headline/*)"

(cd lambda/headline && zip -q "$STAGE/fn.zip" index.mjs)
ENV="Variables={HEADLINE_BUCKET=$BUCKET,HEADLINE_RUN=$RUN}"
DESC="pax2 headline: PAX2 Headline Ranker v1 (bert-base-uncased, ONNX) scoring headlines"
if [ -z "$FN_ARN" ]; then
  for i in 1 2 3 4 5 6; do
    if FN_ARN=$(aws lambda create-function --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
      --zip-file fileb://$STAGE/fn.zip --memory-size 3008 --timeout 60 --ephemeral-storage Size=2048 --architectures x86_64 \
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
    --memory-size 3008 --timeout 60 --ephemeral-storage Size=2048 --layers "$LAYER_ARN" --environment "$ENV" --description "$DESC" --query LastModified --output text >/dev/null
  aws lambda wait function-updated-v2 --function-name $FN
  echo "updated function $FN_ARN"
fi
aws lambda get-function-configuration --function-name $FN --query '{runtime:Runtime,memory:MemorySize,timeout:Timeout,tmp:EphemeralStorage.Size,state:State}' --output json
echo "parity test:"
parity
