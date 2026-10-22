import { redirect } from "next/navigation"

// Merged into /tracking's Live tab.
export default function Page() {
  redirect("/metrics")
}
