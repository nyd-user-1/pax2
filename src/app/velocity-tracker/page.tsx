import { redirect } from "next/navigation"

// The curves now sit on /tracking's Live and Complete tabs, each under its own table.
export default function Page() {
  redirect("/metrics")
}
