import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { takeById } from "@/lib/catalog"
import { currentUser } from "@/lib/auth"
import { isOriginalId, original } from "@/lib/originals"

const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

// The videos stay private in S3; the player gets a short-lived signed link.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // An original sits wherever its upload landed, under uploads/.
  if (isOriginalId(id)) {
    const o = await original(id)
    const user = await currentUser()
    if (!o || !o.key.startsWith("uploads/") || !user || (user.email !== o.owner && !user.admin)) return new Response("Not found", { status: 404 })
    return Response.redirect(await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: o.key }), { expiresIn: 3600 }), 302)
  }
  // Campaign shorts live beside the takes as videos/yt-<youtube id>.mp4.
  if (!takeById(id) && !/^yt-[\w-]{11}$/.test(id)) return new Response("Not found", { status: 404 })
  const poster = new URL(req.url).searchParams.has("poster")
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: `videos/${id}.${poster ? "jpg" : "mp4"}` }), { expiresIn: 3600 })
  return Response.redirect(url, 302)
}
