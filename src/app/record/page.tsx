import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"

import features from "../../../data/generated/features.json"
import shorts from "../../../data/raw/yt-shorts.json"
import { Feed, type FeedVideo } from "@/components/record/feed"
import { LandingHeader } from "@/components/record/landing-header"
import { PhoneMock } from "@/components/record/phone-mock"
import { ScrollCue } from "@/components/record/scroll-cue"

export const metadata = { title: "Record a video" }

// The phone plays a real short: FairVote's best-travelled video.
const FAIRVOTE = "UCb8R3tlbcYaE5J5-HUBf7mw"

type RawVideo = { id: string; channelId: string; channel: string; views?: number; duration: string; published: string; title: string; description?: string }

const timerOf = (iso: string) => {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  return `${(m?.[1] ?? "0").padStart(2, "0")}:${(m?.[2] ?? "0").padStart(2, "0")}`
}

export default function RecordLanding() {
  const all = (shorts as unknown as { videos: RawVideo[] }).videos
  const top = all.filter((v) => v.channelId === FAIRVOTE).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
  const feed: FeedVideo[] = all
    .map((v) => ({
      id: v.id,
      title: v.title.replace(/\s*#\w+/g, "").trim() || v.title,
      channel: v.channel,
      views: v.views ?? 0,
      published: v.published,
      duration: v.duration,
      description: (v.description ?? "").split("\n")[0].replace(/\s*#\w+/g, "").trim(),
      playable: `yt-${v.id}` in (features as Record<string, unknown>),
    }))
    .sort((a, b) => b.views - a.views)
  return (
    <div className="bg-pax-mist">
      <LandingHeader />
      <section className="relative -mt-16 flex min-h-dvh flex-col justify-center bg-gradient-to-b from-pax-lavender to-pax-mist pt-16">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-10 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-pax-ink shadow-sm">
              <Clock className="size-4" /> Breakthrough
            </span>
            <h1 className="font-display text-5xl font-bold leading-[1.05] text-pax-ink lg:text-[4.25rem]">
              Voice.
              <br />
              Amplified.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">We help you choose what to say, how to say it and share it. Because your voice is the difference.</p>
            <Link href="/record/start" className="flex w-fit items-center gap-2 rounded-full bg-pax-ink px-7 py-4 text-base font-medium text-white shadow-lg transition-transform hover:-translate-y-0.5">
              Let&apos;s go <ArrowRight className="size-4" />
            </Link>
            <p className="text-sm text-muted-foreground">Powered by Resonant Amplification &copy;</p>
          </div>
          <PhoneMock videoId={`yt-${top.id}`} timer={timerOf(top.duration)} />
        </div>
        <ScrollCue />
      </section>
      <Feed videos={feed} />
    </div>
  )
}
