import { SectionTitle } from "@/components/ui-hermes"
import { ChannelStrips, EngagementScatter, PublishHeatmap, SubsScatter, VelocityLines } from "@/components/patterns-charts"
import { patternsData } from "@/lib/velocity-analytics"

export const metadata = { title: "Patterns" }
export const dynamic = "force-dynamic"

export default async function PatternsPage() {
  const data = await patternsData()
  const sections: { title: string; count: string; chart: React.ReactNode }[] = [
    { title: "Velocity, every 15 minutes", count: `${data.readings.toLocaleString()} readings since ${data.start}`, chart: <VelocityLines data={data} /> },
    { title: "Publish times", count: `${data.videos.length} videos`, chart: <PublishHeatmap data={data} /> },
    { title: "Channels", count: `${data.channels.length} channels`, chart: <ChannelStrips data={data} /> },
    { title: "Subscribers", count: "every video against its channel's size", chart: <SubsScatter data={data} /> },
    { title: "Engagement", count: "likes against reach", chart: <EngagementScatter data={data} /> },
  ]
  return (
    <div className="flex flex-col gap-16">
      {sections.map((s) => (
        <section key={s.title} className="flex min-h-[92dvh] flex-col gap-4">
          <SectionTitle title={s.title} className="items-center" action={<span className="tabular text-sm text-slate-500">{s.count}</span>} />
          <div className="min-h-0 flex-1">{s.chart}</div>
        </section>
      ))}
    </div>
  )
}
