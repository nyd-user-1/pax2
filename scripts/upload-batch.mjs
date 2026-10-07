// Upload the downloaded shorts to s3://pax-638175140432/videos/ as yt-<videoId>.mp4,
// plus the analyzer the box will run. Node + the repo's own SDK;
// never the AWS CLI. Skips objects that already exist.
// Usage: node scripts/upload-batch.mjs [batch-json]

import { createReadStream, readFileSync } from "node:fs"
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const B = "pax-638175140432"
const s3 = new S3Client({ region: "us-east-1" })
const batch = JSON.parse(readFileSync(process.argv[2] ?? "data/raw/yt-batch-2026-10-04.json", "utf8"))

const exists = async (Key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: B, Key }))
    return true
  } catch {
    return false
  }
}

let up = 0
let had = 0
for (const v of batch.videos) {
  const local = `downloads/${v.slug}/${String(v.rank).padStart(2, "0")}-${v.id}.mp4`
  const Key = `videos/yt-${v.id}.mp4`
  if (await exists(Key)) {
    had++
    continue
  }
  await s3.send(new PutObjectCommand({ Bucket: B, Key, Body: createReadStream(local), ContentType: "video/mp4" }))
  up++
  console.log("up", Key, `(${v.channel} #${v.rank})`)
}
await s3.send(new PutObjectCommand({ Bucket: B, Key: "code/analyze_organic.py", Body: readFileSync("worker/analyze_organic.py"), ContentType: "text/x-python" }))
console.log(`videos: ${up} uploaded, ${had} already there; analyzer staged at code/analyze_organic.py`)
console.log(batch.videos.map((v) => `yt-${v.id}`).join(" "))
