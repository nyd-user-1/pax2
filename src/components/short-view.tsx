import shorts from "../../data/raw/yt-shorts.json"
import { Fold } from "@/components/fold"
import { Loudness, Observations, Player, SeekProvider } from "@/components/workbench"
import { featuresFor } from "@/lib/catalog"
import { channelById, median, secs } from "@/lib/channels"
import { cn } from "@/ui/lib/utils"

type Yt = { fetchedAt: string; videos: { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

/** A campaign short: the video, its public counts against the channel's own median, and what the box found. */
export function ShortView({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const ytId = id.replace(/^yt-/, "")
  const data = shorts as unknown as Yt
  const v = data.videos.find((x) => x.id === ytId)
  const f = featuresFor(id)
  const ch = v ? channelById(v.channelId) : undefined
  const asOf = data.fetchedAt.slice(0, 10)
  const days = v ? Math.max(1, (Date.parse(asOf) - Date.parse(v.published)) / 864e5) : 1
  const perDay = v?.views != null ? v.views / days : null
  const channelMedian = v
    ? median(
        data.videos
          .filter((x) => x.channelId === v.channelId && x.views != null)
          .map((x) => x.views! / Math.max(1, (Date.parse(asOf) - Date.parse(x.published)) / 864e5)),
      )
    : null
  // Organic, 0-100: views/day over the channel's own median, ranked among every tracked short.
  // Normalizing by channel strips channel size; the percentile places the video, 50 = middle.
  const perDayOf = (x: { views: number | null; published: string }) => x.views! / Math.max(1, (Date.parse(asOf) - Date.parse(x.published)) / 864e5)
  const chMedians = new Map(
    [...new Set(data.videos.map((x) => x.channelId))].map((cid) => [cid, median(data.videos.filter((x) => x.channelId === cid && x.views != null).map(perDayOf))]),
  )
  const ratios = data.videos
    .filter((x) => x.views != null && (chMedians.get(x.channelId) ?? 0) > 0)
    .map((x) => perDayOf(x) / chMedians.get(x.channelId)!)
  const mine = perDay != null && channelMedian ? perDay / channelMedian : null
  const organic = mine != null && ratios.length ? Math.round((100 * (ratios.filter((r) => r < mine).length + 0.5 * ratios.filter((r) => r === mine).length)) / ratios.length) : null
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="tabular text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )

  return (
    <SeekProvider>
      <div className={cn("grid gap-8", inDrawer ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[320px_1fr]")}>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          {f ? (
            <Player src={`/api/video/${id}`} poster={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} />
          ) : (
            // Not analyzed yet: the video itself plays here via YouTube's embed.
            <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={v?.title ?? "YouTube short"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
          )}
          {f?.audio && !f.audio.error && (
            <div className="surface p-4">
              <Loudness f={f.audio} />
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {!inDrawer && <h1 className="font-display text-2xl leading-tight text-slate-900 md:text-[28px]">{v?.title ?? id}</h1>}
          {inDrawer && v && <p className="font-display text-lg leading-snug text-slate-900">{v.title}</p>}
          {v && (
            <div className="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {stat("Views", (v.views ?? 0).toLocaleString())}
              {stat("Likes", (v.likes ?? 0).toLocaleString())}
              {stat("Comments", (v.comments ?? 0).toLocaleString())}
              {stat("Views/day", perDay != null ? (perDay < 10 ? perDay.toFixed(1) : Math.round(perDay).toLocaleString()) : "—")}
            </div>
          )}
          {v && (
            <p className="tabular -mt-3 text-xs text-slate-500">
              {ch?.name ?? v.channel} · published {v.published.slice(0, 10)} · {secs(v.duration)}s · public counts as of {asOf}
              {channelMedian != null && ` · channel median ${channelMedian < 10 ? channelMedian.toFixed(1) : Math.round(channelMedian).toLocaleString()} views/day`}
            </p>
          )}

          {organic != null && mine != null && (
            <div className="surface flex flex-wrap items-center gap-x-5 gap-y-1 p-5">
              <span className="tabular font-display text-3xl text-pax-ink">{organic}</span>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-slate-900">Organic, 0 to 100</span>
                <span className="tabular text-xs text-slate-500">
                  Views/day at {mine < 10 ? mine.toFixed(1) : Math.round(mine)}× this channel&apos;s median, ranked among the {ratios.length} tracked shorts; 50 = the middle. Paid Resonance needs impressions, which YouTube doesn&apos;t publish.
                </span>
              </div>
            </div>
          )}

          <Fold title="Formula" preview={f ? <Observations part="summary" f={f} /> : <p className="text-sm text-slate-500">The video review hasn&apos;t run on this short yet.</p>}>
            {f?.pegasus?.result?.characteristics && <Observations part="detail" f={f} />}
          </Fold>

          <Fold
            title="Transcript"
            preview={
              f?.transcript && !f.transcript.error ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[15px] leading-relaxed text-slate-800">{f.transcript.text}</p>
                  {f.transcript.wpm != null && <p className="tabular text-xs text-slate-500">{f.transcript.wpm} words per minute</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No transcript yet.</p>
              )
            }
          />
        </div>
      </div>
    </SeekProvider>
  )
}
