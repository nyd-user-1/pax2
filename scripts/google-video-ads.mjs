// Google's political video ads for reform advertisers, joined to YouTube: each VIDEO creative in the
// GovBlock export of the Google Political Ads Transparency library, its creative page fetched and
// searched for the YouTube video id it plays, then the public counts of the resolved videos.
//
// Dry run by default: the census of VIDEO creatives by advertiser and five sample URLs. --apply fetches.
// Every raw page is cached under data/raw/google-creatives/<ad_id>.html (gitignored) and a rerun skips
// cached ids. Two requests a second, gradual backoff on 429 (its headers are not read as the limit),
// and --max-requests (default 3000) stops the run. After the first 100 creatives the yield is checked:
// under half resolved, the page is rendered client-side, what was found is written and the run stops.
//
// Usage: node scripts/google-video-ads.mjs [--apply] [--max-requests 3000]
// Reads  s3://pax-2-638175140432/athena/govblock/creatives/*.csv, YOUTUBE_API_KEY from .env.local
// Writes data/generated/google-video-ads.json
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const MAX = Number(args[args.indexOf("--max-requests") + 1]) || 3000
const CACHE = path.join(root, "data/raw/google-creatives")
const OUT = path.join(root, "data/generated/google-video-ads.json")
const BUCKET = "pax-2-638175140432"
const PREFIX = "athena/govblock/creatives/"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
const s3 = new S3Client({ region: "us-east-1" })

function parseCsv(text) {
  const rows = []
  let row = [], field = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ",") row.push(field), (field = "")
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field), rows.push(row), (row = []), (field = "")
    } else field += c
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [head, ...body] = rows.filter((r) => r.length > 1)
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))
}

const keys = ((await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX }))).Contents ?? []).map((o) => o.Key).filter((k) => k.endsWith(".csv"))
const all = []
for (const k of keys) all.push(...parseCsv(await (await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: k }))).Body.transformToString()))
const video = all.filter((r) => r.ad_type === "VIDEO")
const byAdv = {}
for (const r of video) byAdv[r.advertiser_name] = (byAdv[r.advertiser_name] ?? 0) + 1
console.log(`${keys.length} csv, ${all.length} creatives, ${video.length} VIDEO from ${Object.keys(byAdv).length} advertisers`)
for (const [a, n] of Object.entries(byAdv).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${a}`)
console.log("sample:")
for (const r of video.slice(0, 5)) console.log(`  ${r.ad_url}`)
if (!APPLY) {
  console.log("dry run; --apply fetches")
  process.exit(0)
}

const band = (s) => {
  const m = String(s).replace(/[,≥<>+]/g, "").match(/(\d+)\s*-\s*(\d+)|(\d+)/)
  return m ? (m[1] ? [Number(m[1]), Number(m[2])] : [Number(m[3]), null]) : [null, null]
}
const PATTERNS = [/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/, /"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/, /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/, /youtu\.be\/([A-Za-z0-9_-]{11})/, /ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//]
const findId = (html) => {
  for (const p of PATTERNS) {
    const m = html.match(p)
    if (m) return m[1]
  }
  return null
}

fs.mkdirSync(CACHE, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let requests = 0
let wait = 500
async function page(r) {
  const file = path.join(CACHE, `${r.ad_id}.html`)
  if (fs.existsSync(file)) return { html: fs.readFileSync(file, "utf8"), cached: true }
  if (requests >= MAX) return null
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(wait)
    requests++
    const res = await fetch(r.ad_url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } })
    if (res.status === 429) {
      wait = Math.min(wait * 1.5, 30_000)
      console.log(`429; pacing at ${Math.round(wait)} ms`)
      continue
    }
    const html = await res.text()
    fs.writeFileSync(file, html)
    wait = Math.max(500, wait * 0.9)
    return { html, cached: false, status: res.status }
  }
  return null
}

const found = []
let checked = 0
let stoppedAt = null
let clientRendered = false
for (const r of video) {
  const p = await page(r)
  if (!p) {
    stoppedAt = `--max-requests ${MAX} reached after ${checked} creatives`
    break
  }
  checked++
  const yt = findId(p.html)
  const [impressionsLow, impressionsHigh] = band(r.impressions)
  found.push({ adId: r.ad_id, adUrl: r.ad_url, advertiserId: r.advertiser_id, advertiser: r.advertiser_name, start: r.date_range_start, end: r.date_range_end, days: Number(r.num_of_days) || null, impressionsLow, impressionsHigh, spendLow: r.spend_range_min_usd === "" ? null : Number(r.spend_range_min_usd), spendHigh: r.spend_range_max_usd === "" ? null : Number(r.spend_range_max_usd), youtubeId: yt, pageBytes: p.html.length })
  if (checked % 25 === 0) console.log(`${checked} checked, ${found.filter((f) => f.youtubeId).length} resolved, ${requests} requests`)
  if (checked === 100) {
    const resolved = found.filter((f) => f.youtubeId).length
    console.log(`yield after 100: ${resolved}/100`)
    if (resolved < 50) {
      clientRendered = true
      break
    }
  }
}

const resolved = found.filter((f) => f.youtubeId)
if (!clientRendered && resolved.length) {
  const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^['"]|['"]$/g, "")]))
  const ids = [...new Set(resolved.map((f) => f.youtubeId))]
  const stats = {}
  for (let i = 0; i < ids.length; i += 50) {
    const u = `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(","), key: env.YOUTUBE_API_KEY })}`
    const j = await (await fetch(u)).json()
    if (j.error) throw new Error(`YouTube API: ${j.error.message}`)
    for (const v of j.items ?? []) stats[v.id] = v
  }
  const secs = (iso) => {
    const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : null
  }
  for (const f of resolved) {
    const v = stats[f.youtubeId]
    Object.assign(f, v ? { title: v.snippet.title, channelId: v.snippet.channelId, channel: v.snippet.channelTitle, published: v.snippet.publishedAt, durationSec: secs(v.contentDetails?.duration), views: Number(v.statistics.viewCount ?? 0), likes: v.statistics.likeCount == null ? null : Number(v.statistics.likeCount), comments: v.statistics.commentCount == null ? null : Number(v.statistics.commentCount) } : { public: false })
  }
}

const out = {
  builtAt: new Date().toISOString(),
  source: `s3://${BUCKET}/${PREFIX}`,
  videoCreatives: video.length,
  checked,
  resolved: resolved.length,
  requests,
  status: clientRendered ? "client-rendered: under half of the first 100 creative pages carry a YouTube id in their HTML; stopped" : stoppedAt ?? "complete",
  rows: clientRendered ? found : found.filter((f) => f.youtubeId),
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n")
console.log(`${out.status}; ${resolved.length}/${checked} resolved in ${requests} requests -> ${path.relative(root, OUT)}`)
