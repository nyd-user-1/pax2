import { redirect } from "next/navigation"

// Merged into /evidence's Feature lift tab.
export default function Page() {
  redirect("/metrics?tab=lift")
}
