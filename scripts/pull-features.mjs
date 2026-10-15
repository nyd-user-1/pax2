// Pull every features/<take>.json from S3 into data/generated/features.json —
// publish.py's "features" section done locally, without the worker's git push.
// Word-level confidences stay in S3; the app keeps {t, w} like publish.py does.
// Usage: node scripts/pull-features.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"

const B = "pax-2-638175140432"
const s3 = new S3Client({ region: "us-east-1" })

const keys = []
let ContinuationToken
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: B, Prefix: "features/", ContinuationToken }))
  for (const o of r.Contents ?? []) if (o.Key.endsWith(".json")) keys.push(o.Key)
  ContinuationToken = r.NextContinuationToken
} while (ContinuationToken)

const all = JSON.parse(readFileSync("data/generated/features.json", "utf8"))
let n = 0
for (const Key of keys) {
  const r = await s3.send(new GetObjectCommand({ Bucket: B, Key }))
  const f = JSON.parse(await r.Body.transformToString())
  if (f.transcript?.words) f.transcript.words = f.transcript.words.map((w) => ({ t: w.t, w: w.w }))
  // Shots and on-screen text came from a service the pipeline no longer runs; older files still carry them.
  delete f.shots
  delete f.onScreenText
  all[f.take] = f
  n++
}
writeFileSync("data/generated/features.json", JSON.stringify(all, null, 1))
console.log(`${n} feature files merged; ${Object.keys(all).length} takes total`)
