import { OriginalsQueue } from "@/components/originals-queue"

export const dynamic = "force-dynamic"
export const metadata = { title: "Recording" }

export default function RecordingPage() {
  return <OriginalsQueue queue="recording" />
}
