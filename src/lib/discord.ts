import "server-only"

import type { Attachment, ChannelMessage, Writer } from "@/lib/connect-types"
import { param } from "@/lib/ssm-param"

// Discord, after govblock (apps/web/lib/agents/connections/discord.ts and discord-community.ts): the PAX
// bot reads the server's channels, a forum's threads and a channel's messages; posts go through one "PAX"
// webhook per channel, so each carries its writer's name instead of the bot's. The bot token and the server
// id sit in SSM (/pax2/discord/bot-token, /pax2/discord/guild-id), written by scripts/connect-discord.sh;
// DISCORD_BOT_TOKEN and DISCORD_GUILD_ID override them. Server-side only.
//
// Two Discord facts shape the code: message text comes back empty unless the bot's Message Content
// intent is on, and a message caps at 2,000 characters.

const API = "https://discord.com/api/v10"
const UA = "pax2/1 (+https://pax.nysgpt.com)"
const CONTENT_MAX = 2000
const WEBHOOK_NAME = "PAX"

const token = async () => process.env.DISCORD_BOT_TOKEN || (await param("/pax2/discord/bot-token"))
const guildId = async () => process.env.DISCORD_GUILD_ID || (await param("/pax2/discord/guild-id"))

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Discord returned ${status} ${body.slice(0, 200)}`)
    this.name = "DiscordApiError"
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "user-agent": UA }
  if (init.auth !== false) {
    const t = await token()
    if (!t) throw new DiscordApiError(0, "not_configured")
    headers.authorization = `Bot ${t}`
  }
  if (init.body !== undefined) headers["content-type"] = "application/json"
  const res = await fetch(`${API}${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: "no-store", signal: AbortSignal.timeout(15_000) })
  const text = await res.text()
  if (!res.ok) throw new DiscordApiError(res.status, text)
  return (text ? JSON.parse(text) : {}) as T
}

/** The server's name, or null when Discord isn't connected. */
export async function discordServer(): Promise<string | null> {
  try {
    const g = await guildId()
    return g ? (await api<{ name: string }>(`/guilds/${g}`)).name : null
  } catch {
    return null
  }
}

export type DiscordChannel = { id: string; name: string; forum: boolean }

const TEXT = 0
const ANNOUNCEMENT = 5
const FORUM = 15

/** The server's text, announcement and forum channels, in the order Discord lists them. */
export async function discordChannels(): Promise<DiscordChannel[]> {
  const g = await guildId()
  if (!g) throw new DiscordApiError(0, "not_configured")
  type Raw = { id: string; name: string; type: number; position: number; parent_id: string | null }
  const all = await api<Raw[]>(`/guilds/${g}/channels`)
  const category = new Map(all.filter((c) => c.type === 4).map((c) => [c.id, c.position]))
  return all
    .filter((c) => c.type === TEXT || c.type === ANNOUNCEMENT || c.type === FORUM)
    .sort((a, b) => (category.get(a.parent_id ?? "") ?? -1) - (category.get(b.parent_id ?? "") ?? -1) || a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, forum: c.type === FORUM }))
}

export type DiscordThread = { id: string; name: string; count: number }

/** A forum's posts: the open ones and the 25 most recent closed ones, newest first. */
export async function discordThreads(forum: string): Promise<DiscordThread[]> {
  const g = await guildId()
  if (!g) throw new DiscordApiError(0, "not_configured")
  type Raw = { id: string; name: string; parent_id?: string; message_count?: number; last_message_id?: string | null }
  const [active, archived] = await Promise.all([
    api<{ threads?: Raw[] }>(`/guilds/${g}/threads/active`),
    api<{ threads?: Raw[] }>(`/channels/${forum}/threads/archived/public?limit=25`).catch(() => ({ threads: [] as Raw[] })),
  ])
  const seen = new Set<string>()
  return [...(active.threads ?? []).filter((t) => t.parent_id === forum), ...(archived.threads ?? [])]
    .filter((t) => !seen.has(t.id) && !!seen.add(t.id))
    .sort((a, b) => (BigInt(b.last_message_id ?? b.id) > BigInt(a.last_message_id ?? a.id) ? 1 : -1))
    .map((t) => ({ id: t.id, name: t.name, count: t.message_count ?? 0 }))
}

