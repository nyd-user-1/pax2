// Velocity features for the Model Training Library (requirement 4, tranche 7 of docs/SPEC.md): for
// every short the poller has readings for, views at 1, 6, 24 and 72 hours since publish, read off the
// running maximum of its readings, linear between them and anchored at (0h, 0), the way PAX2 Velocity
// Classifier reads them (src/lib/velocity-model.ts); plus the hour of the first reading, the last
// hour read and the number of readings. Reads every velocity/polls/<day>.jsonl in S3 and writes
// data/generated/model/velocity-features.json, which scripts/training-set.mjs joins by id.
// Usage: node scripts/velocity-features.mjs      (read-only against S3, us-east-1)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const BUCKET = process.env.VELOCITY_BUCKET ?? "pax-2-velocity-638175140432"
const s3 = new S3Client({ region: "us-east-1" })
const HOURS = [1, 6, 24, 72]

const keys = []
let token
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "velocity/polls/", ContinuationToken: token }))
  for (const o of r.Contents ?? []) if (o.Key.endsWith(".jsonl")) keys.push(o.Key)
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token)
keys.sort()

const by = new Map()
let lines = 0
for (const key of keys) {
  const text = await (await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))).Body.transformToString()
  for (const line of text.split("\n")) {
    if (!line) continue
    lines++
    const r = JSON.parse(line)
    if (typeof r.hour !== "number" || typeof r.views !== "number") continue
    const v = by.get(r.id) ?? { channelId: r.channelId, published: r.published, readings: [] }
    v.readings.push({ hour: r.hour, views: r.views })
    by.set(r.id, v)
  }
}

/** Linear in hours on the series anchored at (0h, 0), held flat past the last reading; null past the last reading. */
function at(h, v, t) {
  if (!h.length || t <= 0) return 0
  let ph = 0, pv = 0
  for (let i = 0; i < h.length; i++) {
    if (t <= h[i]) return h[i] === ph ? v[i] : pv + ((v[i] - pv) * (t - ph)) / (h[i] - ph)
    ph = h[i]; pv = v[i]
  }
  return null
}

const videos = {}
for (const [id, v] of by) {
  const rs = v.readings.sort((a, b) => a.hour - b.hour)
  const h = rs.map((r) => r.hour)
  let peak = 0
  const vmax = rs.map((r) => (peak = Math.max(peak, r.views)))
  const out = { channelId: v.channelId, published: v.published, firstHour: Math.round(h[0] * 100) / 100, lastHour: Math.round(h[h.length - 1] * 100) / 100, readings: rs.length }
  for (const t of HOURS) {
    // Past the last reading the value is unknown, except at 72 hours, where the poller stops at 72.0 and
    // a last reading at or after 71.5 is the 72-hour value, the rule PAX2 Velocity Classifier trained on.
    const x = at(h, vmax, t) ?? (t === 72 && h[h.length - 1] >= 71.5 ? vmax[vmax.length - 1] : null)
    out[`views${t}h`] = x == null ? null : Math.round(x)
  }
  videos[id] = out
}

const outPath = path.join(root, "data/generated/model/velocity-features.json")
const days = keys.map((k) => k.slice(-16, -6))
const result = {
  builtAt: new Date().toISOString(),
  source: `s3://${BUCKET}/velocity/polls/`,
  days: { count: days.length, first: days[0], last: days.at(-1) },
  readings: lines,
  videos: Object.keys(videos).length,
  with72h: Object.values(videos).filter((v) => v.views72h != null).length,
  fields: { "views1h, views6h, views24h, views72h": "views at that hour since publish, read off the running maximum of the readings, linear between them, anchored at 0 views at hour 0; null when the readings do not reach that hour", firstHour: "hour of the first reading", lastHour: "hour of the last reading", readings: "number of readings" },
  byId: videos,
}
fs.writeFileSync(outPath, JSON.stringify(result))
console.log(`${keys.length} days, ${lines} readings, ${result.videos} videos, ${result.with72h} with a 72-hour value -> ${path.relative(root, outPath)}`)
