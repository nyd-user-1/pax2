import youtube from "../../../data/raw/yt-videos.json"
import { SourceBadge } from "@/components/bits"

export const metadata = { title: "Campaign videos" }

type Yt = { videos: { id: string; channelId: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

// The 2026 Question 3 (all-party primaries) campaign's own channel. A second "Yes on 3"
// channel belongs to 2024's rideshare-union question and is left out.
const CHANNEL = "UC-rKSUWdEqPmP-UM7yV6Ssw"
const AS_OF = "2026-10-03"

const secs = (iso: string) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0
}

export default function CampaignPage() {
  const videos = (youtube as unknown as Yt).videos
    .filter((v) => v.channelId === CHANNEL && secs(v.duration) <= 120 && v.views != null)
    .map((v) => ({ ...v, sec: secs(v.duration), days: Math.max(1, (Date.parse(AS_OF) - Date.parse(v.published)) / 864e5) }))
    .map((v) => ({ ...v, perDay: v.views! / v.days }))
    .sort((a, b) => b.perDay - a.perDay)
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-pax-ink md:text-5xl">What the Yes on 3 campaign is posting</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {videos.length} short videos from the Vote YES on 3! All-Party Primaries channel, ordered by organic views per day since posting · public YouTube counts as of Oct 3 <SourceBadge source="platform" />
        </p>
      </header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {videos.map((v) => (
          <a key={v.id} href={`https://www.youtube.com/shorts/${v.id}`} target="_blank" rel="noreferrer" className="group flex flex-col gap-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.03]" />
              <span className="tabular absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{v.sec}s</span>
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-pax-ink">{v.title.replace(/\s*#\w+/g, "").trim()}</p>
            <p className="tabular text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{Math.round(v.perDay).toLocaleString()}/day</span> · {v.views!.toLocaleString()} views · {v.published.slice(0, 10)}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}
