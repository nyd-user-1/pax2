import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { currentUser } from "@/lib/auth"
import { reportBySlug } from "@/lib/reports"

const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

// A report's original stays private in S3; a signed-in reader gets a ten-minute signed link (tariffs'
// rulings pattern: the bytes go straight from S3 to the browser, never through this function).
// ?download=1 asks for an attachment instead of the inline view the reader's frame shows.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const r = reportBySlug((await params).slug)
  if (!r) return new Response("Not found", { status: 404 })
  if (!(await currentUser())) return new Response("Sign in to read this report.", { status: 401 })
  const download = new URL(req.url).searchParams.has("download")
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: r.key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="${r.slug}.pdf"`,
    }),
    { expiresIn: 600 },
  )
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } })
}
