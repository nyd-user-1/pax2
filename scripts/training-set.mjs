// The Model Training Library, first cut: one row per settled short in the lookback catalog with
// its pre-publish features (src/lib/video-features.ts), its outcome (views over the channel's
// settled median, and the tier that ratio earns), and, where a video has been through the
// pipeline, its measured content features and delivery coding. Deterministic from files in the
// repo; no network.
//
// Usage: node --experimental-strip-types scripts/training-set.mjs
// Reads  data/velocity/catalog.json, data/generated/features.json, data/generated/delivery.json,
//        data/generated/model/organic-codes.json
// Writes data/generated/model/training-set.jsonl and training-set.manifest.json
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { extract, familyOf, FEATURE_DEFS } from "../src/lib/video-features.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))

const catalog = read("data/velocity/catalog.json")
const features = read("data/generated/features.json")
const delivery = read("data/generated/delivery.json").videos
const codes = read("data/generated/model/organic-codes.json").scripts ?? {}

const rows = []
let skippedGroup = 0
for (const v of catalog.videos) {
  if (v.tier === "unsettled") continue
  const family = familyOf(v.group)
  if (!family) {
    skippedGroup++
    continue
  }
  const input = { title: v.title, description: v.description ?? "", tags: v.tags ?? [], durationSec: v.durationSec, published: v.published, group: v.group, channelMedian: v.channelMedian }
  const x = extract(input)
  const f = features[`yt-${v.id}`]
  const d = delivery[`yt-${v.id}`]
  const c = codes[`yt-${v.id}`]
  const row = {
    id: v.id,
    channelId: v.channelId,
    channel: v.channel,
    group: v.group,
    family,
    published: v.published,
    // Raw inputs, so a text model can read them later and the forecast can be re-derived.
    title: v.title,
    description: v.description ?? "",
    tags: v.tags ?? [],
    durationSec: v.durationSec,
    channelMedian: v.channelMedian,
    // Outcome.
    views: v.views,
    likes: v.likes ?? null,
    comments: v.comments ?? null,
    ratio: v.ratio,
    tier: v.tier,
    breakout: v.tier === "breakout" ? 1 : 0,
    // Pre-publish features.
    x,
    // Content features, for the 40 analyzed shorts; null elsewhere.
    content: f
      ? {
          wpm: f.transcript?.wpm ?? null,
          firstWordSec: f.transcript?.firstWordSec ?? null,
          words: f.transcript?.words?.length ?? null,
          pauses: f.audio?.pauses?.length ?? null,
          loudnessRangeDb: f.audio?.loudnessDb?.length > 1 ? Math.round((Math.max(...f.audio.loudnessDb) - Math.min(...f.audio.loudnessDb)) * 10) / 10 : null,
          pitchRangeHz: f.audio?.pitchRangeHz ?? null,
          captions: f.pegasus?.result?.characteristics?.captions ?? null,
          callToAction: f.pegasus?.result?.characteristics?.call_to_action ?? null,
          pace: f.pegasus?.result?.characteristics?.pace ?? null,
          visualVariety: f.pegasus?.result?.characteristics?.visual_variety ?? null,
          hook: f.pegasus?.result?.hook?.text ?? null,
          energy: d?.energy ?? null,
          vocalTone: d?.vocalTone ?? null,
          mode: d?.mode ?? null,
          frame: d?.frame ?? null,
          firstPerson: d?.firstPerson ?? null,
          questionLed: d?.questionLed ?? null,
          swayable: c?.codes ?? null,
        }
      : null,
  }
  rows.push(row)
}
// Paid video ads (scripts/google-video-ads.mjs), when that file exists: a catalog row whose id a
// creative resolved to gains its bands, and every resolved creative not in the catalog becomes a row of
// its own. Those rows carry no breakout label: PAX2 Classifier trains on settled catalog rows only,
// and the PAX2 Encoder corpus takes every row.
const adsPath = path.join(root, "data/generated/google-video-ads.json")
const ads = fs.existsSync(adsPath) ? read("data/generated/google-video-ads.json") : null
const paidAds = { file: !!ads, status: ads?.status ?? null, resolved: 0, joined: 0, added: 0 }
if (ads) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const a of ads.rows.filter((a) => a.youtubeId)) {
    paidAds.resolved++
    const paid = { impressionsLow: a.impressionsLow, impressionsHigh: a.impressionsHigh, spendLow: a.spendLow, spendHigh: a.spendHigh, days: a.days, advertiser: a.advertiser }
    const hit = byId.get(a.youtubeId)
    if (hit) {
      hit.paid = paid
      paidAds.joined++
      continue
    }
    if (a.views == null) continue
    const input = { title: a.title ?? "", description: "", tags: [], durationSec: a.durationSec ?? 0, published: a.published ?? a.start, group: "paid-ad", channelMedian: null }
    const row = { id: a.youtubeId, channelId: a.channelId ?? null, channel: a.channel ?? a.advertiser, group: "paid-ad", family: "Paid ads", published: input.published, title: input.title, description: "", tags: [], durationSec: input.durationSec, channelMedian: null, views: a.views, likes: a.likes ?? null, comments: a.comments ?? null, ratio: null, tier: "paid", breakout: null, x: extract(input), content: null, paid }
    byId.set(row.id, row)
    rows.push(row)
    paidAds.added++
  }
}
rows.sort((a, b) => a.published.localeCompare(b.published) || a.id.localeCompare(b.id))

