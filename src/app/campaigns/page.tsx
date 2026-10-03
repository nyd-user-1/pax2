import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import shorts from "../../../data/raw/yt-shorts.json"
import { ReformSpendMap } from "@/components/map/maps"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Campaign videos" }

type Yt = { fetchedAt: string; videos: { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

// Each channel's shorts playlist, the latest ~30. The 2026 Question 3 channel only; a second
// "Yes on 3" channel belongs to 2024's rideshare-union question and is left out.
const CHANNELS = [
  { id: "UC-rKSUWdEqPmP-UM7yV6Ssw", slug: "yes-on-3", name: "Vote YES on 3", place: "Massachusetts · all-party primaries", code: "MA" },
  { id: "UCpSEnGNa8pO-llnwBDDa6Tg", slug: "courageous-colorado", name: "Courageous Colorado", place: "Colorado", code: "CO" },
  { id: "UCdr9X0FtE_GnXk_JwWYUx3g", slug: "open-primaries", name: "Open Primaries", place: "National", code: "US" },
  { id: "UC3HvCnPvYMIwh15fJxrEcKA", slug: "unite-america", name: "Unite America", place: "National", code: "US" },
]

const secs = (iso: string) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

export default async function CampaignPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c = "yes-on-3" } = await searchParams
  const data = shorts as unknown as Yt
  const asOf = data.fetchedAt.slice(0, 10)
  const ch = CHANNELS.find((x) => x.slug === c) ?? CHANNELS[0]
  const all = data.videos
    .filter((v) => v.views != null)
    .map((v) => ({ ...v, sec: secs(v.duration), days: Math.max(1, (Date.parse(asOf) - Date.parse(v.published)) / 864e5) }))
    .map((v) => ({ ...v, perDay: v.views! / v.days, engagement: v.views ? ((v.likes ?? 0) + (v.comments ?? 0)) / v.views : 0 }))
  const videos = all.filter((v) => v.channelId === ch.id).sort((a, b) => b.perDay - a.perDay)
  const stats = CHANNELS.map((x) => {
    const vs = all.filter((v) => v.channelId === x.id)
    return { ...x, n: vs.length, medianPerDay: median(vs.map((v) => v.perDay)), medianSec: median(vs.map((v) => v.sec)), medianEngagement: median(vs.map((v) => v.engagement)) }
  })

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Analysis</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.slug} href={`/campaigns?c=${s.slug}`} scroll={false} className={cn("lift surface flex flex-col gap-1 p-5", s.slug === ch.slug && "ring-2 ring-pax-plum")}>
            <span className="text-lg font-medium text-pax-ink">{s.name}</span>
            <span className="text-sm text-slate-500">{s.code}</span>
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">Google Ads</h2>
        <ReformSpendMap />
        <p className="text-xs text-slate-400">Google Political Ads Transparency, via GovBlock. The advertiser “VOTE YES ON 3” here is Nevada's Question 3.</p>
      </section>

      <h2 className="font-display text-xl text-slate-900">YouTube Shorts</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {videos.map((v) => (
          <a key={v.id} href={`https://www.youtube.com/shorts/${v.id}`} target="_blank" rel="noreferrer" className="group flex flex-col gap-2">
            <div className="lift relative aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.03]" />
              <span className="tabular absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{v.sec}s</span>
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/25">
                <span className="tabular flex translate-y-1 items-center gap-1 rounded-full bg-white/95 px-3.5 py-1.5 text-base font-semibold text-slate-900 opacity-0 shadow-e3 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {v.views!.toLocaleString()}
                  <ArrowUpRight className="size-4 text-pax-red" strokeWidth={2.5} />
                </span>
              </span>
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-pax-ink">{v.title.replace(/\s*#\w+/g, "").trim() || v.title}</p>
            <p className="tabular text-xs text-slate-500">{v.published.slice(0, 10)}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
