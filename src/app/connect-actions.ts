"use server"

import { currentUser } from "@/lib/auth"
import { discordChannels, discordHistory, discordPost, discordServer, discordThreads, DiscordApiError, type DiscordChannel, type DiscordThread } from "@/lib/discord"
import { slackChannels, slackHistory, slackPost, slackTeam, SlackApiError, type ChannelMessage, type SlackChannel } from "@/lib/slack"

// The side panel's Slack and Discord doors. Admins only: anyone can make a PAX account, and these read and
// post in the team's own workspace and server. Each call answers with its data or a plain error line.

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function admin() {
  const user = await currentUser()
  if (!user?.admin) throw new Error("Slack and Discord are open to admins only.")
  return user
}

/** The name a post goes out under: the part of the email before the @, as the account chip shows it. */
const nameOf = (email: string) => email.split("@")[0]

function reason(e: unknown, service: "Slack" | "Discord"): string {
  if (e instanceof SlackApiError) {
    if (e.code === "not_configured") return "Slack isn't connected yet."
    if (e.code === "missing_scope") return "The PAX Slack app is missing a permission; reinstall it from its manifest."
    if (e.code === "channel_not_found" || e.code === "not_in_channel") return "PAX isn't in that channel. Invite it with /invite @PAX."
    return `Slack: ${e.code}.`
  }
  if (e instanceof DiscordApiError) {
    if (e.body === "not_configured") return "Discord isn't connected yet."
    if (e.status === 403) return "The PAX bot lacks a permission in that channel."
    return `Discord returned ${e.status}.`
  }
  return e instanceof Error ? e.message : `${service} could not be reached.`
}

async function run<T>(service: "Slack" | "Discord", f: () => Promise<T>): Promise<Result<T>> {
  try {
    await admin()
    return { ok: true, data: await f() }
  } catch (e) {
    return { ok: false, error: reason(e, service) }
  }
}

/** Which doors are connected, by workspace and server name; null for anyone but an admin. */
export async function connections(): Promise<{ slack: string | null; discord: string | null } | null> {
  const user = await currentUser()
  if (!user?.admin) return null
  const [slack, discord] = await Promise.all([slackTeam(), discordServer()])
  return { slack, discord }
}

export const listSlackChannels = async (): Promise<Result<SlackChannel[]>> => run("Slack", slackChannels)
export const readSlack = async (channel: string): Promise<Result<ChannelMessage[]>> => run("Slack", () => slackHistory(channel))
export async function sendSlack(channel: string, text: string): Promise<Result<null>> {
  return run("Slack", async () => {
    const user = await admin()
    if (text.trim()) await slackPost(channel, text.trim(), nameOf(user.email))
    return null
  })
}

export const listDiscordChannels = async (): Promise<Result<DiscordChannel[]>> => run("Discord", discordChannels)
export const listDiscordThreads = async (forum: string): Promise<Result<DiscordThread[]>> => run("Discord", () => discordThreads(forum))
export const readDiscord = async (channel: string): Promise<Result<ChannelMessage[]>> => run("Discord", () => discordHistory(channel))
export async function sendDiscord(channel: string, text: string, parent?: string): Promise<Result<null>> {
  return run("Discord", async () => {
    const user = await admin()
    if (text.trim()) await discordPost(channel, text.trim(), nameOf(user.email), parent)
    return null
  })
}
