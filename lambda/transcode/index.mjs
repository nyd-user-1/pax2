// pax2-transcode: the browser records webm; this Lambda turns each upload into an mp4 every player
// can show. Fired by S3 ObjectCreated under uploads/ with the .webm suffix (scripts/transcode/deploy.sh
// wires it). For uploads/<workspace>/<id>.webm it writes uploads/<workspace>/<id>.mp4 beside it and
// records a "transcoded" event on the original in DynamoDB. A key that already has its mp4 is skipped.
// ffmpeg comes from the pax2-ffmpeg layer at /opt/bin/ffmpeg (scripts/transcode/build-layer.sh).
// One JSON line per object, with ffmpeg's exit code.
import { spawn } from "node:child_process"
import fs from "node:fs"
import { pipeline } from "node:stream/promises"
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

const REGION = process.env.AWS_REGION ?? "us-east-1"
const TABLE = process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger"
const FFMPEG = process.env.FFMPEG ?? "/opt/bin/ffmpeg"
const s3 = new S3Client({ region: REGION })
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } })

// The ledger's write-once rule, as src/lib/ledger.ts putOnce has it: a key that exists is refused.
async function putOnce(item) {
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(pk)" }))
    return true
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") return false
    throw e
  }
}

// src/lib/originals.ts addEvent: pk ORIG#<id>, sk EVENT#<iso>, at, then the event's fields.
async function addEvent(id, ev) {
  const at = new Date().toISOString()
  await putOnce({ pk: `ORIG#${id}`, sk: `EVENT#${at}`, at, ...ev })
  return at
}

const exists = async (Bucket, Key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }))
    return true
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false
    throw e
  }
}

function ffmpeg(input, output) {
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", output]
  return new Promise((resolve) => {
    const p = spawn(FFMPEG, args)
    let err = ""
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)))
    p.on("error", (e) => resolve({ code: -1, err: String(e) }))
    p.on("close", (code) => resolve({ code, err }))
  })
}

async function one(Bucket, Key) {
  const out = Key.replace(/\.webm$/i, ".mp4")
  const id = Key.split("/").pop().replace(/\.webm$/i, "")
  const line = { bucket: Bucket, key: Key, out, id }
  if (!Key.startsWith("uploads/") || !/\.webm$/i.test(Key)) return { ...line, skipped: "not an upload webm" }
  if (await exists(Bucket, out)) return { ...line, skipped: "mp4 exists" }

  const src = `/tmp/${id}.webm`
  const dst = `/tmp/${id}.mp4`
  try {
    const got = await s3.send(new GetObjectCommand({ Bucket, Key }))
    await pipeline(got.Body, fs.createWriteStream(src))
    const t0 = Date.now()
    const r = await ffmpeg(src, dst)
    const seconds = Math.round((Date.now() - t0) / 100) / 10
    if (r.code !== 0) return { ...line, exit: r.code, seconds, error: r.err.trim() }
    const bytes = fs.statSync(dst).size
    await s3.send(new PutObjectCommand({ Bucket, Key: out, Body: fs.createReadStream(dst), ContentLength: bytes, ContentType: "video/mp4" }))
    await addEvent(id, { kind: "transcoded", by: "pax2-transcode", key: out, seconds, bytes })
    return { ...line, exit: 0, seconds, bytesIn: fs.statSync(src).size, bytes }
  } finally {
    for (const f of [src, dst]) fs.rmSync(f, { force: true })
  }
}

export async function handler(event) {
  const results = []
  for (const rec of event.Records ?? []) {
    const Bucket = rec.s3.bucket.name
    const Key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "))
    let r
    try {
      r = await one(Bucket, Key)
    } catch (e) {
      r = { bucket: Bucket, key: Key, exit: -1, error: String(e?.message ?? e) }
    }
    console.log(JSON.stringify(r))
    results.push(r)
  }
  const failed = results.filter((r) => r.exit != null && r.exit !== 0)
  // A failure throws so S3's async invoke retries it (twice) and the error shows in the metrics.
  if (failed.length) throw new Error(`transcode failed: ${failed.map((r) => r.key).join(", ")}`)
  return results
}
