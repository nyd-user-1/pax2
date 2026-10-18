#!/usr/bin/env bash
# YouTube's auto-captions for a list of video ids, no video: yt-dlp from this machine (YouTube answers a
# home connection and blocks AWS), network only. One json3 file per video under data/raw/captions/,
# a download archive so a rerun skips what it has (--force-write-archive, since --skip-download alone
# never writes it: the 2026-10-18 run wrote no done.txt), and slow pacing because YouTube answers bursts of
# subtitle requests with HTTP 429 (measured 2026-10-17: the third request a second apart was refused).
#
#   ./scripts/yt-captions.sh <ids file>            # one YouTube id per line
#   LOG=... SLEEP=8 REQ_SLEEP=2 ./scripts/yt-captions.sh ids.txt
# The stream manifests (hls, dash) are skipped: nothing here needs formats, and each skipped request saves
# its own sleep (2026-10-18).
# Then: node scripts/captions-merge.mjs  (data/raw/captions/*.en.json3 -> data/generated/transcripts.json)
set -uo pipefail
IDS=${1:?ids file}
SLEEP=${SLEEP:-8}
OUT=data/raw/captions
LOG=${LOG:-$OUT/run.log}
mkdir -p "$OUT"
echo "start $(date -u +%FT%TZ) ids=$(wc -l < "$IDS" | tr -d ' ') sleep=${SLEEP}s" >> "$LOG"
yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format json3 \
  --sleep-subtitles "$SLEEP" --sleep-requests "${REQ_SLEEP:-2}" --extractor-args "youtube:skip=hls,dash" --retries 10 --retry-sleep http:60 \
  --download-archive "$OUT/done.txt" --force-write-archive --no-warnings --ignore-errors \
  -o "$OUT/%(id)s" -a "$IDS" >> "$LOG" 2>&1
echo "end $(date -u +%FT%TZ) files=$(ls "$OUT"/*.en.json3 2>/dev/null | wc -l | tr -d ' ')" >> "$LOG"
