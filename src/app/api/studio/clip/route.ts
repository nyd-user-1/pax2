import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

// Generated b-roll from the app's own origin: clips the video-gen actions copied under
// studio/clip/, streamed from S3 like the studio's audio, because the browser's renderer reads
// the bytes and the provider URLs are hotlink-protected with no CORS. Nothing under studio/ is private.
const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!/^studio\/clip\/[\w.-]+\.mp4$/.test(key)) return new Response("Not found", { status: 404 })
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = r.Body?.transformToWebStream()
    if (!body) return new Response("Not found", { status: 404 })
    return new Response(body, {
      headers: {
        "content-type": r.ContentType ?? "video/mp4",
        ...(r.ContentLength ? { "content-length": String(r.ContentLength) } : {}),
        "cache-control": "public, max-age=31536000, immutable",
        "accept-ranges": "none",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
