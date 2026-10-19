import { redirect } from "next/navigation"

// Merged into /tracking's Settled tab.
export default function Page() {
  redirect("/tracking?tab=settled")
}
