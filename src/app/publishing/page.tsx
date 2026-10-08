import { OriginalsQueue } from "@/components/originals-queue"

export const dynamic = "force-dynamic"
export const metadata = { title: "Publishing" }

export default function PublishingPage() {
  return <OriginalsQueue queue="publishing" />
}
