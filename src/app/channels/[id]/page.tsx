import { redirect } from "next/navigation"

// A connected channel's analysis lives under /my-channels; old links follow.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/my-channels/${(await params).id}`)
}
