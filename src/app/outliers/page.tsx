import { redirect } from "next/navigation"

// Moved to /evidence's Outliers tab.
export default function Page() {
  redirect("/metrics?tab=outliers")
}
