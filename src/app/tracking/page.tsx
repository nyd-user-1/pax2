import { TabRail } from "@/components/tab-rail"
import { CurvesTab } from "@/components/tracking/curves"
import { LiveTab } from "@/components/tracking/live"
import { SettledTab } from "@/components/tracking/settled"

// The poller's one page, replacing /live-tracking, /outliers and /velocity-tracker: what is under
// watch right now, what has settled into a verdict, and every short's curve. The old routes
// redirect in with their tab.

export const dynamic = "force-dynamic"
export const metadata = { title: "Tracking" }

const TABS = [
  { key: "live", label: "Live" },
  { key: "settled", label: "Settled" },
  { key: "curves", label: "Curves" },
]

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ tab?: string; v?: string; s?: string; f?: string }> }) {
  const sp = await searchParams
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "live"
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "live" ? "/tracking" : `/tracking?tab=${t.key}` }))} active={tab} />
      {tab === "live" ? <LiveTab /> : tab === "settled" ? <SettledTab /> : <CurvesTab focus={sp.v} s={sp.s} f={sp.f} />}
    </div>
  )
}
