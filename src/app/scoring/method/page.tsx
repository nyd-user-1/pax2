import { redirect } from "next/navigation"

// Off the sidebar (2026-10-22): what each feature was worth lives on /metrics; the rest is dropped.
export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ tab?: string; o?: string }> }) {
  const sp = await searchParams
  redirect(sp.tab === "research" ? `/metrics?tab=worth${sp.o ? `&o=${encodeURIComponent(sp.o)}` : ""}` : "/methodology")
}
