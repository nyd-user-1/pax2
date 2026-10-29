"use server"

import { cookies } from "next/headers"

import { currentUser } from "@/lib/auth"
import { isTestAccount, purgeTestAccount } from "@/lib/test-account"

// The Terms and conditions corner's Reset for the sign-up test account (src/lib/test-account.ts). It takes
// no input and removes that one account.

export async function resetTestAccount(): Promise<{ existed: boolean }> {
  const me = await currentUser()
  const r = await purgeTestAccount()
  // Signed in as the account just removed: its session goes too (the ID token would verify until it expires).
  if (isTestAccount(me?.email)) {
    const jar = await cookies()
    jar.delete("pax2_session")
    jar.delete("pax2_refresh")
  }
  return r
}
