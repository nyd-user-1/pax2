import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

// The working documents, kept in S3 (s3://<bucket>/library/sketches/) instead of the repo.
// Served at the same /sketches/<name>.html URLs they had under public/, so the Library cards
// and the documents' links to each other resolve unchanged.
const s3 = new S3Client({ region: process.env.PAX2_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!/^[A-Za-z0-9_-]+\.html$/.test(name)) return new Response("Not found", { status: 404 })
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `library/sketches/${name}` }))
    return new Response(await r.Body!.transformToString(), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
