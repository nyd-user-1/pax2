import "server-only"

import { currentUser, type SessionUser } from "@/lib/auth"
import { DiscordApiError } from "@/lib/discord"
import { query, type Item } from "@/lib/ledger"
import { SlackApiError } from "@/lib/slack"
import type { Result, Writer } from "@/lib/connect-types"

// The guard and the error lines every Slack and Discord call shares (app/connect-actions.ts and
// app/api/connect/*). Admins only: anyone can make a PAX account, and these read and post in the team's
// own workspace and server.

export async function connectAdmin(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user?.admin) throw new Error("Slack and Discord are open to admins only.")
  return user
}

export function connectError(e: unknown, service: "Slack" | "Discord"): string {
  if (e instanceof SlackApiError) {
    if (e.code === "not_configured") return "Slack isn't connected yet."
    if (e.code === "missing_scope") return "The PAX Slack app is missing a permission; add it under OAuth & Permissions and reinstall."
    if (e.code === "channel_not_found" || e.code === "not_in_channel") return "PAX isn't in that channel. Invite it with /invite @PAX."
    return `Slack: ${e.code}.`
  }
  if (e instanceof DiscordApiError) {
    if (e.body === "not_configured") return "Discord isn't connected yet."
    if (e.status === 403) return "The PAX bot lacks a permission in that channel."
    if (e.status === 413) return "Discord turned the files down as too large."
    return `Discord returned ${e.status}.`
  }
  return e instanceof Error ? e.message : `${service} could not be reached.`
}

export async function connectRun<T>(service: "Slack" | "Discord", f: () => Promise<T>): Promise<Result<T>> {
  try {
    await connectAdmin()
    return { ok: true, data: await f() }
  } catch (e) {
    return { ok: false, error: connectError(e, service) }
  }
}

/** The site's public address, for the picture a post carries (Slack and Discord fetch it themselves). */
const ORIGIN = process.env.PAX2_ORIGIN ?? "https://pax.nysgpt.com"

/** Who a post goes out as: the profile's first and last name (the onboarding rows, OWNER#<email> /
 *  PROFILE#<iso>, latest wins), else the email's name; the picture every account wears, Washington. */
export async function writerFor(user: SessionUser): Promise<Writer> {
  type Row = Item & { at: string; profile?: { name?: string; lastName?: string } }
  let name = ""
  try {
    const p = (await query<Row>(`OWNER#${user.email}`, "PROFILE#")).sort((a, b) => b.at.localeCompare(a.at))[0]?.profile
    name = [p?.name, p?.lastName].filter(Boolean).join(" ").trim()
  } catch {
    // the ledger unreachable: fall back to the email
  }
  return { name: name || user.email.split("@")[0], icon: `${ORIGIN}/avatars/default.jpg` }
}
