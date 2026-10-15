#!/bin/bash
# Create the Amplify app for Hermes with a signed curl call (no AWS CLI, no Python on the Mac).
# Keys come from ~/.aws/credentials and the GitHub token from `gh`; neither is printed.
set -e
AK=$(awk -F' *= *' '/^\[default\]/{d=1;next} /^\[/{d=0} d&&$1=="aws_access_key_id"{print $2}' ~/.aws/credentials)
SK=$(awk -F' *= *' '/^\[default\]/{d=1;next} /^\[/{d=0} d&&$1=="aws_secret_access_key"{print $2}' ~/.aws/credentials)
TOKEN=$(gh auth token)
BODY=$(jq -n --arg t "$TOKEN" '{
  name: "hermes",
  repository: "https://github.com/nyd-user-1/hermes",
  platform: "WEB_COMPUTE",
  accessToken: $t,
  computeRoleArn: "arn:aws:iam::638175140432:role/hermes-amplify-compute",
  enableBranchAutoBuild: false,
  tags: { project: "hermes" }
}')
curl -s --aws-sigv4 "aws:amz:us-east-1:amplify" --user "$AK:$SK" \
  -H "Content-Type: application/json" -X POST "https://amplify.us-east-1.amazonaws.com/apps" -d "$BODY" \
  | jq '{appId: .app.appId, domain: .app.defaultDomain, error: .message}'
