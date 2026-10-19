import { Suspense } from "react"
import { redirect } from "next/navigation"

import { loadProfile, myChannels } from "@/app/onboarding-actions"
import { Stepper } from "@/components/onboarding/stepper"
import { currentUser } from "@/lib/auth"

// Onboarding, right after account creation at /signup. Under /sign so the shell leaves it full bleed.

export const dynamic = "force-dynamic"
export const metadata = { title: "Welcome" }

export default async function WelcomePage() {
  if (!(await currentUser())) redirect(`/signin?next=${encodeURIComponent("/signup/welcome")}`)
  const [profile, channels] = await Promise.all([loadProfile(), myChannels()])
  return (
    <Suspense>
      <Stepper initial={profile} channels={channels.map((c) => ({ channelId: c.channelId, title: c.title, thumbnail: c.thumbnail, progress: c.progress }))} />
    </Suspense>
  )
}
