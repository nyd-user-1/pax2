import "server-only"

import { now, putOnce, query, type Item } from "@/lib/ledger"
import { SITE } from "@/lib/mail"

// Publishing to YouTube (requirement 7): the channel's owner or an Editor grants PAX2 access once,
// through Google's consent screen (src/app/api/youtube/oauth/route.ts); the refresh token goes to SSM
// as a SecureString and the channel's id and name to the DynamoDB table; from then on the publish step
// uploads an approved video to that channel and the returned id goes to the poller's watch list.
//
// Settings: PAX2_GOOGLE_CLIENT_ID and PAX2_GOOGLE_CLIENT_SECRET (the Google Cloud OAuth client, Brendan's),
// PAX2_URL for the redirect, PAX2_YOUTUBE_PRIVACY (public, unlisted or private; public by default). The
// server's role needs ssm:GetParameter and ssm:PutParameter on /pax2/youtube/* (scripts/youtube/grant.sh).

const CLIENT_ID = process.env.PAX2_GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.PAX2_GOOGLE_CLIENT_SECRET
const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const PRIVACY = process.env.PAX2_YOUTUBE_PRIVACY ?? "public"
export const REDIRECT = `${SITE}/api/youtube/oauth`
export const TOKEN_PARAM = "/pax2/youtube/refresh-token"
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"]

export type Channel = Item & { at: string; channelId: string; title: string; by: string; scopes: string[] }

export const configured = () => !!(CLIENT_ID && CLIENT_SECRET)

/** Google's consent screen for the channel's owner or an Editor: offline access, so a refresh token comes back. */
export function authUrl(state: string) {
  if (!CLIENT_ID) throw new Error("PAX2_GOOGLE_CLIENT_ID is not set.")
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  u.searchParams.set("client_id", CLIENT_ID)
  u.searchParams.set("redirect_uri", REDIRECT)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", SCOPES.join(" "))
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", "consent")
  u.searchParams.set("include_granted_scopes", "true")
  u.searchParams.set("state", state)
  return u.toString()
}

async function tokenRequest(body: Record<string, string>) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("The Google OAuth client is not configured.")
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }) })
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!r.ok || !j.access_token) throw new Error(`Google token: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim())
  return j
}

async function ssm() {
  const { SSMClient, GetParameterCommand, PutParameterCommand } = await import("@aws-sdk/client-ssm")
  const c = new SSMClient({ region: REGION })
  return {
    get: async () => (await c.send(new GetParameterCommand({ Name: TOKEN_PARAM, WithDecryption: true }))).Parameter?.Value ?? null,
    put: (v: string) => c.send(new PutParameterCommand({ Name: TOKEN_PARAM, Value: v, Type: "SecureString", Overwrite: true })),
  }
}

/** The grant's second half: the code from the consent screen becomes a refresh token in SSM and a channel row. */
export async function completeGrant(code: string, by: string): Promise<Channel> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: REDIRECT })
  if (!t.refresh_token) throw new Error("Google returned no refresh token; remove PAX2 under the Google account's third-party access and grant again.")
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${t.access_token}` } })
  const j = (await r.json()) as { items?: { id: string; snippet: { title: string } }[]; error?: { message: string } }
  const ch = j.items?.[0]
  if (!ch) throw new Error(`No channel on that Google account: ${j.error?.message ?? "the account must own the channel or be one of its Editors or Managers"}`)
  await (await ssm()).put(t.refresh_token)
  const at = now()
  const row: Channel = { pk: "YOUTUBE#channel", sk: `GRANT#${at}`, at, channelId: ch.id, title: ch.snippet.title, by, scopes: SCOPES }
  await putOnce(row)
  return row
}

/** The channel PAX2 publishes to, the latest grant, or null before any grant. */
export async function channel(): Promise<Channel | null> {
  const rows = await query<Channel>("YOUTUBE#channel", "GRANT#")
  return rows.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
}

let cached: { token: string; until: number } | null = null
async function accessToken() {
  if (cached && cached.until > Date.now()) return cached.token
  const refresh = await (await ssm()).get()
  if (!refresh) throw new Error("No YouTube grant yet; an Editor of the channel signs in once at /api/youtube/oauth.")
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" })
  cached = { token: t.access_token!, until: Date.now() + ((t.expires_in ?? 3600) - 300) * 1000 }
  return cached.token
}

/** Uploads the S3 object at `key` to the granted channel and returns the YouTube id. A resumable upload
 *  in one shot: the metadata first, then the bytes streamed from S3 to the session URL Google returns. */
export async function uploadShort(input: { key: string; title: string; description: string; publishAt?: string | null }): Promise<{ youtubeId: string; url: string }> {
  const token = await accessToken()
  const { S3Client, GetObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3")
  const s3 = new S3Client({ region: REGION })
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: input.key }))
  const size = head.ContentLength ?? 0
  const type = head.ContentType?.startsWith("video/") ? head.ContentType : "video/mp4"
  const status: Record<string, unknown> = { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false }
  if (input.publishAt && Date.parse(input.publishAt) > Date.now() + 60_000) {
    status.privacyStatus = "private"
    status.publishAt = new Date(input.publishAt).toISOString()
  }
  const meta = { snippet: { title: input.title.slice(0, 100), description: input.description.slice(0, 5000), categoryId: "25" }, status }
  const open = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": type, "x-upload-content-length": String(size) },
    body: JSON.stringify(meta),
  })
  const session = open.headers.get("location")
  if (!open.ok || !session) throw new Error(`YouTube refused the upload: ${open.status} ${(await open.text()).slice(0, 300)}`)
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: input.key }))
  const body = obj.Body?.transformToWebStream()
  if (!body) throw new Error(`No body for s3://${BUCKET}/${input.key}`)
  const put = await fetch(session, { method: "PUT", headers: { "content-type": type, "content-length": String(size) }, body, duplex: "half" } as RequestInit & { duplex: "half" })
  const j = (await put.json()) as { id?: string; error?: { message: string } }
  if (!put.ok || !j.id) throw new Error(`YouTube upload failed: ${put.status} ${j.error?.message ?? ""}`.trim())
  return { youtubeId: j.id, url: `https://youtube.com/shorts/${j.id}` }
}
