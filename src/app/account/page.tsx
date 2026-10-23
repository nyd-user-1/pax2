import { redirect } from "next/navigation"

import type { Profile } from "@/app/onboarding-actions"
import { AccountView } from "@/components/account-view"
import { currentUser } from "@/lib/auth"
import { discordServer } from "@/lib/discord"
import { query, type Item } from "@/lib/ledger"
import { slackTeam } from "@/lib/slack"

export const dynamic = "force-dynamic"
export const metadata = { title: "Account" }

export default async function AccountPage() {
  const user = await currentUser()
  if (!user) redirect("/signin?next=/account")
  const rows = await query<Item & { at: string; profile: Profile }>(`OWNER#${user.email}`, "PROFILE#").catch(() => [])
  const profile = rows.sort((a, b) => b.at.localeCompare(a.at))[0]?.profile ?? null
  const [slack, discord] = user.admin ? await Promise.all([slackTeam(), discordServer()]) : [null, null]
  return <AccountView email={user.email} admin={user.admin} profile={profile} slack={slack} discord={discord} />
}
