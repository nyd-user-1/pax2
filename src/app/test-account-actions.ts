"use server"

import { AdminDeleteUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { cookies } from "next/headers"

import { currentUser } from "@/lib/auth"
import { query, remove } from "@/lib/ledger"

// The sign-up test account (Brendan, 2026-10-24): the Terms and conditions corner resets it, so sign-up and
// the YouTube connect can be run again from the start. The reset takes no input and touches this one account
// only: its Cognito user, and every ledger row kept under its email (the onboarding profile, connected
// channels and uploads under OWNER#, chats under CHATS# and CHAT#, notes, boosts). The channel's own rows
// (YTCH#...) stay: they belong to the channel, and the next connect writes a fresh grant over them.
// The live server's role holds cognito-idp:AdminDeleteUser on the pax-2 pool for this.

const TEST_ACCOUNT = "brendan.stanton@gmail.com"
const OWNED = ["OWNER", "CHATS", "CHAT", "NOTES", "BOOSTED"]

export async function resetTestAccount(): Promise<{ existed: boolean }> {
  const me = await currentUser()
  for (const p of OWNED) for (const row of await query(`${p}#${TEST_ACCOUNT}`)) await remove(row.pk, row.sk)
  let existed = true
  try {
    await new CognitoIdentityProviderClient({ region: process.env.PAX2_REGION ?? "us-east-1" }).send(new AdminDeleteUserCommand({ UserPoolId: process.env.PAX2_COGNITO_POOL_ID, Username: TEST_ACCOUNT }))
  } catch (e) {
    if ((e as { name?: string }).name !== "UserNotFoundException") throw e
    existed = false
  }
  // Signed in as the account just removed: its session goes too (the ID token would verify until it expires).
  if (me?.email === TEST_ACCOUNT) {
    const jar = await cookies()
    jar.delete("pax2_session")
    jar.delete("pax2_refresh")
  }
  return { existed }
}
