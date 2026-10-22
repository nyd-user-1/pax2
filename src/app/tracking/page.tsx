import { redirect } from "next/navigation"

// Merged into /metrics (2026-10-22): Live and Complete keep their tab, sort and filter.
export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ tab?: string; s?: string; f?: string; v?: string }> }) {
  const sp = await searchParams
  if (sp.tab === "outliers" || sp.tab === "settled") redirect("/metrics?tab=outliers")
  const q = new URLSearchParams()
  if (sp.tab === "complete") q.set("tab", "complete")
  for (const k of ["s", "f", "v"] as const) if (sp[k]) q.set(k, sp[k]!)
  const qs = q.toString()
  redirect(`/metrics${qs ? `?${qs}` : ""}`)
}
