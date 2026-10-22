import { redirect } from "next/navigation"

// Dropped 2026-10-22; its carry block lives on each video page.
export default function Page() {
  redirect("/metrics")
}
