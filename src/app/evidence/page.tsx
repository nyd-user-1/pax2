import { redirect } from "next/navigation"

// Merged into /metrics (2026-10-22). The Feature lift tab is dropped; its carry block lives on each video page.
export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(tab === "patterns" || tab === "outliers" ? `/metrics?tab=${tab}` : "/metrics")
}
