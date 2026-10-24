import { redirect } from "next/navigation"

import { listTests } from "@/app/message-test-actions"
import { TestList } from "@/components/message-tests/test-list"
import { currentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const metadata = { title: "Message tests" }

/** Randomized message tests run on pax (lib/message-tests.ts): set up, fielded, read here. Admins only. */
export default async function MessageTestsPage() {
  const user = await currentUser()
  if (!user) redirect("/signin?next=/message-tests")
  if (!user.admin) redirect("/chat")
  return <TestList tests={await listTests()} />
}
