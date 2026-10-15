import { readFile } from "node:fs/promises"
import path from "node:path"

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const ALLOWED = ["raw/", "curated/", "model/", "videos/", "features/", "transcribe/", "takes/", "athena/govblock/", "library/"]
const LOCAL = ["data/raw/yt-shorts.json", "data/raw/yt-videos.json", "data/generated/ma-house-2022.json", "data/generated/reform-ad-spend.json"]

// A library file: S3 objects through a short-lived signed link, repo files served directly.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const key = u.searchParams.get("key")
  const local = u.searchParams.get("local")
  if (local && LOCAL.includes(local)) {
    const body = await readFile(path.join(process.cwd(), local))
    return new Response(body, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${path.basename(local)}"` } })
  }
  if (!key || !ALLOWED.some((p) => key.startsWith(p)) || key.includes("..")) return new Response("Not found", { status: 404 })
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${path.basename(key)}"` }), { expiresIn: 600 })
  return Response.redirect(url, 302)
}
