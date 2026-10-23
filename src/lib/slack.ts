import "server-only"

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

/** Slack's markup to plain text: mentions by name, channel links by name, links by their label. */
async function plain(text: string): Promise<string> {
  const ids = [...new Set([...text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)].map((m) => m[1]))]
  const names = new Map(await Promise.all(ids.map(async (id) => [id, (await person(id)).name] as const)))
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id: string) => `@${names.get(id) ?? "member"}`)
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#$1")
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

export type ChannelMessage = { id: string; text: string; author: string; avatar: string | null; at: string }

/** The channel's last 50 messages, oldest first. A public channel the bot isn't in yet, it joins. */
export async function slackHistory(channel: string): Promise<ChannelMessage[]> {
  type Raw = { ts: string; subtype?: string; text?: string; user?: string; username?: string; bot_profile?: { name?: string }; icons?: { image_48?: string; image_72?: string } }
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
    if (m.subtype && m.subtype !== "bot_message" && m.subtype !== "thread_broadcast") continue
    const text = (await plain(m.text ?? "")).trim()
    if (!text) continue
    // A post made through PAX carries its writer's name (chat:write.customize); a person's comes from their profile.
    const who = m.username ? { name: m.username, avatar: m.icons?.image_72 ?? m.icons?.image_48 ?? null } : m.user ? await person(m.user) : { name: m.bot_profile?.name ?? "Bot", avatar: null }
    out.push({ id: m.ts, text, author: who.name, avatar: who.avatar, at: new Date(Math.round(parseFloat(m.ts) * 1000)).toISOString() })
  }
  return out
}

/** Posts as the bot under the writer's name; without chat:write.customize, the name leads the text instead. */
export async function slackPost(channel: string, text: string, as: string): Promise<void> {
  try {
    await slackApi("chat.postMessage", { channel, text, username: as })
  } catch (e) {
    if (!(e instanceof SlackApiError) || e.code !== "missing_scope") throw e
    await slackApi("chat.postMessage", { channel, text: `*${as}:* ${text}` })
  }
}
