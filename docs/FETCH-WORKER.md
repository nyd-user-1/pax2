# Fetch worker interface (Tier 2 acquisition)

Content analysis needs the video file. When a user connects a YouTube channel, every video on it enters a queue of fetch targets (`enqueueFetch` in `src/lib/channel-ingest.ts`). A worker on a residential IP drains the queue: YouTube refuses AWS addresses (0 of 24 from a t3.micro, measured 2026-10-19), so the consumer runs through residential IPs: Brendan's Mac, or the 20 Webshare static residential proxies bought 2026-10-19 (10 of 10 cleared YouTube from the Mac). Their credentials are the SSM SecureString `/pax2/webshare/proxies`, one `ip:port:user:pass:country` per line, US lines first; `scripts/catalog-media/fleet.sh` launches the catalog fleet on them. A fetch worker reads the same parameter rather than storing its own. This document is the contract for draining the queue below; that worker is not built.

Owners can skip the queue for their own videos by uploading files in onboarding (step 4b): YouTube Studio's per-video Download, or a Google Takeout export of the whole channel.

## The queue (DynamoDB `pax2-ledger`, us-east-1)

| pk | sk | item |
|---|---|---|
| `FETCH#target` | `<youtubeId>` | `{ youtubeId, channelId, requestedBy, at }`, written once per video (conditional put; a second request is refused, so the queue is deduplicated) |
| `FETCH#req#<youtubeId>` | `<email>` | every user who asked for the video |
| `FETCH#<youtubeId>` | `EVENT#<iso>` | the worker's results, append-only (below) |

Pending = a `FETCH#target` row whose video has no `features/<youtubeId>.json` in S3, no `uploads/yt/<youtubeId>.mp4`, and no `FETCH#<youtubeId>` event of kind `delivered` or `gone`. Order: oldest `at` first.

## The worker loop

1. `Query pk = FETCH#target` and drop the done ones by the rule above. Claim a target by writing `{ kind: "claimed", worker, at }` to `FETCH#<youtubeId>` / `EVENT#<iso>`; skip a target claimed in the last 30 minutes by another worker.
2. Download through the residential IP: one muxed mp4 with audio, at most 720p and 100 MB. yt-dlp: `-f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4` (needs ffmpeg). One proxy per worker process (`--proxy http://user:pass@ip:port`). Pace like `scripts/catalog-media/fetch-videos.sh`: about one video every 8 seconds per IP, `--sleep-requests 1`, back off on 429.
3. Upload to `s3://pax-2-638175140432/uploads/yt/<youtubeId>.mp4`. The `uploads/` prefix and `.mp4` suffix fire `lambda/analyze`, which starts one self-terminating c7i.large running `scripts/rig/analyze_upload.py` (about 4 minutes, about 1.5 cents) and writes `features/<youtubeId>.json`. That file is what the channel page (`src/lib/channel-report.ts`) and the Model Training Library join on.
4. Write the result event: `{ kind: "delivered", key, bytes, worker, at }`, or `{ kind: "failed", reason, worker, at }` (retried on a later pass, at most three failures), or `{ kind: "gone", reason, worker, at }` for private, removed or age-gated videos (never retried).

## Rights the worker needs

`ssm:GetParameter` (with decryption) on `/pax2/webshare/proxies`; `dynamodb:Query` and `dynamodb:PutItem` on `pax2-ledger`; `s3:PutObject` on `pax-2-638175140432/uploads/yt/*`; `s3:GetObject` (HEAD) on `features/*` and `uploads/yt/*`. One IAM user or role per fleet, nothing more.

## Already on hand

`catalog-media/<id>.mp4` (360p, video only) and `catalog-media/<id>.m4a` from the Mac downloader cover the research catalog, not users' channels. A worker may mux the pair with ffmpeg and deliver it as above instead of downloading again when both exist.
