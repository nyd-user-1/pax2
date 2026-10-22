import { redirect } from "next/navigation"

// Merged into /metrics (2026-10-22); each old tab lands on its new one.
export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(tab === "patterns" || tab === "outliers" ? `/metrics?tab=${tab}` : "/metrics?tab=lift")
}