const out = path.join(root, "data/generated/model")
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, "training-set.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n")

// Artifacts derived from these rows elsewhere (the rig's thumbnail embeddings in S3) are carried over from the last manifest.
const previous = fs.existsSync(path.join(out, "training-set.manifest.json")) ? JSON.parse(fs.readFileSync(path.join(out, "training-set.manifest.json"), "utf8")) : {}
const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {})
const manifest = {
  builtAt: new Date().toISOString(),
  source: { catalog: catalog.fetchedAt, catalogSource: catalog.source },
  rows: rows.length,
  labeled: rows.filter((r) => r.breakout != null).length,
  skipped: { unsettled: catalog.videos.filter((v) => v.tier === "unsettled").length, unmappedGroup: skippedGroup },
  channels: new Set(rows.map((r) => r.channelId)).size,
  positives: rows.filter((r) => r.breakout).length,
  baseRate: Math.round((rows.filter((r) => r.breakout).length / rows.filter((r) => r.breakout != null).length) * 1000) / 1000,
  byTier: by("tier"),
  byFamily: by("family"),
  withContent: rows.filter((r) => r.content).length,
  paidAds,
  published: { first: rows[0]?.published, last: rows.at(-1)?.published },
  label: "breakout = 1 when lifetime views are at least 3x the channel's median of settled shorts (7+ days old); killed at 0.5x or less; baseline between.",
  features: FEATURE_DEFS,
  ...(previous.artifacts && { artifacts: previous.artifacts }),
  fields: {
    "id, channelId, channel, group, family, published": "YouTube ids and the channel's group (lambda/velocity/channels.json) and family (video-features.ts)",
    "title, description, tags, durationSec, channelMedian": "the raw pre-publish inputs; description is the first 600 characters",
    "views, likes, comments, ratio, tier, breakout": "the outcome as of the catalog fetch",
    x: "pre-publish features from src/lib/video-features.ts",
    paid: "for rows a Google political video ad resolved to (scripts/google-video-ads.mjs): impression and spend bands, days, advertiser; rows with group paid-ad have no breakout label",
    content: "measured content features for analyzed shorts (Transcribe, ffmpeg, Pegasus, delivery coding, Swayable codes); null otherwise",
  },
}
fs.writeFileSync(path.join(out, "training-set.manifest.json"), JSON.stringify(manifest, null, 1) + "\n")
console.log(`${rows.length} rows, ${manifest.positives} breakouts (${(manifest.baseRate * 100).toFixed(1)}%), ${manifest.channels} channels, ${manifest.withContent} with content features; skipped ${manifest.skipped.unsettled} unsettled, ${skippedGroup} unmapped; paid ads ${JSON.stringify(paidAds)}`)
console.log(JSON.stringify(manifest.byFamily))
