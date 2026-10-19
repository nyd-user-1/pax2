import { redirect } from "next/navigation"

// The queues merged into /videos; old links keep their filter.
export default function Page() {
  redirect("/my-videos?q=publishing")
}
