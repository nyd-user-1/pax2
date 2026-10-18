#!/usr/bin/env bash
# PAX2 Classifier v2's chain, started once and left running on the Mac (nohup, detached):
#   1. every 10 minutes, count the caption run's extracted videos (grep -c "Extracting URL" run.log); go on
#      when the count reaches the 3,465 priority shorts (reform, voting-rights and nonpartisan channels,
#      the first 3,465 lines of ids-priority.txt) or when the caption run has ended
#   2. node scripts/captions-merge.mjs, node scripts/training-set.mjs,
#      node scripts/classifier/transcript-features.mjs
#   3. upload the training set, its manifest, transcript-features.json and transcripts.json to
#      s3://pax-2-638175140432/model/v2/<run>/
#   4. scripts/classifier/launch.sh: one c7i.xlarge, once (a marker file stops a second launch)
#   5. poll the box's state every minute until it terminates (terminate it at 75 minutes if the
#      watchdog has not), pull var-model-v2.json, predictions-v2.jsonl and the box log, price the run
#   6. node scripts/classifier/rescore.mjs, the second scorer
# Every step and its exit code go to data/raw/captions/chain.log. Stops at the first failed step.
#
#   nohup ./scripts/classifier/when-captions-land.sh >/dev/null 2>&1 &
set -uo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-1
BUCKET=pax-2-638175140432
CAP=data/raw/captions
LOG=$CAP/chain.log
MARK=$CAP/chain.launched
TARGET=${TARGET:-3465}
INTERVAL=${INTERVAL:-600}
PRICE=0.1785
NODE="node --experimental-strip-types --no-warnings"

say() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
step() {
  say "run: $*"
  "$@" >> "$LOG" 2>&1
  local rc=$?
  say "EXIT=$rc $*"
  [ $rc -eq 0 ] || { say "chain stopped at: $*"; exit $rc; }
}

say "chain start pid $$, target $TARGET extracted, checking every ${INTERVAL}s"
[ -e "$MARK" ] && { say "chain stopped: $MARK exists, a v2 box was already launched ($(cat "$MARK"))"; exit 1; }

# 1. Wait for the priority families.
while true; do
  n=$(grep -c "Extracting URL" "$CAP/run.log")
  if [ "$n" -ge "$TARGET" ]; then say "reached: $n extracted"; sleep 90; break; fi
  if ! pgrep -f "yt-captions.sh" >/dev/null; then say "caption run ended at $n extracted"; break; fi
  say "waiting: $n of $TARGET extracted, $(ls $CAP/*.en.json3 2>/dev/null | wc -l | tr -d ' ') caption files"
  sleep "$INTERVAL"
done

# 2. Merge, rebuild the Model Training Library, compute the transcript features.
step node scripts/captions-merge.mjs
step $NODE scripts/training-set.mjs
step $NODE scripts/classifier/transcript-features.mjs

# 3. Inputs to S3.
RUN=model/v2/$(date -u +%Y%m%dT%H%M%SZ)/
for f in data/generated/model/training-set.jsonl data/generated/model/training-set.manifest.json data/generated/model/transcript-features.json data/generated/transcripts.json; do
  step aws s3 cp --only-show-errors "$f" "s3://$BUCKET/$RUN$(basename "$f")" --region $REGION
done
say "inputs: s3://$BUCKET/$RUN"

# 4. The box, once.
echo "$RUN $(date -u +%FT%TZ)" > "$MARK"
OUT=$(RUN=$RUN ./scripts/classifier/launch.sh 2>&1); rc=$?
echo "$OUT" >> "$LOG"
say "EXIT=$rc launch.sh"
[ $rc -eq 0 ] || { say "chain stopped at: launch.sh"; exit $rc; }
ID=$(sed -n 's/^instance: //p' <<<"$OUT")
echo "$RUN $ID $(date -u +%FT%TZ)" > "$MARK"
say "box $ID launched"

# 5. Completion is an event (rule 13): state every minute until terminated.
T0=$(date +%s)
last=""
while true; do
  st=$(aws ec2 describe-instances --region $REGION --instance-ids "$ID" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo unknown)
  [ "$st" != "$last" ] && { say "box $ID state $st"; last=$st; }
  [ "$st" = terminated ] && break
  if [ $(( $(date +%s) - T0 )) -gt 4500 ] && [ "$st" != shutting-down ]; then
    say "box $ID still $st at 75 minutes: terminating it"
    aws ec2 terminate-instances --region $REGION --instance-ids "$ID" >> "$LOG" 2>&1
  fi
  sleep 60
done
aws ec2 describe-instances --region $REGION --instance-ids "$ID" --query 'Reservations[0].Instances[0].[LaunchTime,StateTransitionReason]' --output text >> "$LOG" 2>&1
MIN=$(( ($(date +%s) - T0) / 60 ))
say "box $ID ran about $MIN minutes (launch to terminated, polled), about \$$(awk -v m=$MIN -v p=$PRICE 'BEGIN { printf "%.3f", m / 60 * p }') at \$$PRICE/h"
for f in var-model-v2.json predictions-v2.jsonl; do
  step aws s3 cp --only-show-errors "s3://$BUCKET/$RUN$f" "data/generated/model/$f" --region $REGION
done
aws s3 cp --only-show-errors "s3://$BUCKET/${RUN}box.log" "$CAP/v2-box.log" --region $REGION >> "$LOG" 2>&1
grep -E "^(=====|EXIT=|.*train_v2:|.*EXIT=)" "$CAP/v2-box.log" >> "$LOG" 2>/dev/null

# 6. The second scorer.
step node scripts/classifier/rescore.mjs
say "chain done"
