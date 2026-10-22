import { redirect } from "next/navigation"

// Merged into /evidence's Patterns tab.
export default function Page() {
  redirect("/metrics?tab=patterns")
}
