import { OriginalsQueue } from "@/components/originals-queue"

export const dynamic = "force-dynamic"
export const metadata = { title: "Drafts" }

export default function DraftsPage() {
  return <OriginalsQueue queue="recording" />
}
