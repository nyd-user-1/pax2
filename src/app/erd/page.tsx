import "@xyflow/react/dist/style.css"

import { notFound, redirect } from "next/navigation"

import { FactoryCanvas } from "@/components/factory-canvas"
import { currentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const metadata = { title: "ERD" }

// The whole factory on one canvas: what enters, what measures, what learns and what loops back.

export default async function FactoryPage() {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/erd")
  if (!gatekeeper.admin) notFound()
  return <FactoryCanvas />
}
