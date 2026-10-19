import { FlowsHome } from "@/components/flow/flows-home"
import { currentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata = { title: "Flows" }

export default async function FlowPage() {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/flow")
  return <FlowsHome />
}
