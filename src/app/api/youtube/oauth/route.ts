import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { SITE } from "@/lib/mail"
import { authUrl, completeGrant, configured } from "@/lib/youtube"

// The YouTube grant, requirement 7. GET without a code: an admin is sent to Google's consent screen for
// the channel's owner or Editor to sign in. GET with Google's code: the refresh token goes to SSM, the
// channel to the DynamoDB table, and the admin lands on /publishing. The state is the admin's email,
// checked on the way back so a stray code from another session is refused.
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ error: "Sign in as an admin first." }, { status: 403 })
  if (!configured()) return NextResponse.json({ error: "PAX2_GOOGLE_CLIENT_ID and PAX2_GOOGLE_CLIENT_SECRET are not set on the server." }, { status: 503 })
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  if (!code) return NextResponse.redirect(authUrl(user.email))
  if (url.searchParams.get("state") !== user.email) return NextResponse.json({ error: "That grant belongs to another session." }, { status: 400 })
  try {
    const ch = await completeGrant(code, user.email)
    return NextResponse.redirect(`${SITE}/publishing?youtube=${encodeURIComponent(ch.title)}`)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
