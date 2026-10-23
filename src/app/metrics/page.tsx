import { redirect } from "next/navigation"

import { TabRail } from "@/components/tab-rail"
import { scatterPoints, TIER } from "@/components/hits-scatter"
import { OutliersBlock } from "@/components/hits-scatter-canvas"
import { PatternSections } from "@/components/patterns-charts"
import { FeatureWorth } from "@/components/scoring/research"
import { TrackingTab } from "@/components/tracking/live"
import { currentUser } from "@/lib/auth"
import { labVideos } from "@/lib/lab"
import { patternsData } from "@/lib/velocity-analytics"

// The research measures on one page (Brendan, 2026-10-22), merging /tracking and /evidence: the
// poller's Live and Complete tables with their curves, the catalog's patterns and outliers, and what
// each feature was worth in the randomized ad tests (from /scoring/method). The old routes redirect here.

export const dynamic = "force-dynamic"
export const metadata = { title: "Metrics" }

const TABS = [
  { key: "live", label: "Live" },
  { key: "complete", label: "Complete" },
  { key: "patterns", label: "Patterns" },
  { key: "outliers", label: "Outliers" },
  { key: "worth", label: "Feature worth" },
] as const
type Tab = (typeof TABS)[number]["key"]

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ tab?: string; s?: string; f?: string; o?: string; view?: string }> }) {
  if (!(await currentUser())) redirect("/signin?next=/metrics")
  const sp = await searchParams
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "live"
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "live" ? "/metrics" : `/metrics?tab=${t.key}` }))} active={tab} />
      {tab === "live" || tab === "complete" ? (
        <TrackingTab phase={tab} s={sp.s} f={sp.f} view={sp.view} />
      ) : tab === "patterns" ? (
        <PatternSections data={await patternsData()} />
      ) : tab === "outliers" ? (
        <OutliersBlock points={scatterPoints()} rows={labVideos().map((v) => ({ video: v.title, channel: v.channel, iWAR: Number(v.ratio.toFixed(2)), outcome: TIER[v.tier].label }))} height="h-[calc(100dvh-19.5rem)] min-h-[419px]" />
      ) : (
        <FeatureWorth o={sp.o} href={(o) => `/metrics?tab=worth&o=${o}`} />
      )}
    </div>
  )
}
