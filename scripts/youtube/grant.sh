#!/usr/bin/env bash
# The server-side rights the YouTube publish step needs (src/lib/youtube.ts): the Amplify compute role
# reads and writes the refresh token in SSM at /pax2/youtube/refresh-token. One inline policy on the
# role Amplify runs the app with. Dry run by default; --apply writes.
#   ./scripts/youtube/grant.sh [--apply]
# Then set PAX2_GOOGLE_CLIENT_ID and PAX2_GOOGLE_CLIENT_SECRET in the Amplify app's environment variables
# (and .env.local for the dev server) and redeploy; an admin opens /api/youtube/oauth once.
set -euo pipefail
REGION=us-east-1; ACCOUNT=638175140432; ROLE=pax-2-amplify-compute
DOC="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"ssm:GetParameter\",\"ssm:PutParameter\"],\"Resource\":\"arn:aws:ssm:$REGION:$ACCOUNT:parameter/pax2/youtube/*\"}]}"
echo "role: $ROLE"; echo "policy pax2-youtube: ssm GetParameter and PutParameter on /pax2/youtube/*"
[ "${1:-}" = --apply ] || { echo "dry run; --apply writes"; exit 0; }
aws iam put-role-policy --region $REGION --role-name $ROLE --policy-name pax2-youtube --policy-document "$DOC"
echo "written"
