import "@xyflow/react/dist/style.css"

import { notFound, redirect } from "next/navigation"

import labTested from "../../../data/generated/lab-tested.json"
import { FactoryCanvas, type FactoryCounts } from "@/components/factory-canvas"
import { accounting, asOf } from "@/lib/accounting"
import { currentUser } from "@/lib/auth"
import { feedIndex } from "@/lib/feed-data"
import { snapshots } from "@/lib/velocity-store"

export const dynamic = "force-dynamic"
export const metadata = { title: "ERD" }

// The whole factory on one canvas. Every number is one cheap read at render: the catalog from the feed
// index, composition from the Lab Tested list, the poller's last snapshot, and the counts
// scripts/accounting.mjs last wrote (media held, index, transcripts), each shown with that run's date.

export default async function FactoryPage() {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/erd")
  if (!gatekeeper.admin) notFound()

  const [catalog, snaps] = await Promise.all([
    feedIndex().then((all) => all.length).catch(() => null),
    snapshots().catch(() => []),
  ])
  const snap = snaps.at(-1) ?? null
  const counts: FactoryCounts = {
    catalog,
    composition: (labTested as string[]).length,
    media: accounting.counts.media,
    index: accounting.counts.index,
    transcripts: accounting.counts.transcript,
    asOf: asOf(),
    window: snap?.tracking ?? null,
    channels: snap?.channels ?? null,
  }
  return <FactoryCanvas counts={counts} />
}
