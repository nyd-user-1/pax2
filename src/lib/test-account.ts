import "server-only"

import { AdminDeleteUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { CognitoJwtVerifier } from "aws-jwt-verify"

import { query, remove } from "@/lib/ledger"

// The sign-up test account (Brendan, 2026-10-24): sign-up and the YouTube connect run again from the start
// once it is gone. Two paths remove it: the Terms and conditions corner's Reset (app/test-account-actions.ts)
// and signing out of it (api/auth/[action], 2026-10-29), so every sign-out re-arms the first-time flow.
//
// One account only, by construction: purgeTestAccount takes no input and deletes TEST_ACCOUNT, a constant,
// so no caller can point it at anyone else. It removes the Cognito user and every ledger row kept under the
// email (the onboarding profile, connected channels and uploads under OWNER#, chats under CHATS# and CHAT#,
// notes, boosts). The channel's own rows (YTCH#...) stay: they belong to the channel, and the next connect
// writes a fresh grant over them. The live server's role holds cognito-idp:AdminDeleteUser on the pax-2 pool.

const TEST_ACCOUNT = "brendan.stanton@gmail.com"
const OWNED = ["OWNER", "CHATS", "CHAT", "NOTES", "BOOSTED"]

export async function purgeTestAccount(): Promise<{ existed: boolean }> {
  for (const p of OWNED) for (const row of await query(`${p}#${TEST_ACCOUNT}`)) await remove(row.pk, row.sk)
  try {
    await new CognitoIdentityProviderClient({ region: process.env.PAX2_REGION ?? "us-east-1" }).send(new AdminDeleteUserCommand({ UserPoolId: process.env.PAX2_COGNITO_POOL_ID, Username: TEST_ACCOUNT }))
    return { existed: true }
  } catch (e) {
    if ((e as { name?: string }).name !== "UserNotFoundException") throw e
    return { existed: false }
  }
}

const POOL = process.env.PAX2_COGNITO_POOL_ID
const CLIENT = process.env.PAX2_COGNITO_CLIENT_ID
const verifier = POOL && CLIENT ? CognitoJwtVerifier.create({ userPoolId: POOL, tokenUse: "id", clientId: CLIENT }) : null

/** Sign-out's check: true only when the session being ended is a signature-verified ID token whose email
 *  claim is exactly TEST_ACCOUNT. It reads the token itself, not currentUser(), which answers as the admin
 *  in local development. */
export async function isTestAccountSession(token: string | undefined): Promise<boolean> {
  if (!token || !verifier) return false
  try {
    return (await verifier.verify(token)).email === TEST_ACCOUNT
  } catch {
    return false
  }
}

export const isTestAccount = (email: string | undefined | null) => email === TEST_ACCOUNT
