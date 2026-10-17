import { redirect } from "next/navigation"

// The flow's start moved to /recording; old links land there.
export default function StartPage() {
  redirect("/recording")
}
