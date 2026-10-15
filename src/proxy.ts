import { NextResponse, type NextRequest } from "next/server"

// Keeps a reader signed in. Cognito's ID token, the hermes_session cookie, lasts an hour; the refresh token
// beside it (hermes_refresh) lasts 30 days. When the session is missing or about to lapse, this swaps in a
// fresh one before the page renders, so the page itself already sees the reader as signed in.

const CLIENT = process.env.HERMES_COGNITO_CLIENT_ID
const REGION = process.env.HERMES_REGION ?? "us-east-1"

const expiresSoon = (token: string) => {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return !exp || exp * 1000 < Date.now() + 60_000
  } catch {
    return true
  }
}

export async function proxy(req: NextRequest) {
  const session = req.cookies.get("hermes_session")?.value
  const refresh = req.cookies.get("hermes_refresh")?.value
  if (!refresh || !CLIENT || (session && !expiresSoon(session))) return NextResponse.next()

  const r = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" },
    body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: CLIENT, AuthParameters: { REFRESH_TOKEN: refresh } }),
  }).catch(() => null)
  const t = r?.ok ? ((await r.json()) as { AuthenticationResult?: { IdToken?: string; ExpiresIn?: number } }).AuthenticationResult : undefined
  if (!t?.IdToken) {
    // The refresh token is no good (revoked, or past 30 days): sign the reader out cleanly.
    const res = NextResponse.next()
    if (r) res.cookies.delete("hermes_refresh")
    return res
  }
  req.cookies.set("hermes_session", t.IdToken)
  const res = NextResponse.next({ request: { headers: req.headers } })
  res.cookies.set("hermes_session", t.IdToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: t.ExpiresIn ?? 3600, path: "/" })
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos/|api/video/).*)"],
}
