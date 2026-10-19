import { TabRail } from "@/components/tab-rail"
import { LiftTab } from "@/components/evidence/lift"
import { PatternSections } from "@/components/patterns-charts"
import { patternsData } from "@/lib/velocity-analytics"
import { currentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

// What travels, on one page, replacing /feature-lift and /patterns: the within-channel trait
// lifts with the Upworthy priors beside the catalog's pattern charts. The old routes redirect in.

export const dynamic = "force-dynamic"
export const metadata = { title: "Evidence" }

const TABS = [
  { key: "lift", label: "Feature lift" },
  { key: "patterns", label: "Patterns" },
]

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/evidence")
  const sp = await searchParams
  const tab = sp.tab === "patterns" ? "patterns" : "lift"
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "lift" ? "/evidence" : `/evidence?tab=${t.key}` }))} active={tab} />
      {tab === "lift" ? <LiftTab /> : <PatternSections data={await patternsData()} />}
    </div>
  )
}
