#!/usr/bin/env bash
# Connect PAX to Slack: check the PAX app's bot token, then store it in SSM for the app to read.
#
#   scripts/connect-slack.sh <xoxb-bot-token>
#
# The app comes from docs/slack-app-manifest.yml. The token is passed as an argument and written straight
# into SSM as a SecureString; it is never echoed or written to a file. The side panel picks it up within
# five minutes (src/lib/ssm-param.ts caches that long), with no deploy.
set -euo pipefail

TOKEN="${1:-}"
PARAM="/pax2/slack/bot-token"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$TOKEN" ]; then
  echo "usage: $0 <xoxb-bot-token>" >&2
  exit 64
fi

echo "Checking the token with Slack"
ME=$(curl -sS -H "Authorization: Bearer $TOKEN" https://slack.com/api/auth.test)
python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ok") else ("Slack rejected the token: " + str(d.get("error"))))' <<<"$ME"
python3 -c 'import json,sys; d=json.load(sys.stdin); print("  workspace:", d.get("team"), "· bot:", d.get("user"))' <<<"$ME"

echo "Writing $PARAM"
aws ssm put-parameter --region "$REGION" --name "$PARAM" --type SecureString --overwrite --value "$TOKEN" --query Version --output text >/dev/null

echo "Done. The PAX side panel's Slack row lists the workspace's channels within five minutes."
