import Link from "next/link"

import shorts from "../../../data/raw/yt-shorts.json"
import { CampaignMap } from "@/components/map/campaign-map"
import { ScrollStrip } from "@/components/scroll-row"
import { ShortsSort } from "@/components/shorts-sort"
import { CHANNELS, median, secs } from "@/lib/channels"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Campaign videos" }

type Yt = { fetchedAt: string; videos: { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

// Each channel's shorts playlist, the latest ~30-50 (lib/channels). The 2026 Question 3
// channel only; a second "Yes on 3" channel belongs to 2024's rideshare-union question.

export default async function CampaignPage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { c = "yes-on-3", s = "perday" } = await searchParams
  const data = shorts as unknown as Yt
  const asOf = data.fetchedAt.slice(0, 10)
  const ch = CHANNELS.find((x) => x.slug === c) ?? CHANNELS[0]
  const all = data.videos
    .filter((v) => v.views != null)
    .map((v) => ({ ...v, sec: secs(v.duration), days: Math.max(1, (Date.parse(asOf) - Date.parse(v.published)) / 864e5) }))
    .map((v) => ({ ...v, perDay: v.views! / v.days, engagement: v.views ? ((v.likes ?? 0) + (v.comments ?? 0)) / v.views : 0 }))
  const order: Record<string, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    perday: (a, b) => b.perDay - a.perDay,
    views: (a, b) => (b.views ?? 0) - (a.views ?? 0),
    likes: (a, b) => (b.likes ?? 0) - (a.likes ?? 0),
    comments: (a, b) => (b.comments ?? 0) - (a.comments ?? 0),
    newest: (a, b) => b.published.localeCompare(a.published),
  }
  const videos = all.filter((v) => v.channelId === ch.id).sort(order[s] ?? order.perday)
  const stats = CHANNELS.map((x) => {
    const vs = all.filter((v) => v.channelId === x.id)
    return { ...x, n: vs.length, medianPerDay: median(vs.map((v) => v.perDay)), medianSec: median(vs.map((v) => v.sec)), medianEngagement: median(vs.map((v) => v.engagement)) }
  })

  return (
    <div className="flex flex-col gap-8">
      <CampaignMap />

      <ScrollStrip itemClassName="w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)]">
        {stats.map((s) => (
          <Link key={s.slug} href={`/campaigns?c=${s.slug}`} scroll={false} className={cn("lift surface flex h-full flex-col gap-1 border p-5", s.slug === ch.slug ? "border-pax-plum" : "border-transparent")}>
            <span className="text-lg font-medium text-pax-ink">{s.name}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/flags/${s.code}.png`} alt={s.code} className="h-4 w-auto self-start rounded-[2px] ring-1 ring-slate-200/80" />
            <span className="tabular mt-2 text-sm">
              <b className="font-display text-2xl font-normal text-pax-ink">{s.medianPerDay < 10 ? s.medianPerDay.toFixed(1) : Math.round(s.medianPerDay).toLocaleString()}</b> views/day, median
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className="grow block h-full rounded-full bg-pax-plum" style={{ width: `${(s.medianPerDay / Math.max(...stats.map((x) => x.medianPerDay))) * 100}%` }} />
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {Math.round(s.medianSec)}s median length
            </span>
          </Link>
        ))}
      </ScrollStrip>

      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-xl text-slate-900">Shorts</h2>
        <ShortsSort channel={ch.slug} sort={s} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {videos.map((v) => (
          <Link key={v.id} href={`/v/yt-${v.id}`} scroll={false} className="group flex flex-col gap-2">
            <div className="lift relative aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.03]" />
              <span className="tabular absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{v.sec}s</span>
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/25">
                <span className="tabular flex translate-y-1 items-center gap-1 rounded-full bg-white/95 px-3.5 py-1.5 text-base font-semibold text-slate-900 opacity-0 shadow-e3 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {v.views!.toLocaleString()}
                </span>
              </span>
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-pax-ink">{v.title.replace(/\s*#\w+/g, "").trim() || v.title}</p>
            <p className="tabular text-xs text-slate-500">{v.published.slice(0, 10)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
