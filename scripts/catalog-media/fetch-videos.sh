#!/usr/bin/env bash
# Catalog media for the content model, from this Mac (YouTube answers a home connection and blocks
# AWS): per id, the 360p video stream and the m4a audio stream as separate files (no ffmpeg, no merge),
# uploaded to s3://pax-2-638175140432/catalog-media/ at once and deleted locally (13 GB free on this
# disk), the id appended to archive.txt so a rerun skips it. Paced like the caption run: a sleep per
# video, requests a second apart, and the 429 answer is yt-dlp's own backoff.
#
#   ./scripts/catalog-media/fetch-videos.sh data/raw/videos/targets.txt
#   SLEEP=8 ./scripts/catalog-media/fetch-videos.sh ...
set -uo pipefail
IDS=${1:?ids file}
SLEEP=${SLEEP:-8}
OUT=data/raw/videos
S3=s3://pax-2-638175140432/catalog-media
LOG=$OUT/run.log
mkdir -p "$OUT"
echo "start $(date -u +%FT%TZ) ids=$(wc -l < "$IDS" | tr -d ' ') sleep=${SLEEP}s" >> "$LOG"
n=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  grep -qx "$id" "$OUT/archive.txt" 2>/dev/null && continue
  yt-dlp -f "bv*[height<=360][ext=mp4],ba[ext=m4a]" --max-filesize 100M \
    --sleep-requests 1 --retries 5 --retry-sleep http:60 --no-warnings \
    -o "$OUT/%(id)s.%(ext)s" -- "$id" >> "$LOG" 2>&1
  got=0
  for f in "$OUT/$id".mp4 "$OUT/$id".m4a; do
    if [ -f "$f" ]; then
      aws s3 cp --only-show-errors "$f" "$S3/$(basename "$f")" --region us-east-1 >> "$LOG" 2>&1 && rm -f "$f" && got=$((got+1))
    fi
  done
  echo "$id" >> "$OUT/archive.txt"
  echo "$(date -u +%FT%TZ) $id files=$got" >> "$LOG"
  n=$((n+1))
  [ $((n % 50)) -eq 0 ] && echo "progress $(date -u +%FT%TZ) done=$n" >> "$LOG"
  sleep "$SLEEP"
done < "$IDS"
echo "end $(date -u +%FT%TZ) done=$n" >> "$LOG"
