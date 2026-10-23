// The shapes Slack and Discord share once they reach the side panel (lib/slack.ts, lib/discord.ts,
// components/connect-view.tsx). Message text is one markdown for both: **bold**, *italic*, __underline__,
// ~~strike~~, `code`, ```blocks```, > quotes, - and 1. lists, [label](url); each service's own markup is
// converted to it on the way in and from it on the way out.

export type Attachment = {
  name: string
  /** Where the file opens; a Slack file goes through /api/connect/file, which holds the bot token. */
  url: string
  /** An image or a rendered first page, when the service has one. */
  preview: string | null
  size: number | null
}

export type ChannelMessage = {
  id: string
  text: string
  author: string
  /** The person's id on the service, for an @-mention; null for a bot or a webhook post. */
  authorId: string | null
  avatar: string | null
  at: string
  files: Attachment[]
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type Member = { id: string; name: string; avatar: string | null }

/** Who a post from PAX goes out as. `icon` is a public URL. */
export type Writer = { name: string; icon: string }

/** One upload's cap, under the app server's request limit. */
export const ATTACH_MAX_BYTES = 5 * 1024 * 1024
