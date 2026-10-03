#!/bin/bash
# Pull every upload (up to 150 per channel) with public counts and length, from the
# YouTube Data API, for the reform channels PAX uses as stand-in content.
# curl + jq only; the key is read from livingston's env file and never printed.
set -e
cd "$(dirname "$0")/.."
K=$(grep -E '^YOUTUBE_API_KEY=' ../livingston/.env.local | cut -d= -f2- | tr -d '"')
OUT=data/raw/yt-videos.json
TMP=$(mktemp -d)
for ch in UC-rKSUWdEqPmP-UM7yV6Ssw UC9xCoccW97aJDixnjpx2Ctg UCdBScPgnvqQ2tnv-qLixvew UCdr9X0FtE_GnXk_JwWYUx3g UCb8R3tlbcYaE5J5-HUBf7mw UC3HvCnPvYMIwh15fJxrEcKA UCsyNiDbqkOX-5YMSCPOtu_Q; do
  pl="UU${ch:2}"
  tok=""
  for page in 1 2 3; do
    r=$(curl -s "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=$pl&key=$K${tok:+&pageToken=$tok}")
    ids=$(echo "$r" | jq -r '[.items[]?.contentDetails.videoId] | join(",")')
    [ -z "$ids" ] && break
    curl -s "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=$ids&key=$K" \
      | jq -c '.items[] | {id, channelId:.snippet.channelId, channel:.snippet.channelTitle, title:.snippet.title, description:(.snippet.description[0:600]), published:.snippet.publishedAt, tags:(.snippet.tags // []), duration:.contentDetails.duration, captions:.contentDetails.caption, views:(.statistics.viewCount|tonumber? // null), likes:(.statistics.likeCount|tonumber? // null), comments:(.statistics.commentCount|tonumber? // null)}' >> "$TMP/all.jsonl"
    tok=$(echo "$r" | jq -r '.nextPageToken // empty')
    [ -z "$tok" ] && break
  done
done
jq -s --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{fetchedAt:$at, source:"YouTube Data API v3", videos:.}' "$TMP/all.jsonl" > "$OUT"
jq -r '.videos | group_by(.channel)[] | "\(.[0].channel): \(length) videos"' "$OUT"
