import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand, ConfirmSignUpCommand, ForgotPasswordCommand, InitiateAuthCommand, ResendConfirmationCodeCommand, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const cip = new CognitoIdentityProviderClient({ region: process.env.HERMES_REGION ?? "us-east-1" })
const CLIENT = process.env.HERMES_COGNITO_CLIENT_ID

const FRIENDLY: Record<string, string> = {
  UsernameExistsException: "That email already has an account — sign in instead.",
  InvalidPasswordException: "Password needs 8+ characters with an upper, a lower, a number and a symbol.",
  InvalidParameterException: "That doesn't look like a valid email.",
  CodeMismatchException: "That code doesn't match — check the email and try again.",
  ExpiredCodeException: "That code expired — request a fresh one below.",
  NotAuthorizedException: "Wrong email or password.",
  UserNotFoundException: "No account with that email — sign up first.",
  LimitExceededException: "Too many tries — wait a minute and try again.",
  TooManyRequestsException: "Too many tries — wait a minute and try again.",
}

// The signed-in user for the sidebar's account chip: the claims of the Cognito ID token in hermes_session.
// Display only — nothing here authorizes anything.
export async function GET(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action !== "me") return NextResponse.json({ error: "Unknown action" }, { status: 404 })
  const token = (await cookies()).get("hermes_session")?.value
  if (!token) return NextResponse.json({ user: null })
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { email?: string; name?: string; exp?: number }
    if (claims.exp && claims.exp * 1000 < Date.now()) return NextResponse.json({ user: null })
    const email = claims.email ?? ""
    return NextResponse.json({ user: { email, name: claims.name ?? email.split("@")[0] } })
  } catch {
    return NextResponse.json({ user: null })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if ((await params).action === "signout") {
    const jar = await cookies()
    jar.delete("hermes_session")
    jar.delete("hermes_refresh")
    return NextResponse.json({ ok: true })
  }
  if (!CLIENT) return NextResponse.json({ error: "Auth isn't configured in this environment." }, { status: 503 })
  const { action } = await params
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; code?: string }
  const email = (body.email ?? "").trim().toLowerCase()
  try {
    if (action === "signup") {
      await cip.send(new SignUpCommand({ ClientId: CLIENT, Username: email, Password: body.password, UserAttributes: [{ Name: "email", Value: email }] }))
      return NextResponse.json({ ok: true })
    }
    if (action === "confirm") {
      await cip.send(new ConfirmSignUpCommand({ ClientId: CLIENT, Username: email, ConfirmationCode: (body.code ?? "").trim() }))
      return NextResponse.json({ ok: true })
    }
    if (action === "resend") {
      await cip.send(new ResendConfirmationCodeCommand({ ClientId: CLIENT, Username: email }))
      return NextResponse.json({ ok: true })
    }
    if (action === "forgot") {
      await cip.send(new ForgotPasswordCommand({ ClientId: CLIENT, Username: email }))
      return NextResponse.json({ ok: true })
    }
    if (action === "reset") {
      await cip.send(new ConfirmForgotPasswordCommand({ ClientId: CLIENT, Username: email, ConfirmationCode: (body.code ?? "").trim(), Password: body.password ?? "" }))
      return NextResponse.json({ ok: true })
    }
    if (action === "signin") {
      const r = await cip.send(new InitiateAuthCommand({ ClientId: CLIENT, AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email, PASSWORD: body.password ?? "" } }))
      const t = r.AuthenticationResult
      if (!t?.IdToken) return NextResponse.json({ error: "Sign-in needs a step this flow doesn't support yet." }, { status: 400 })
      const jar = await cookies()
      jar.set("hermes_session", t.IdToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: t.ExpiresIn ?? 3600, path: "/" })
      // The refresh token keeps the reader signed in past the hour (src/proxy.ts renews the session).
      if (t.RefreshToken) jar.set("hermes_refresh", t.RefreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 86_400, path: "/" })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 404 })
  } catch (e) {
    const name = (e as { name?: string }).name ?? ""
    // An unconfirmed account isn't an error — it's the next step.
    if (name === "UserNotConfirmedException") return NextResponse.json({ confirm: true }, { status: 409 })
    if (action === "reset" && name === "InvalidParameterException") return NextResponse.json({ error: FRIENDLY.InvalidPasswordException }, { status: 400 })
    return NextResponse.json({ error: FRIENDLY[name] ?? "Something went wrong — try again." }, { status: 400 })
  }
}
