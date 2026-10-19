import "server-only"

import { now, putOnce, query, type Item } from "@/lib/ledger"
import { SITE } from "@/lib/mail"

// YouTube grants. Two kinds, one OAuth client (PAX2_GOOGLE_CLIENT_ID and PAX2_GOOGLE_CLIENT_SECRET):
//
//   publish  an admin, as the channel's owner or an Editor, grants upload + read + analytics once
//            (requirement 7). That channel becomes the publish channel: SSM /pax2/youtube/publish-channel
//            names it, and channel() and uploadShort() resolve to it.
//   connect  any signed-in user grants read + analytics only, for each channel they bring (onboarding).
//            A connect grant never becomes the publish identity and never replaces a stored token that
//            carries the upload scope.
//
// One SecureString per channel at /pax2/youtube/refresh-token/<channelId>. Before the re-key there was a
// single token at /pax2/youtube/refresh-token; the publish path falls back to it while the pointer is
// unset. DynamoDB rows:
//
//   pk                      sk                              item
//   YOUTUBE#channel         GRANT#<iso>                     a publish grant (the shape channel() returns)
//   YTCH#<channelId>        GRANT#<iso>                     every grant of the channel, publish or connect
//   OWNER#<email>           CHANNEL#<channelId>#<iso>       a user's connected channel
//
// Settings: PAX2_URL for the redirect, PAX2_YOUTUBE_PRIVACY (public, unlisted or private; public by
// default). The server's role needs ssm:GetParameter and ssm:PutParameter on /pax2/youtube/*
// (scripts/youtube/grant.sh).

const CLIENT_ID = process.env.PAX2_GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.PAX2_GOOGLE_CLIENT_SECRET
const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const PRIVACY = process.env.PAX2_YOUTUBE_PRIVACY ?? "public"
export const REDIRECT = `${SITE}/api/youtube/oauth`
/** The pre-re-key single token; read only as the publish fallback. */
export const TOKEN_PARAM = "/pax2/youtube/refresh-token"
const tokenParam = (channelId: string) => `${TOKEN_PARAM}/${channelId}`
const PUBLISH_PARAM = "/pax2/youtube/publish-channel"
const UPLOAD = "https://www.googleapis.com/auth/youtube.upload"
const READ = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"]
const SCOPES = { publish: [UPLOAD, ...READ], connect: READ }

export type GrantMode = keyof typeof SCOPES
export type Channel = Item & { at: string; channelId: string; title: string; by: string; scopes: string[] }
export type ConnectedChannel = Item & { at: string; channelId: string; title: string; handle: string | null; thumbnail: string | null; by: string; mode: GrantMode }

export const configured = () => !!(CLIENT_ID && CLIENT_SECRET)

/** Google's consent screen, offline access so a refresh token comes back. A publish grant asks for
 *  upload; a connect grant asks only to read the channel and its analytics, and shows the account
 *  chooser every time so a second pass can pick another channel. */
export function authUrl(state: string, mode: GrantMode = "publish") {
  if (!CLIENT_ID) throw new Error("PAX2_GOOGLE_CLIENT_ID is not set.")
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  u.searchParams.set("client_id", CLIENT_ID)
  u.searchParams.set("redirect_uri", REDIRECT)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", SCOPES[mode].join(" "))
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", mode === "connect" ? "select_account consent" : "consent")
  // A connect grant stays read-only even when the Google account once granted upload.
  u.searchParams.set("include_granted_scopes", mode === "publish" ? "true" : "false")
  u.searchParams.set("state", state)
  return u.toString()
}

