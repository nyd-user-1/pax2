import { TabRail } from "@/components/tab-rail"
import { TrackingTab } from "@/components/tracking/live"
import { currentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

// What the poller measures, on two tabs: Live (shorts inside their 72-hour window) and Complete (shorts
// past it). Each tab is its table and the same shorts' curves; Live also carries the snapshot. The old
// Velocity tab's curves now live on each tab; the old Outliers tab moved to /evidence.

export const dynamic = "force-dynamic"
export const metadata = { title: "Tracking" }

const TABS = [
  { key: "live", label: "Live" },
  { key: "complete", label: "Complete" },
]

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ tab?: string; s?: string; f?: string }> }) {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/tracking")
  const sp = await searchParams
  if (sp.tab === "outliers" || sp.tab === "settled") redirect("/evidence?tab=outliers")
  const tab = sp.tab === "complete" ? "complete" : "live"
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "live" ? "/tracking" : `/tracking?tab=${t.key}` }))} active={tab} />
      <TrackingTab phase={tab} s={sp.s} f={sp.f} />
    </div>
  )
}
