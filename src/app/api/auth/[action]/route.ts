import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand, ConfirmSignUpCommand, ForgotPasswordCommand, InitiateAuthCommand, ResendConfirmationCodeCommand, SignUpCommand, type AuthenticationResultType } from "@aws-sdk/client-cognito-identity-provider"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const cip = new CognitoIdentityProviderClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
const CLIENT = process.env.PAX2_COGNITO_CLIENT_ID

const FRIENDLY: Record<string, string> = {
  UsernameExistsException: "That email already has an account. Sign in, or reset its password from the sign-in page.",
  InvalidPasswordException: "Password needs 8+ characters with an upper, a lower, a number and a symbol.",
  InvalidParameterException: "That doesn't look like a valid email.",
  CodeMismatchException: "That code doesn't match — check the email and try again.",
  ExpiredCodeException: "That code expired — request a fresh one below.",
  NotAuthorizedException: "Wrong email or password.",
  UserNotFoundException: "No account with that email — sign up first.",
  LimitExceededException: "Too many tries — wait a minute and try again.",
  TooManyRequestsException: "Too many tries — wait a minute and try again.",
}

const signIn = (email: string, password: string) =>
  cip.send(new InitiateAuthCommand({ ClientId: CLIENT, AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: email, PASSWORD: password } }))

const startSession = async (t: AuthenticationResultType) => {
  const jar = await cookies()
  jar.set("pax2_session", t.IdToken ?? "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: t.ExpiresIn ?? 3600, path: "/" })
  // The refresh token keeps the reader signed in past the hour (src/proxy.ts renews the session).
  if (t.RefreshToken) jar.set("pax2_refresh", t.RefreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 86_400, path: "/" })
}

// The signed-in user for the sidebar's account chip: the claims of the Cognito ID token in pax2_session.
// Display only — nothing here authorizes anything.
export async function GET(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action !== "me") return NextResponse.json({ error: "Unknown action" }, { status: 404 })
  const token = (await cookies()).get("pax2_session")?.value
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
    jar.delete("pax2_session")
    jar.delete("pax2_refresh")
    return NextResponse.json({ ok: true })
  }
  if (!CLIENT) return NextResponse.json({ error: "Auth isn't configured in this environment." }, { status: 503 })
  const { action } = await params
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; code?: string }
  const email = (body.email ?? "").trim().toLowerCase()
  try {
    if (action === "signup") {
      try {
        await cip.send(new SignUpCommand({ ClientId: CLIENT, Username: email, Password: body.password, UserAttributes: [{ Name: "email", Value: email }] }))
      } catch (e) {
        if ((e as { name?: string }).name !== "UsernameExistsException") throw e
        // The email already has an account. Its password signs the reader in. An account registered but
        // never confirmed (the tab closed before the code went in) gets a fresh code and the form's code
        // step. Anything else hears "sign in, or reset". The resend waits on this check: Cognito accepts a
        // resend for a confirmed account too and mails a code that can never confirm it (2026-10-23).
        try {
          const t = (await signIn(email, body.password ?? "")).AuthenticationResult
          if (!t?.IdToken) throw e
          await startSession(t)
          return NextResponse.json({ ok: true, signedIn: true })
        } catch (a) {
          if ((a as { name?: string }).name !== "UserNotConfirmedException") throw e
          await cip.send(new ResendConfirmationCodeCommand({ ClientId: CLIENT, Username: email }))
          return NextResponse.json({ ok: true, resent: true })
        }
      }
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
      const t = (await signIn(email, body.password ?? "")).AuthenticationResult
      if (!t?.IdToken) return NextResponse.json({ error: "Sign-in needs a step this flow doesn't support yet." }, { status: 400 })
      await startSession(t)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 404 })
  } catch (e) {
    const name = (e as { name?: string }).name ?? ""
    // An unconfirmed account isn't an error — it's the next step.
    if (name === "UserNotConfirmedException") return NextResponse.json({ confirm: true }, { status: 409 })
    // A code entered for an account that is already confirmed: Cognito names it NotAuthorizedException,
    // which would otherwise read as "Wrong email or password".
    if (action === "confirm" && name === "NotAuthorizedException") return NextResponse.json({ error: "That email already has a confirmed account. Sign in, or reset its password from the sign-in page." }, { status: 400 })
    // Cognito answers a password under 6 characters with InvalidParameterException, the same name it uses
    // for a malformed email: read its message, so a short password never reads as a bad email.
    const said = String((e as { message?: string }).message ?? "")
    if (name === "InvalidParameterException" && (action === "reset" || /password/i.test(said))) return NextResponse.json({ error: FRIENDLY.InvalidPasswordException }, { status: 400 })
    return NextResponse.json({ error: FRIENDLY[name] ?? "Something went wrong — try again." }, { status: 400 })
  }
}