async function tokenRequest(body: Record<string, string>) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("The Google OAuth client is not configured.")
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }) })
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
  if (!r.ok || !j.access_token) throw new Error(`Google token: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim())
  return j
}

async function ssm() {
  const { SSMClient, GetParameterCommand, PutParameterCommand } = await import("@aws-sdk/client-ssm")
  const c = new SSMClient({ region: REGION })
  return {
    get: async (name: string, decrypt = true) => {
      try {
        return (await c.send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }))).Parameter?.Value ?? null
      } catch (e) {
        if ((e as { name?: string }).name === "ParameterNotFound") return null
        throw e
      }
    },
    put: (name: string, v: string, secure = true) => c.send(new PutParameterCommand({ Name: name, Value: v, Type: secure ? "SecureString" : "String", Overwrite: true })),
  }
}

/** The grant's second half: the code from the consent screen becomes a refresh token in SSM under the
 *  channel's id, plus the grant rows. A publish grant also points the publish channel at it. */
export async function completeGrant(code: string, by: string, mode: GrantMode = "publish"): Promise<ConnectedChannel> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: REDIRECT })
  if (!t.refresh_token) throw new Error("Google returned no refresh token; remove PAX2 under the Google account's third-party access and grant again.")
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${t.access_token}` } })
  const j = (await r.json()) as { items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } } }[]; error?: { message: string } }
  const ch = j.items?.[0]
  if (!ch) throw new Error(`No channel on that Google account: ${j.error?.message ?? "the account must own the channel or be one of its Editors or Managers"}`)
  const granted = (t.scope ?? SCOPES[mode].join(" ")).split(" ")
  if (mode === "publish" && !granted.includes(UPLOAD)) throw new Error("The upload permission was not granted; tick every box on Google's consent screen and grant again.")
  const store = await ssm()
  // A read-only grant never replaces a stored token that can upload: the stored one already reads.
  const prior = (await query<Channel>(`YTCH#${ch.id}`, "GRANT#")).sort((a, b) => b.at.localeCompare(a.at))[0]
  const isPublish = (await store.get(PUBLISH_PARAM, false)) === ch.id
  const keepPrior = mode === "connect" && (isPublish || !!prior?.scopes?.includes(UPLOAD)) && (await store.get(tokenParam(ch.id), false)) != null
  if (!keepPrior) await store.put(tokenParam(ch.id), t.refresh_token)
  const at = now()
  const base = { at, channelId: ch.id, title: ch.snippet.title, by, scopes: keepPrior ? (prior?.scopes ?? SCOPES.publish) : granted }
  await putOnce({ pk: `YTCH#${ch.id}`, sk: `GRANT#${at}`, ...base, mode })
  if (mode === "publish") {
    await putOnce({ pk: "YOUTUBE#channel", sk: `GRANT#${at}`, ...base })
    await store.put(PUBLISH_PARAM, ch.id, false)
    accessCache.delete(PUBLISH)
  }
  accessCache.delete(ch.id)
  const row: ConnectedChannel = { pk: `OWNER#${by}`, sk: `CHANNEL#${ch.id}#${at}`, at, channelId: ch.id, title: ch.snippet.title, handle: ch.snippet.customUrl ?? null, thumbnail: ch.snippet.thumbnails?.default?.url ?? null, by, mode }
  await putOnce(row)
  return row
}

/** The channel PAX2 publishes to, the latest publish grant, or null before any. */
export async function channel(): Promise<Channel | null> {
  const rows = await query<Channel>("YOUTUBE#channel", "GRANT#")
  return rows.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
}

/** Every channel a user has connected, the latest grant of each. */
export async function connectedChannels(email: string): Promise<ConnectedChannel[]> {
  const rows = await query<ConnectedChannel>(`OWNER#${email}`, "CHANNEL#")
  const latest = new Map<string, ConnectedChannel>()
  for (const r of rows) if (!latest.has(r.channelId) || latest.get(r.channelId)!.at < r.at) latest.set(r.channelId, r)
  return [...latest.values()].sort((a, b) => a.at.localeCompare(b.at))
}

/** Whether a user may read a channel's data: they connected it, or they are an admin. */
export async function mayRead(email: string, admin: boolean, channelId: string) {
  return admin || (await connectedChannels(email)).some((c) => c.channelId === channelId)
}

const PUBLISH = "__publish__"
const accessCache = new Map<string, { token: string; until: number }>()

async function refreshFor(key: string) {
  const store = await ssm()
  if (key !== PUBLISH) return store.get(tokenParam(key))
  const id = await store.get(PUBLISH_PARAM, false)
  return id ? store.get(tokenParam(id)) : store.get(TOKEN_PARAM)
}

async function accessFor(key: string) {
  const hit = accessCache.get(key)
  if (hit && hit.until > Date.now()) return hit.token
  const refresh = await refreshFor(key)
  if (!refresh) throw new Error(key === PUBLISH ? "No YouTube grant yet; an Editor of the channel signs in once at /api/youtube/oauth." : "That channel is not connected; connect it again.")
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" })
  const token = t.access_token!
  accessCache.set(key, { token, until: Date.now() + ((t.expires_in ?? 3600) - 300) * 1000 })
  return token
}

const accessToken = () => accessFor(PUBLISH)

/** An access token for reading one connected channel (Data API and Analytics API). */
export const channelAccessToken = (channelId: string) => accessFor(channelId)

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
