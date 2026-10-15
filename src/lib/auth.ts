import "server-only"

import { CognitoJwtVerifier } from "aws-jwt-verify"
import { cookies } from "next/headers"

// The signed-in user, from the Cognito ID token in the hermes_session cookie — verified against the
// pool's signing keys, so this one can authorize. Admins are the pool's "admins" group plus anyone
// listed in ADMIN_EMAILS (so a new admin is one the moment they confirm their account).

const POOL = process.env.HERMES_COGNITO_POOL_ID
const CLIENT = process.env.HERMES_COGNITO_CLIENT_ID
const verifier = POOL && CLIENT ? CognitoJwtVerifier.create({ userPoolId: POOL, tokenUse: "id", clientId: CLIENT }) : null
const ADMINS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)

export type SessionUser = { email: string; admin: boolean }

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get("hermes_session")?.value
  if (!token || !verifier) return null
  try {
    const claims = await verifier.verify(token)
    const email = String(claims.email ?? "").toLowerCase()
    const groups = (claims["cognito:groups"] as string[] | undefined) ?? []
    return { email, admin: groups.includes("admins") || ADMINS.includes(email) }
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user?.admin) throw new Error("Admins only.")
  return user
}