/** A channel's or thread's last 50 messages, oldest first, mentions by name. */
export async function discordHistory(channel: string): Promise<ChannelMessage[]> {
  type User = { id: string; username: string; global_name?: string | null; avatar?: string | null }
  type Raw = {
    id: string
    content: string
    timestamp: string
    webhook_id?: string
    author: User
    member?: { nick?: string | null }
    mentions?: User[]
    embeds?: { title?: string; description?: string }[]
    attachments?: { filename: string; url: string; size?: number; content_type?: string }[]
  }
  const raw = await api<Raw[]>(`/channels/${channel}/messages?limit=50`)
  return raw
    .reverse()
    .map((m) => {
      const named = new Map((m.mentions ?? []).map((u) => [u.id, u.global_name || u.username]))
      const content = m.content.replace(/<@!?(\d+)>/g, (_, id: string) => `@${named.get(id) ?? "member"}`)
      const text = [content, ...(m.embeds ?? []).map((e) => [e.title, e.description].filter(Boolean).join("\n"))].filter(Boolean).join("\n").trim()
      const files: Attachment[] = (m.attachments ?? []).map((a) => ({ name: a.filename, url: a.url, preview: a.content_type?.startsWith("image/") ? a.url : null, size: a.size ?? null }))
      const avatar = m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null
      return { id: m.id, text, author: m.member?.nick || m.author.global_name || m.author.username, authorId: m.webhook_id ? null : m.author.id, avatar, at: m.timestamp, files }
    })
    .filter((m) => m.text || m.files.length)
}

// The PAX webhook per channel: found among the channel's webhooks (only the app that made one sees its
// token), or made once. Kept for the life of the server instance.
const hooks = new Map<string, { id: string; token: string }>()
let appId: string | null = null

async function webhook(channel: string) {
  const hit = hooks.get(channel)
  if (hit) return hit
  appId ??= (await api<{ id: string }>("/oauth2/applications/@me")).id
  type Hook = { id: string; token?: string; name?: string; application_id?: string | null }
  const mine = (await api<Hook[]>(`/channels/${channel}/webhooks`)).find((w) => w.token && w.application_id === appId && w.name === WEBHOOK_NAME)
  const made = mine ?? (await api<Hook>(`/channels/${channel}/webhooks`, { method: "POST", body: { name: WEBHOOK_NAME } }))
  const hook = { id: made.id, token: made.token! }
  hooks.set(channel, hook)
  return hook
}

/** Posts under the writer's name and picture, files attached. A thread posts through its forum's webhook,
 *  into the thread. `mentions` turns @Name into a real mention, which notifies no one (allowed_mentions). */
export async function discordPost(channel: string, text: string, as: Writer, parent?: string, mentions: Record<string, string> = {}, files: File[] = []): Promise<void> {
  const hook = await webhook(parent ?? channel)
  const q = parent ? `?wait=true&thread_id=${channel}` : "?wait=true"
  let content = text
  for (const [name, id] of Object.entries(mentions)) content = content.split(`@${name}`).join(`<@${id}>`)
  const payload = { content: content.slice(0, CONTENT_MAX), username: as.name, avatar_url: as.icon, allowed_mentions: { parse: [] } }
  const url = `${API}/webhooks/${hook.id}/${hook.token}${q}`
  if (!files.length) {
    await api(`/webhooks/${hook.id}/${hook.token}${q}`, { method: "POST", auth: false, body: payload })
    return
  }
  const form = new FormData()
  form.set("payload_json", JSON.stringify({ ...payload, attachments: files.map((f, i) => ({ id: i, filename: f.name })) }))
  files.forEach((f, i) => form.set(`files[${i}]`, f, f.name))
  const res = await fetch(url, { method: "POST", headers: { "user-agent": UA }, body: form, cache: "no-store", signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new DiscordApiError(res.status, await res.text())
}
