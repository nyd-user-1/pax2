"use server"

import { connectRun } from "@/lib/connect-run"
import type { ChannelMessage, Member, Result } from "@/lib/connect-types"
import { currentUser } from "@/lib/auth"
import { discordChannels, discordHistory, discordServer, discordThreads, type DiscordChannel, type DiscordThread } from "@/lib/discord"
import { slackChannels, slackHistory, slackMembers, slackTeam, type SlackChannel } from "@/lib/slack"

// The side panel's Slack and Discord reads, admins only (lib/connect-run.ts). Posting, which can carry
// files, goes through /api/connect/send.

/** Which doors are connected, by workspace and server name; null for anyone but an admin. */
export async function connections(): Promise<{ slack: string | null; discord: string | null } | null> {
  const user = await currentUser()
  if (!user?.admin) return null
  const [slack, discord] = await Promise.all([slackTeam(), discordServer()])
  return { slack, discord }
}

export const listSlackChannels = async (): Promise<Result<SlackChannel[]>> => connectRun("Slack", slackChannels)
export const readSlack = async (channel: string): Promise<Result<ChannelMessage[]>> => connectRun("Slack", () => slackHistory(channel))
export const listSlackMembers = async (): Promise<Result<Member[]>> => connectRun("Slack", slackMembers)

export const listDiscordChannels = async (): Promise<Result<DiscordChannel[]>> => connectRun("Discord", discordChannels)
export const listDiscordThreads = async (forum: string): Promise<Result<DiscordThread[]>> => connectRun("Discord", () => discordThreads(forum))
export const readDiscord = async (channel: string): Promise<Result<ChannelMessage[]>> => connectRun("Discord", () => discordHistory(channel))
