import "server-only"

import type { Attachment, ChannelMessage, Member, Writer } from "@/lib/connect-types"
import { param } from "@/lib/ssm-param"

// Slack, ported from 44b (src/lib/slack/client.ts and users.ts): one workspace bot token, every Web API
// call form-encoded (users.info takes no JSON body), users.info cached so a poll never looks up the same
// person twice. The token is the PAX app's bot token, in SSM at /pax2/slack/bot-token, written by
// scripts/connect-slack.sh; SLACK_BOT_TOKEN overrides it. Server-side only: the token never reaches a browser.

const TOKEN_PARAM = "/pax2/slack/bot-token"

const token = async () => process.env.SLACK_BOT_TOKEN || (await param(TOKEN_PARAM))

export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
  ) {
    super(`Slack ${method} failed: ${code}`)
    this.name = "SlackApiError"
  }
}

async function slackApi<T>(method: string, args: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
  const t = await token()
  if (!t) throw new SlackApiError(method, "not_configured")
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) if (v !== undefined) body.set(k, String(v))
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${t}`, "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: body.toString(),
    cache: "no-store",
  })
  const data = (await res.json()) as { ok: boolean; error?: string } & T
  if (!data.ok) throw new SlackApiError(method, data.error ?? `http_${res.status}`)
  return data
}

/** The workspace the token belongs to, or null when Slack isn't connected. */
export async function slackTeam(): Promise<string | null> {
  try {
    return (await slackApi<{ team?: string }>("auth.test")).team ?? null
  } catch {
    return null
  }
}

export type SlackChannel = { id: string; name: string; private: boolean; member: boolean }

/** Every channel the bot can see, members first, then by name. */
export async function slackChannels(): Promise<SlackChannel[]> {
  const out: SlackChannel[] = []
  let cursor: string | undefined
  for (let page = 0; page < 5; page++) {
    const data = await slackApi<{ channels?: { id: string; name: string; is_private?: boolean; is_member?: boolean }[]; response_metadata?: { next_cursor?: string } }>(
      "conversations.list",
      { types: "public_channel,private_channel", exclude_archived: true, limit: 200, cursor },
    )
    for (const c of data.channels ?? []) out.push({ id: c.id, name: c.name, private: !!c.is_private, member: !!c.is_member })
    cursor = data.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  return out.sort((a, b) => Number(b.member) - Number(a.member) || a.name.localeCompare(b.name))
}

type Person = { name: string; avatar: string | null }
const people = new Map<string, { person: Person; at: number }>()
const PEOPLE_TTL = 10 * 60_000

async function person(id: string): Promise<Person> {
  const hit = people.get(id)
  if (hit && Date.now() - hit.at < PEOPLE_TTL) return hit.person
  let p: Person = { name: "Slack member", avatar: null }
  try {
    const u = (await slackApi<{ user: { real_name?: string; profile?: { display_name?: string; real_name?: string; image_72?: string } } }>("users.info", { user: id })).user
    p = { name: u.profile?.display_name || u.profile?.real_name || u.real_name || "Slack member", avatar: u.profile?.image_72 ?? null }
  } catch {
    // a deleted user or a missing scope reads as a plain member
  }
  people.set(id, { person: p, at: Date.now() })
  return p
}

/** Slack's mrkdwn to the panel's markdown (lib/connect-types.ts): mentions and channels by name, links
 *  as [label](url), *bold* to **bold**, _italic_ to *italic*, ~strike~ to ~~strike~~. */
async function toMarkdown(text: string): Promise<string> {
  const ids = [...new Set([...text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)].map((m) => m[1]))]
  const names = new Map(await Promise.all(ids.map(async (id) => [id, (await person(id)).name] as const)))
  const edge = "(^|[\\s(])"
  const end = "(?=$|[\\s).,!?:;])"
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id: string) => `@${names.get(id) ?? "member"}`)
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#$1")
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/<((?:https?|mailto):[^|>]+)\|([^>]+)>/g, "[$2]($1)")
    .replace(/<((?:https?|mailto):[^>]+)>/g, "$1")
    .replace(new RegExp(`${edge}\\*([^*\\n]+)\\*${end}`, "gm"), "$1**$2**")
    .replace(new RegExp(`${edge}_([^_\\n]+)_${end}`, "gm"), "$1*$2*")
    .replace(new RegExp(`${edge}~([^~\\n]+)~${end}`, "gm"), "$1~~$2~~")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/** The panel's markdown to Slack's mrkdwn; `mentions` turns @Name into a real mention. */
function toMrkdwn(text: string, mentions: Record<string, string>): string {
  let t = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  t = t.replace(/\[([^\]\n]+)\]\(((?:https?|mailto):[^)\s]+)\)/g, "<$2|$1>")
  for (const [name, id] of Object.entries(mentions)) t = t.split(`@${name}`).join(`<@${id}>`)
  return t
    .replace(/\*\*([^*\n]+)\*\*/g, "\u0001$1\u0001")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1_$2_")
    .replace(/\u0001/g, "*")
    .replace(/~~([^~\n]+)~~/g, "~$1~")
    .replace(/__([^_\n]+)__/g, "$1")
}

/** A Slack file opens through the app, which fetches it with the bot token (files:read). */
const fileUrl = (u: string) => `/api/connect/file?u=${encodeURIComponent(u)}`

type RawFile = { name?: string; title?: string; mimetype?: string; size?: number; url_private?: string; url_private_download?: string; thumb_480?: string; thumb_360?: string; thumb_pdf?: string }

function attachment(f: RawFile): Attachment | null {
  const src = f.url_private_download ?? f.url_private
  if (!src) return null
  const image = f.mimetype?.startsWith("image/") ? (f.thumb_480 ?? f.thumb_360 ?? f.url_private ?? null) : (f.thumb_pdf ?? null)
  return { name: f.name ?? f.title ?? "file", url: fileUrl(src), preview: image ? fileUrl(image) : null, size: f.size ?? null }
}

/** The channel's last 50 messages, oldest first. A public channel the bot isn't in yet, it joins. */
export async function slackHistory(channel: string): Promise<ChannelMessage[]> {
  type Raw = { ts: string; subtype?: string; text?: string; user?: string; username?: string; bot_profile?: { name?: string }; icons?: { image_48?: string; image_72?: string }; files?: RawFile[] }
  let raw: Raw[]
  try {
    raw = (await slackApi<{ messages?: Raw[] }>("conversations.history", { channel, limit: 50 })).messages ?? []
  } catch (e) {
    if (!(e instanceof SlackApiError) || e.code !== "not_in_channel") throw e
    await slackApi("conversations.join", { channel })
    raw = (await slackApi<{ messages?: Raw[] }>("conversations.history", { channel, limit: 50 })).messages ?? []
  }
  const out: ChannelMessage[] = []
  for (const m of raw.reverse()) {
    if (m.subtype && !["bot_message", "thread_broadcast", "file_share"].includes(m.subtype)) continue
    const text = (await toMarkdown(m.text ?? "")).trim()
    const files = (m.files ?? []).map(attachment).filter((f): f is Attachment => !!f)
    if (!text && !files.length) continue
    // A post made through PAX carries its writer's name and picture (chat:write.customize); a person's come from their profile.
    const who = m.username ? { name: m.username, avatar: m.icons?.image_72 ?? m.icons?.image_48 ?? null } : m.user ? await person(m.user) : { name: m.bot_profile?.name ?? "Bot", avatar: null }
    out.push({ id: m.ts, text, author: who.name, authorId: m.username ? null : (m.user ?? null), avatar: who.avatar, at: new Date(Math.round(parseFloat(m.ts) * 1000)).toISOString(), files })
  }
  return out
}

/** The workspace's people, for the composer's @. */
export async function slackMembers(): Promise<Member[]> {
  type Raw = { id: string; deleted?: boolean; is_bot?: boolean; real_name?: string; profile?: { display_name?: string; real_name?: string; image_72?: string } }
  const out: Member[] = []
  let cursor: string | undefined
  for (let page = 0; page < 5; page++) {
    const data = await slackApi<{ members?: Raw[]; response_metadata?: { next_cursor?: string } }>("users.list", { limit: 200, cursor })
    for (const u of data.members ?? [])
      if (!u.deleted && !u.is_bot && u.id !== "USLACKBOT") out.push({ id: u.id, name: u.profile?.display_name || u.profile?.real_name || u.real_name || "member", avatar: u.profile?.image_72 ?? null })
    cursor = data.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Posts under the writer's name and picture. Files go up through Slack's external upload, posted with the
 *  text as their comment; Slack shows those under the app's own name, so the writer's name leads the text. */
export async function slackPost(channel: string, text: string, as: Writer, mentions: Record<string, string> = {}, files: File[] = []): Promise<void> {
  const body = toMrkdwn(text, mentions)
  if (!files.length) {
    await slackApi("chat.postMessage", { channel, text: body, username: as.name, icon_url: as.icon })
    return
  }
  const ids: { id: string; title: string }[] = []
  for (const f of files) {
    const up = await slackApi<{ upload_url: string; file_id: string }>("files.getUploadURLExternal", { filename: f.name, length: f.size })
    const res = await fetch(up.upload_url, { method: "POST", body: Buffer.from(await f.arrayBuffer()) })
    if (!res.ok) throw new SlackApiError("upload", `http_${res.status}`)
    ids.push({ id: up.file_id, title: f.name })
  }
  await slackApi("files.completeUploadExternal", { files: JSON.stringify(ids), channel_id: channel, initial_comment: body ? `*${as.name}:* ${body}` : `*${as.name}*` })
}

/** A Slack file's bytes, fetched with the bot token; only Slack's own file hosts. */
export async function slackFile(url: string): Promise<Response> {
  const u = new URL(url)
  if (u.protocol !== "https:" || !/(^|\.)slack(-edge)?\.com$/.test(u.hostname) || !u.hostname.startsWith("files")) throw new SlackApiError("file", "bad_host")
  const t = await token()
  if (!t) throw new SlackApiError("file", "not_configured")
  return fetch(u, { headers: { authorization: `Bearer ${t}` }, cache: "no-store" })
}
