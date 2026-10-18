#!/usr/bin/env bash
# The lead window touches this after every step it finishes; the hourly watchdog
# (scripts/lead/watchdog.sh) reads its age to decide whether the lead is awake.
touch "$HOME/.pax2-lead/heartbeat"
echo "$(date -u +%FT%TZ) ${1:-step}" >> "$HOME/.pax2-lead/steps.log"
