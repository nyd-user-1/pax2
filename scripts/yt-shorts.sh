#!/bin/bash
# Shorts only, from each channel's shorts playlist (UUSH + channel id), the latest 50,
# with public counts. curl + jq; the key is read from livingston's env file and never printed.
set -e
cd "$(dirname "$0")/.."
K=$(grep -E '^YOUTUBE_API_KEY=' ../livingston/.env.local | cut -d= -f2- | tr -d '"')
TMP=$(mktemp -d)
for ch in UC-rKSUWdEqPmP-UM7yV6Ssw UCpSEnGNa8pO-llnwBDDa6Tg UCdr9X0FtE_GnXk_JwWYUx3g UC3HvCnPvYMIwh15fJxrEcKA UCb8R3tlbcYaE5J5-HUBf7mw; do
  ids=$(curl -s "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=UUSH${ch:2}&key=$K" | jq -r '[.items[]?.contentDetails.videoId] | join(",")')
  [ -z "$ids" ] && { echo "$ch: no shorts playlist"; continue; }
  curl -s "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=$ids&key=$K" \
    | jq -c '.items[] | {id, channelId:.snippet.channelId, channel:.snippet.channelTitle, title:.snippet.title, description:(.snippet.description[0:600]), published:.snippet.publishedAt, tags:(.snippet.tags // []), duration:.contentDetails.duration, views:(.statistics.viewCount|tonumber? // null), likes:(.statistics.likeCount|tonumber? // null), comments:(.statistics.commentCount|tonumber? // null)}' >> "$TMP/all.jsonl"
done
jq -s --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{fetchedAt:$at, source:"YouTube Data API v3, shorts playlists", videos:.}' "$TMP/all.jsonl" > data/raw/yt-shorts.json
jq -r '.videos | group_by(.channel)[] | "\(.[0].channel): \(length) shorts, \(map(.published[0:10]) | min) to \(map(.published[0:10]) | max)"' data/raw/yt-shorts.json
