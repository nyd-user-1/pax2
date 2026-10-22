/* eslint-disable @next/next/no-img-element */
import { existsSync } from "node:fs"
import { join } from "node:path"

import { redirect } from "next/navigation"

import { ChartBlock } from "@/components/blocks"
import { OutliersBlock } from "@/components/hits-scatter-canvas"
import { TIER } from "@/components/hits-scatter"
import { VelocityLines } from "@/components/patterns-charts"
import { labVideos } from "@/lib/lab"
import { patternsData } from "@/lib/velocity-analytics"

// A tracked channel's own page (Brendan, 2026-10-22): the patterns field of velocity lines and the
// outliers view, each scoped to this channel. The lines are a channel surface: every tracked short of
// the channel at once, never one video alone. An id that is not a tracked channel is a connected
// channel's old link, and goes on to /my-channels as it always did.

export const dynamic = "force-dynamic"
export const metadata = { title: "Channel" }

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n))

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const all = await patternsData()
  const ch = all.channels.find((c) => c.id === id)
  if (!ch) redirect(`/my-channels/${id}`)
  const videos = all.videos.filter((v) => v.channelId === id)
  const data = { ...all, videos, series: Object.fromEntries(videos.filter((v) => all.series[v.id]).map((v) => [v.id, all.series[v.id]])), channels: [ch] }
  const points = labVideos().filter((v) => v.channelId === id)
  const logo = existsSync(join(process.cwd(), "public", "logos", "channels", `${id}.jpg`))
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        {logo ? <img src={`/logos/channels/${id}.jpg`} alt="" className="size-14 shrink-0 rounded-full object-cover" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pax2-lavender text-lg font-semibold text-pax2-blue">{ch.name.charAt(0)}</span>}
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display truncate text-2xl text-slate-900">{ch.name}</h1>
          <p className="tabular text-sm text-slate-500">
            {ch.subs != null ? `${compact(ch.subs)} subscribers · ` : ""}
            {ch.n} tracked · {ch.pushed} above 3x · {ch.killed} below 0.5x
            {ch.median != null ? ` · median ${compact(ch.median)} views` : ""}
          </p>
        </div>
        <a href={`https://youtube.com/channel/${id}`} target="_blank" rel="noreferrer" className="ml-auto text-sm font-medium text-pax2-light-blue hover:underline">
          YouTube
        </a>
      </header>

      <ChartBlock
        title="Velocity, every 15 minutes"
        name={`channel-velocity-${id}`}
        rows={videos.map((v) => ({ title: v.title, published: v.published, views: v.views, median: v.median ?? "", ratio: v.ratio != null ? Math.round(v.ratio * 100) / 100 : "" }))}
        height="h-[70dvh] min-h-[420px]"
      >
        {videos.length ? <VelocityLines data={data} /> : <p className="text-sm text-slate-500">The poller has not watched a short from this channel yet.</p>}
      </ChartBlock>

      {points.length ? (
        <OutliersBlock
          points={points.map((v) => ({ id: v.id, title: v.title, channel: v.channel, published: v.published, views: v.views, ratio: v.ratio, tier: v.tier }))}
          rows={points.map((v) => ({ video: v.title, iWAR: Number(v.ratio.toFixed(2)), outcome: TIER[v.tier].label }))}
          height="h-[60dvh] min-h-[380px]"
        />
      ) : (
        <ChartBlock title="Outliers" height="auto">
          <p className="text-sm text-slate-500">No settled shorts from this channel in the catalog yet.</p>
        </ChartBlock>
      )}
    </div>
  )
}
