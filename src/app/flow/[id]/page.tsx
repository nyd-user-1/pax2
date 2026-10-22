import { redirect } from "next/navigation"

// Off the sidebar and folded into /metrics (2026-10-22).
export default function FlowRecipePage() {
  redirect("/metrics")
}
