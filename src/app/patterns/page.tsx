import { PatternSections } from "@/components/patterns-charts"
import { patternsData } from "@/lib/velocity-analytics"

export const metadata = { title: "Patterns" }
export const dynamic = "force-dynamic"

export default async function PatternsPage() {
  const data = await patternsData()
  return <PatternSections data={data} />
}
