import { notFound, redirect } from "next/navigation"

import { CardBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { ChannelCard } from "@/components/onboarding/ingest"
import { currentUser } from "@/lib/auth"
import { progress } from "@/lib/channel-ingest"
import { channelReport, type VideoReport } from "@/lib/channel-report"
import { connectedChannels, mayRead } from "@/lib/youtube"
import { cn } from "@/ui/lib/utils"

// One connected channel's analysis: every video with its YouTube Analytics, retention curve, PAX2
// Classifier forecast where it applies, and content analysis where the file has been read
// (src/lib/channel-report.ts says which tier each video has and why).

export const dynamic = "force-dynamic"
export const metadata = { title: "Channel" }

const n = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("en-US"))
const pct = (v: number | null | undefined, digits = 0) => (v == null ? "–" : `${v.toFixed(digits)}%`)
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
const length = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`)

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/channels/${id}`)}`)
  if (!/^UC[\w-]{22}$/.test(id) || !(await mayRead(user.email, user.admin, id))) notFound()
  const [report, run, mine] = await Promise.all([channelReport(id, user.email), progress(id), connectedChannels(user.email)])
  const conn = mine.find((c) => c.channelId === id)
  const title = report?.channel.title ?? conn?.title ?? "Channel"
  const running = run?.phase !== "done"
  const v = report?.videos ?? []
  const shorts = v.filter((x) => x.short).length
  const content = v.filter((x) => x.content).length
  const forecast = v.filter((x) => x.forecast).length

  return (
    <div className="flex flex-col">
      <BlockOrder page="channel" initial={["channel", "videos"]}>
        <OrderedBlock id="channel" label={title}>
          <CardBlock title={title} height="auto" footer={report ? `Collected from the YouTube Data API and YouTube Analytics API ${date(report.runAt)}.${report.impressions === "no" ? " YouTube Analytics did not return thumbnail impressions for this channel." : ""}` : undefined}>
            <div className="flex flex-col gap-4">
              <ChannelCard channelId={id} title={title} thumbnail={conn?.thumbnail ?? report?.channel.thumbnail ?? null} initial={run} className="max-w-xl" />
              {report && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Stat label="Videos" value={n(v.length)} />
                  <Stat label="Shorts" value={n(shorts)} />
                  <Stat label="Subscribers" value={n(report.channel.subscribers)} />
                  <Stat label="Median views, settled Shorts" value={report.channelMedian != null ? n(report.channelMedian) : `${report.settledShorts} of ${report.minSettled} needed`} />
                  <Stat label="PAX2 Classifier forecasts" value={`${forecast} of ${v.length}`} />
                  <Stat label="Content analyzed" value={`${content} of ${v.length}`} />
                </div>
              )}
            </div>
          </CardBlock>
        </OrderedBlock>
        <OrderedBlock id="videos" label="Videos">
          <TableBlock title="Videos" search="Search videos" rows={v.map(row)} name={`${title} videos`}>
            {v.length ? <Videos rows={v} /> : <p className="text-sm text-slate-500">{running ? "The videos appear as the channel is read." : "No public videos on this channel."}</p>}
          </TableBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}

/** What the menu's Download writes, one row per video. */
const row = (x: VideoReport) => ({
  youtubeId: x.video.youtubeId, title: x.video.title, published: x.video.published, durationSec: x.video.durationSec, views: x.video.views,
  averageViewDuration: x.stat?.averageViewDuration ?? null, averageViewPercentage: x.stat?.averageViewPercentage ?? null, estimatedMinutesWatched: x.stat?.estimatedMinutesWatched ?? null,
  impressions: x.stat?.impressions ?? null, impressionsCtr: x.stat?.impressionsCtr ?? null, chanceOfHit: x.forecast?.p ?? null, expectedViews: x.forecast?.expected ?? null, ratioToMedian: x.ratio,
  contentAnalyzed: !!x.content,
})

function Curve({ watch }: { watch: number[] }) {
  if (watch.length < 2) return <span className="text-slate-400">–</span>
  const max = Math.max(1, ...watch)
  const pts = watch.map((w, i) => `${((i / (watch.length - 1)) * 80).toFixed(1)},${(22 - (w / max) * 20).toFixed(1)}`).join(" ")
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20" aria-label="Audience retention">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-pax2-light-blue" />
    </svg>
  )
}

function Tiers({ x }: { x: VideoReport }) {
  const chip = "rounded-full px-2 py-0.5 text-[11px] font-medium"
  return (
    <span className="flex flex-wrap gap-1">
      <span className={cn(chip, x.stat ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-400")}>Analytics</span>
      <span title={x.noForecast ?? undefined} className={cn(chip, x.forecast ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-100 text-slate-400")}>Forecast</span>
      <span title={x.content ? undefined : "No video file yet: upload it from onboarding, or wait for PAX to fetch it."} className={cn(chip, x.content ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>Content</span>
    </span>
  )
}

function Videos({ rows }: { rows: VideoReport[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-5 [&_th]:font-medium">
            <th>Video</th>
            <th>Published</th>
            <th>Length</th>
            <th className="text-right">Views</th>
            <th className="text-right">Avg viewed</th>
            <th className="text-right">Impressions</th>
            <th className="text-right">CTR</th>
            <th>Retention</th>
            <th className="text-right">Chance of a Hit</th>
            <th className="text-right">vs median</th>
            <th>Analysis</th>
          </tr>
        </thead>
        <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-5">
          {rows.map((x) => (
            <tr key={x.video.youtubeId}>
              <td className="max-w-[22rem]">
                <a href={`https://youtube.com/watch?v=${x.video.youtubeId}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 font-medium text-slate-900 hover:text-pax2-light-blue">
                  {x.video.thumbnail ? <img src={x.video.thumbnail} alt="" className="h-9 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-9 w-16 shrink-0 rounded-md bg-slate-100" />}
                  <span className="truncate">{x.video.title}</span>
                  {x.video.privacy !== "public" && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{x.video.privacy === "unlisted" ? "Unlisted" : "Private"}</span>}
                </a>
              </td>
              <td className="tabular text-slate-600">{date(x.video.published)}</td>
              <td className="tabular text-slate-600">{length(x.video.durationSec)}{x.short && <span className="ml-1.5 text-[11px] text-slate-400">Short</span>}</td>
              <td className="tabular text-right">{n(x.video.views)}</td>
              <td className="tabular text-right">{x.stat?.averageViewDuration != null ? `${n(x.stat.averageViewDuration)}s · ${pct(x.stat.averageViewPercentage)}` : "–"}</td>
              <td className="tabular text-right">{n(x.stat?.impressions)}</td>
              <td className="tabular text-right">{pct(x.stat?.impressionsCtr, 1)}</td>
              <td><Curve watch={x.curve?.watch ?? []} /></td>
              <td className="tabular text-right" title={x.noForecast ?? (x.forecast?.top.length ? `Strongest inputs: ${x.forecast.top.map((t) => t.label).join(", ")}` : undefined)}>
                {x.forecast ? `${(x.forecast.p * 100).toFixed(0)}%` : <span className="text-slate-400">–</span>}
              </td>
              <td className="tabular text-right">{x.ratio != null ? `${x.ratio.toFixed(1)}x` : <span className="text-slate-400">–</span>}</td>
              <td><Tiers x={x} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
