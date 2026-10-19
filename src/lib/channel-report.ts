import "server-only"

import { channelData, type CurveRow, type StatRow, type VideoRow } from "@/lib/channel-ingest"
import { forecast } from "@/lib/forecast"
import { now, putOnce, query, type Item } from "@/lib/ledger"

// A connected channel's analysis, per video, in tiers:
//
//   performance  always, from the connect: the YouTube Analytics totals and the retention curve.
//   forecast     PAX2 Classifier v1 (src/lib/forecast.ts, metadata only), Shorts only, since it was trained
//                on Shorts; anchored to the median lifetime views of the channel's own settled Shorts
//                (7+ days old). With fewer than five settled Shorts there is no median, so no anchor and no
//                number: the model's channel-size input would be read as zero and the chance would mean
//                nothing.
//   content      when the video file has been analyzed (lambda/analyze writes features/<id>.json): the
//                owner uploaded it during onboarding and linked it, or the fetch worker acquired it.

const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const REGION = process.env.PAX2_REGION ?? "us-east-1"
export const SHORT_MAX_SEC = 180
const SETTLED_DAYS = 7
const MIN_SETTLED = 5

export type Upload = Item & { uploadId: string; key: string; name: string; youtubeId: string | null; channelId: string | null; at: string; by: string }

/** A user's uploaded files, the latest link of each. */
export async function uploadsOf(email: string): Promise<Upload[]> {
  const rows = await query<Upload>(`OWNER#${email}`, "UPLOAD#")
  const m = new Map<string, Upload>()
  for (const r of rows) if (!m.has(r.uploadId) || m.get(r.uploadId)!.at < r.at) m.set(r.uploadId, r)
  return [...m.values()].sort((a, b) => b.at.localeCompare(a.at))
}

export async function recordUpload(email: string, u: { uploadId: string; key: string; name: string; youtubeId: string | null; channelId: string | null }) {
  const at = now()
  await putOnce({ pk: `OWNER#${email}`, sk: `UPLOAD#${u.uploadId}#${at}`, ...u, at, by: email })
}

async function analyzed(ids: string[]): Promise<Set<string>> {
  const { S3Client, HeadObjectCommand } = await import("@aws-sdk/client-s3")
  const s3 = new S3Client({ region: REGION })
  const found = new Set<string>()
  let i = 0
  await Promise.all(Array.from({ length: Math.min(16, ids.length) }, async () => {
    while (i < ids.length) {
      const id = ids[i++]
      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `features/${id}.json` }))
        found.add(id)
      } catch {}
    }
  }))
  return found
}

export type VideoReport = {
  video: VideoRow
  stat: StatRow | null
  curve: CurveRow | null
  short: boolean
  settled: boolean
  /** Lifetime views over the channel's median, for settled Shorts with a median. */
  ratio: number | null
  forecast: { p: number; expected: number | null; top: { label: string; pull: number }[] } | null
  /** Why there is no forecast, when there is none. */
  noForecast: string | null
  /** The analyzed file's id under features/, when content analysis exists. */
  content: string | null
  upload: Upload | null
}

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function channelReport(channelId: string, owner: string) {
  const data = await channelData(channelId)
  if (!data) return null
  const settledCut = Date.now() - SETTLED_DAYS * 86400_000
  const shorts = data.videos.filter((v) => v.video.durationSec > 0 && v.video.durationSec <= SHORT_MAX_SEC)
  const settledViews = shorts.filter((v) => Date.parse(v.video.published) < settledCut && v.video.views != null).map((v) => v.video.views!)
  const channelMedian = settledViews.length >= MIN_SETTLED ? median(settledViews) : null
  const uploads = (await uploadsOf(owner)).filter((u) => u.youtubeId && (!u.channelId || u.channelId === channelId))
  const byYt = new Map(uploads.map((u) => [u.youtubeId!, u]))
  const has = await analyzed([...data.videos.map((v) => v.video.youtubeId), ...uploads.map((u) => u.uploadId)])
  const videos: VideoReport[] = data.videos.map(({ video, stat, curve }) => {
    const short = video.durationSec > 0 && video.durationSec <= SHORT_MAX_SEC
    const settled = Date.parse(video.published) < settledCut
    const upload = byYt.get(video.youtubeId) ?? null
    let f: VideoReport["forecast"] = null
    let noForecast: string | null = null
    if (!short) noForecast = "PAX2 Classifier reads Shorts only."
    else if (channelMedian == null) noForecast = `PAX2 Classifier needs ${MIN_SETTLED} Shorts on the channel at least ${SETTLED_DAYS} days old to anchor a forecast; it has ${settledViews.length}.`
    else {
      const r = forecast({ title: video.title, description: video.description, tags: video.tags, durationSec: video.durationSec, published: video.published, group: "", channelMedian })
      f = { p: r.p, expected: r.expected?.views ?? null, top: r.contributions.slice(0, 3).map((c) => ({ label: c.label, pull: c.pull })) }
    }
    return {
      video, stat, curve, short, settled,
      ratio: short && settled && channelMedian && video.views != null ? video.views / channelMedian : null,
      forecast: f, noForecast,
      content: has.has(video.youtubeId) ? video.youtubeId : upload && has.has(upload.uploadId) ? upload.uploadId : null,
      upload,
    }
  })
  videos.sort((a, b) => b.video.published.localeCompare(a.video.published))
  return { channel: data.channel, runAt: data.runAt, impressions: data.impressions, hidden: data.hidden, channelMedian, settledShorts: settledViews.length, minSettled: MIN_SETTLED, videos }
}

export type ChannelReport = NonNullable<Awaited<ReturnType<typeof channelReport>>>
