"use server"

import { uploadUrl } from "@/app/actions"
import { currentUser } from "@/lib/auth"
import { listNonPublic, pollRun, progress, setPermitted, type Progress } from "@/lib/channel-ingest"
import { recordUpload } from "@/lib/channel-report"
import { now, putOnce, query, type Item } from "@/lib/ledger"
import { connectedChannels, mayRead, type ConnectedChannel } from "@/lib/youtube"

// The onboarding stepper's server half (src/app/signup/welcome). Answers are stored on the user as
// append-only rows: OWNER#<email> / PROFILE#<iso>, the latest wins.

export type Profile = {
  name: string
  lastName: string
  role: string
  town: string
  heard: string
  makes: string[]
  wants: string[]
  /** Set when the user reaches the last step. */
  finished?: boolean
}

async function user() {
  const u = await currentUser()
  if (!u) throw new Error("Sign in first.")
  return u
}

export async function loadProfile(): Promise<Profile | null> {
  const u = await user()
  const rows = await query<Item & { at: string; profile: Profile }>(`OWNER#${u.email}`, "PROFILE#")
  return rows.sort((a, b) => b.at.localeCompare(a.at))[0]?.profile ?? null
}

export async function saveProfile(profile: Profile) {
  const u = await user()
  const clean: Profile = {
    name: profile.name.trim().slice(0, 80),
    lastName: profile.lastName.trim().slice(0, 80),
    role: profile.role.trim().slice(0, 120),
    town: profile.town.trim().slice(0, 120),
    heard: profile.heard.trim().slice(0, 200),
    makes: profile.makes.slice(0, 10),
    wants: profile.wants.slice(0, 10),
    finished: !!profile.finished,
  }
  const at = now()
  await putOnce({ pk: `OWNER#${u.email}`, sk: `PROFILE#${at}`, at, profile: clean })
  return { ok: true }
}

export async function myChannels(): Promise<(ConnectedChannel & { progress: Progress | null })[]> {
  const u = await user()
  const chs = await connectedChannels(u.email)
  return Promise.all(chs.map(async (c) => ({ ...c, progress: await progress(c.channelId) })))
}

async function guard(channelId: string) {
  const u = await user()
  if (!/^UC[\w-]{22}$/.test(channelId)) throw new Error("Not a channel id.")
  if (!(await mayRead(u.email, u.admin, channelId))) throw new Error("That channel is not connected to this account.")
  return u
}

/** Where the channel's run stands; the Lambda does the work, this only reads (and re-hands a stalled run). */
export async function pollIngest(channelId: string): Promise<Progress | null> {
  const u = await guard(channelId)
  return pollRun(channelId, u.email)
}

/** The channel's private and unlisted videos for the picker, live from YouTube and never stored. */
export async function privateVideos(channelId: string) {
  await guard(channelId)
  return listNonPublic(channelId)
}

/** The user's picks among their private and unlisted videos; un-picked ones are deleted on the next run. */
export async function savePicks(channelId: string, ids: string[]) {
  const u = await guard(channelId)
  const allowed = new Set((await listNonPublic(channelId)).map((v) => v.youtubeId))
  await setPermitted(channelId, ids.filter((id) => allowed.has(id)), u.email)
  return progress(channelId)
}

/** A presigned PUT for one of the user's video files, through the recording flow's upload path, so the
 *  file lands under uploads/ and lambda/analyze runs the content analysis on it. */
export async function videoUploadUrl(contentType: string) {
  await user()
  if (!/^video\/(mp4|webm)$/.test(contentType)) throw new Error("Upload an mp4 (YouTube Studio's download is one).")
  return uploadUrl(contentType)
}

/** Records an uploaded file, and which of the user's YouTube videos it is, if they said. */
export async function linkUpload(input: { uploadId: string; key: string; name: string; youtubeId: string | null; channelId: string | null }) {
  const u = await user()
  if (!/^uploads\/[\w-]+\/[\w-]+\.(mp4|webm)$/.test(input.key)) throw new Error("Not an upload key.")
  if (input.channelId && !(await mayRead(u.email, u.admin, input.channelId))) throw new Error("That channel is not connected to this account.")
  await recordUpload(u.email, { uploadId: input.uploadId, key: input.key, name: input.name.slice(0, 200), youtubeId: input.youtubeId, channelId: input.channelId })
  return { ok: true }
}

/** Every video on the user's connected channels, for linking an uploaded file to the video it is. */
export async function myVideos(): Promise<{ channelId: string; channel: string; youtubeId: string; title: string }[]> {
  const u = await user()
  const { channelData } = await import("@/lib/channel-ingest")
  const out: { channelId: string; channel: string; youtubeId: string; title: string }[] = []
  for (const c of await connectedChannels(u.email)) {
    const d = await channelData(c.channelId)
    for (const v of d?.videos ?? []) out.push({ channelId: c.channelId, channel: d!.channel.title, youtubeId: v.video.youtubeId, title: v.video.title })
  }
  return out
}
