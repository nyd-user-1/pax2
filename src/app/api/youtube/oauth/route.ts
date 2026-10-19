import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { SITE } from "@/lib/mail"
import { kick, startRun } from "@/lib/channel-ingest"
import { authUrl, completeGrant, configured, type GrantMode } from "@/lib/youtube"

// YouTube grants (src/lib/youtube.ts). GET without a code sends the signed-in user to Google's consent
// screen; GET with Google's code stores the grant and sends them back.
//
//   /api/youtube/oauth                      an admin: the publish grant (requirement 7), lands on /publishing.
//                                           Anyone else: a connect grant.
//   /api/youtube/oauth?mode=connect&return=/signup/welcome
//                                           any signed-in user: a read-only connect grant for one channel,
//                                           lands on `return` with ?channel=<id>.
//
// The state carries the mode, the user's email and the return path; the email is checked on the way back
// so a stray code from another session is refused.

const safePath = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : null)

export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.redirect(`${SITE}/signin?next=${encodeURIComponent("/signup/welcome")}`)
  // A demo account never holds a grant: no stored token, no channel row, no ingest run.
  if (user.demo) return NextResponse.redirect(`${SITE}/channels?youtube_error=${encodeURIComponent("A demo account can't connect a channel.")}`)
  if (!configured()) return NextResponse.json({ error: "PAX2_GOOGLE_CLIENT_ID and PAX2_GOOGLE_CLIENT_SECRET are not set on the server." }, { status: 503 })
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const err = url.searchParams.get("error")
  if (!code && !err) {
    const asked = url.searchParams.get("mode")
    const mode: GrantMode = asked === "connect" || !user.admin ? "connect" : "publish"
    const back = safePath(url.searchParams.get("return")) ?? (mode === "publish" ? "/videos?q=publishing" : "/channels")
    return NextResponse.redirect(authUrl(JSON.stringify({ m: mode, e: user.email, r: back }), mode))
  }
  let state: { m?: string; e?: string; r?: string }
  try {
    state = JSON.parse(url.searchParams.get("state") ?? "")
  } catch {
    // A consent screen opened before the state carried a mode: the admin publish grant.
    state = { m: "publish", e: url.searchParams.get("state") ?? "", r: "/videos?q=publishing" }
  }
  if (state.e !== user.email) return NextResponse.json({ error: "That grant belongs to another session." }, { status: 400 })
  const mode: GrantMode = state.m === "publish" && user.admin ? "publish" : "connect"
  const back = safePath(state.r ?? null) ?? "/channels"
  if (err || !code) return NextResponse.redirect(`${SITE}${back}${back.includes("?") ? "&" : "?"}youtube_error=${encodeURIComponent(err ?? "no code")}`)
  try {
    const ch = await completeGrant(code, user.email, mode)
    // The channel's public videos go to the Lambda now; the user moves on while it runs.
    if (mode === "connect") {
      await startRun(ch.channelId, user.email, true)
      await kick(ch.channelId, user.email)
    }
    const sep = back.includes("?") ? "&" : "?"
    return NextResponse.redirect(mode === "publish" ? `${SITE}${back}${sep}youtube=${encodeURIComponent(ch.title)}` : `${SITE}${back}${sep}channel=${ch.channelId}`)
  } catch (e) {
    return NextResponse.redirect(`${SITE}${back}${back.includes("?") ? "&" : "?"}youtube_error=${encodeURIComponent((e as Error).message)}`)
  }
}
