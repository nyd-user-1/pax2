import { notFound, redirect } from "next/navigation"

import { loadTest } from "@/app/message-test-actions"
import { TestWorkspace } from "@/components/message-tests/test-workspace"
import { currentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const metadata = { title: "Message test" }

export default async function MessageTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/signin?next=/message-tests/${id}`)
  if (!user.admin) redirect("/chat")
  const loaded = await loadTest(id)
  if (!loaded) notFound()
  return <TestWorkspace test={loaded.test} responses={loaded.responses} />
}
