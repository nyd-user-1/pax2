import "server-only"

import { CognitoJwtVerifier } from "aws-jwt-verify"
import { cookies } from "next/headers"

import { DEMO_ADMIN, DEMO_EMAILS } from "@/lib/demo"

// The signed-in user, from the Cognito ID token in the pax2_session cookie — verified against the
// pool's signing keys, so this one can authorize. Admins are the pool's "admins" group plus anyone
// listed in ADMIN_EMAILS (so a new admin is one the moment they confirm their account).

const POOL = process.env.PAX2_COGNITO_POOL_ID
const CLIENT = process.env.PAX2_COGNITO_CLIENT_ID
const verifier = POOL && CLIENT ? CognitoJwtVerifier.create({ userPoolId: POOL, tokenUse: "id", clientId: CLIENT }) : null
const ADMINS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)

export type SessionUser = { email: string; admin: boolean; demo: boolean }

export async function currentUser(): Promise<SessionUser | null> {
  // Local development skips sign-in entirely: the dev server acts as the first admin.
  // `next build` sets NODE_ENV=production, so no deployed build can take this branch.
  if (process.env.NODE_ENV === "development") return { email: ADMINS[0] ?? "brendan@nysgpt.com", admin: true, demo: false }
  const token = (await cookies()).get("pax2_session")?.value
  if (!token || !verifier) return null
  try {
    const claims = await verifier.verify(token)
    const email = String(claims.email ?? "").toLowerCase()
    const groups = (claims["cognito:groups"] as string[] | undefined) ?? []
    // The demo admin gets the admin surfaces by email alone, never the pool's admins group,
    // so removing the account removes the role with it.
    return { email, admin: groups.includes("admins") || ADMINS.includes(email) || email === DEMO_ADMIN, demo: DEMO_EMAILS.has(email) }
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user?.admin) throw new Error("Admins only.")
  return user
}

/** The demo sandbox's wall: anything that publishes, rescores, or moves a lever calls this first. */
export function forbidDemo(user: { demo?: boolean } | null) {
  if (user?.demo) throw new Error("A demo account can look at everything here and change nothing real.")
}
