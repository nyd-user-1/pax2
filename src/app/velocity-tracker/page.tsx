import { redirect } from "next/navigation"

// Merged into /tracking's Curves tab; the focus, sort and filter carry over.
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string; f?: string }> }) {
  const sp = await searchParams
  const q = new URLSearchParams({ tab: "curves" })
  if (sp.v) q.set("v", sp.v)
  if (sp.s) q.set("s", sp.s)
  if (sp.f) q.set("f", sp.f)
  redirect(`/tracking?${q.toString()}`)
}
