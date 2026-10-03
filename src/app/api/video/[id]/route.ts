import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { takeById } from "@/lib/catalog"

const s3 = new S3Client({ region: process.env.PAX_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX_BUCKET ?? "pax-638175140432"

// The videos stay private in S3; the player gets a short-lived signed link.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!takeById(id)) return new Response("Not found", { status: 404 })
  const poster = new URL(req.url).searchParams.has("poster")
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: `videos/${id}.${poster ? "jpg" : "mp4"}` }), { expiresIn: 3600 })
  return Response.redirect(url, 302)
}
