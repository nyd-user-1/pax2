#!/usr/bin/env bash
# The non-Claude hourly check Brendan asked for on 2026-10-18: launchd runs this every hour,
# whether or not any Claude session is alive. If the lead session has been quiet for more than
# STALE_MIN minutes (no heartbeat, no transcript write) and no watchdog-spawned lead is still
# running, it resumes the lead headlessly with `claude -p --resume`, which forks the session with
# its full context, and stores the fork's id as the next thing to resume. A usage-limit pause
# therefore costs at most an hour: the next tick retries, and the one after the reset succeeds.
# Log: ~/.pax2-lead/watchdog.log. State: ~/.pax2-lead/{session-id,heartbeat,child.pid}.
set -uo pipefail
export PATH="/Users/brendanstanton/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
D="$HOME/.pax2-lead"; REPO="/Users/brendanstanton/Code/pax2"; STALE_MIN=${STALE_MIN:-70}
LOG="$D/watchdog.log"; mkdir -p "$D"
now=$(date +%s); say() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
age_min() { local f=$1; [ -f "$f" ] || { echo 99999; return; }; echo $(( (now - $(stat -f %m "$f")) / 60 )); }
sid=$(cat "$D/session-id" 2>/dev/null | tr -d '[:space:]')
hb=$(age_min "$D/heartbeat")
tr_age=$(age_min "$HOME/.claude/projects/-Users-brendanstanton-Code-pax2/$sid.jsonl")
if [ -f "$D/child.pid" ] && kill -0 "$(cat "$D/child.pid")" 2>/dev/null; then
  say "awake: watchdog-spawned lead pid $(cat "$D/child.pid") still running (heartbeat ${hb}m, transcript ${tr_age}m)"; exit 0
fi
if [ "$hb" -lt "$STALE_MIN" ] || [ "$tr_age" -lt "$STALE_MIN" ]; then
  say "awake: heartbeat ${hb}m, transcript ${tr_age}m"; exit 0
fi
say "quiet for ${hb}m (transcript ${tr_age}m): resuming session $sid headlessly"
PROMPT="You are the PAX2 lead window, resumed by the hourly watchdog (scripts/lead/watchdog.sh) because the session went quiet for over an hour, most likely a usage-limit pause. Read /Users/brendanstanton/Code/pax2/docs/LEAD-LOOP.md and continue the loop from where git log and ~/.pax2-lead/steps.log show you stopped. Run scripts/lead/heartbeat.sh after every step. Do not restart work another window has committed. Stop only when the loop says to stop."
cd "$REPO" || exit 1
out="$D/resume-$(date -u +%Y%m%dT%H%M%SZ).json"
nohup claude -p --resume "$sid" --dangerously-skip-permissions --output-format json "$PROMPT" > "$out" 2>> "$LOG" &
echo $! > "$D/child.pid"
say "spawned pid $! -> $out"
# When it finishes, keep its session id as the next resume target (runs in the background).
( wait $! 2>/dev/null; new=$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(j.session_id||"")}catch{console.log("")}' "$out"); [ -n "$new" ] && echo "$new" > "$D/session-id" && echo "$(date -u +%FT%TZ) fork finished; next resume target $new" >> "$LOG" ) &
