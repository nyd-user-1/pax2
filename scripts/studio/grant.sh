#!/usr/bin/env bash
# The server-side rights the Studio's voice and music need (src/app/studio-actions.ts): the Amplify
# compute role synthesizes speech with Polly and reads and writes under studio/ in the bucket. One
# inline policy on the role Amplify runs the app with. Dry run by default; --apply writes.
#   ./scripts/studio/grant.sh [--apply]
set -euo pipefail
REGION=us-east-1; ROLE=pax-2-amplify-compute; BUCKET=pax-2-638175140432
DOC="{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":\"polly:SynthesizeSpeech\",\"Resource\":\"*\"},
  {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/studio/*\"}]}"
echo "role: $ROLE"; echo "policy pax2-studio: polly SynthesizeSpeech; s3 get and put under studio/*"
[ "${1:-}" = --apply ] || { echo "dry run; --apply writes"; exit 0; }
aws iam put-role-policy --region $REGION --role-name $ROLE --policy-name pax2-studio --policy-document "$DOC"
echo "written"
