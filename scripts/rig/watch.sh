#!/usr/bin/env bash
# Polls a rig box's state every 60 seconds and prints each change with the log's latest job line;
# when the box terminates it prints the launch and termination times, the run time and its cost at the
# type's on-demand price, and pulls the log (rule 13).
#   usage: ./scripts/rig/watch.sh <instance-id> <log key> [local log path]
set -uo pipefail
REGION=us-east-1
BUCKET=pax-2-638175140432
ID=${1:?instance id}
KEY=${2:?log key}
LOCAL=${3:-/tmp/$(basename "$KEY")}
last=""
lastjob=""
while true; do
  st=$(aws ec2 describe-instances --region $REGION --instance-ids "$ID" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo unknown)
  if [ "$st" != "$last" ]; then echo "$(date -u +%H:%M:%SZ) state $st"; last=$st; fi
  if aws s3 cp --only-show-errors "s3://$BUCKET/$KEY" "$LOCAL" --region $REGION 2>/dev/null; then
    job=$(grep -E '^(=====|EXIT=|rig done|installed|resmem install FAILED)' "$LOCAL" | tail -1)
    if [ -n "$job" ] && [ "$job" != "$lastjob" ]; then echo "$(date -u +%H:%M:%SZ) log: $job"; lastjob=$job; fi
  fi
  if [ "$st" = terminated ]; then break; fi
  sleep 60
done
aws ec2 describe-instances --region $REGION --instance-ids "$ID" --query 'Reservations[0].Instances[0].[InstanceType,LaunchTime,StateTransitionReason]' --output text
echo "log pulled to $LOCAL"
