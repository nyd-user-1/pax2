import { OriginalsQueue } from "@/components/originals-queue"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scoring" }

export default function ScoringPage() {
  return <OriginalsQueue queue="scoring" />
}
