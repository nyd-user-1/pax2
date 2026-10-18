// Platform usage as a feature of the Model Training Library (requirement 12): every USAGE#<day> row in
// the DynamoDB table pax2-ledger (src/lib/usage.ts) counted per video, opens, plays, watched75, boosts,
// bookmarks, shares, queues, and distinct readers, keyed by the bare YouTube id so scripts/training-set.mjs
// can join it by row id. Rows about anything but a video (searches, filters, courses) are counted in the
// totals and left out of the per-video table. Writes data/generated/model/usage-features.json.
//   node scripts/usage-features.mjs      (read-only against DynamoDB, us-east-1)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }))
const VIDEO_KINDS = ["open", "play", "watched75", "boost", "bookmark", "share", "queue"]
const items = []
let start
do {
  const r = await db.send(new ScanCommand({ TableName: process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger", FilterExpression: "begins_with(pk, :p)", ExpressionAttributeValues: { ":p": "USAGE#" }, ExclusiveStartKey: start }))
  items.push(...(r.Items ?? []))
  start = r.LastEvaluatedKey
} while (start)

const byKind = {}
const byId = {}
const readers = new Map()
for (const e of items) {
  byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  if (!VIDEO_KINDS.includes(e.kind) || !e.subject) continue
  const id = String(e.subject).replace(/^yt-/, "")
  const v = (byId[id] ??= { opens: 0, plays: 0, watched75: 0, boosts: 0, bookmarks: 0, shares: 0, queues: 0, readers: 0, first: e.at, last: e.at })
  const field = { open: "opens", play: "plays", watched75: "watched75", boost: "boosts", bookmark: "bookmarks", share: "shares", queue: "queues" }[e.kind]
  v[field] += 1
  if (e.at < v.first) v.first = e.at
  if (e.at > v.last) v.last = e.at
  if (!readers.has(id)) readers.set(id, new Set())
  readers.get(id).add(e.who ?? "anonymous")
}
for (const [id, set] of readers) byId[id].readers = set.size
const out = {
  builtAt: new Date().toISOString(),
  rows: items.length,
  byKind,
  videos: Object.keys(byId).length,
  days: [...new Set(items.map((e) => e.pk.slice(6)))].sort(),
  fields: { "opens, plays, watched75, boosts, bookmarks, shares, queues": "counts of reader acts on the video, every reader, all time", readers: "distinct readers (signed-in email or the browser's anonymous id)", "first, last": "the first and last act" },
  byId,
}
const outPath = path.join(root, "data/generated/model/usage-features.json")
fs.writeFileSync(outPath, JSON.stringify(out, null, 1))
console.log(`${items.length} usage rows over ${out.days.length} days, ${out.videos} videos with reader acts -> ${path.relative(root, outPath)}; by kind ${JSON.stringify(byKind)}`)
