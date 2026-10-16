import Link from "next/link"
import { ArrowRight } from "lucide-react"

import homeFeed from "../../../data/generated/home-feed.json"
import shorts from "../../../data/raw/yt-shorts.json"
import { FlapHero } from "@/components/flap-hero"
import GradualBlur from "@/components/gradual-blur"
import { LandingGrid } from "@/components/landing-grid"
import { Feed, type FeedVideo } from "@/components/record/feed"
import { LandingHeader } from "@/components/record/landing-header"
import { LandingOnly, LandingSurface } from "@/components/record/landing-only"
import { PhoneMock } from "@/components/record/phone-mock"
import { ScrollTop } from "@/components/record/scroll-cue"
import { currentUser } from "@/lib/auth"

export const metadata = { title: "Record a video" }

// The phone plays a real short: FairVote's best-travelled video.
const FAIRVOTE = "UCb8R3tlbcYaE5J5-HUBf7mw"

type RawVideo = { id: string; channelId: string; channel: string; views?: number; duration: string; published: string; title: string; description?: string }

const timerOf = (iso: string) => {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  return `${(m?.[1] ?? "0").padStart(2, "0")}:${(m?.[2] ?? "0").padStart(2, "0")}`
}

export default async function RecordLanding() {
  const all = (shorts as unknown as { videos: RawVideo[] }).videos
  const top = all.filter((v) => v.channelId === FAIRVOTE).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
  const feed = homeFeed as FeedVideo[]
  // Signed in, the hero has done its job: the feed is the page. Local dev is exempt —
  // its auto-admin shortcut would otherwise hide the hero forever.
  if (process.env.NODE_ENV !== "development" && (await currentUser()))
    return (
      <LandingSurface>
        <LandingOnly>
          <LandingHeader signedIn />
        </LandingOnly>
        <Feed videos={feed} />
        <LandingOnly>
          <ScrollTop />
        </LandingOnly>
      </LandingSurface>
    )
  return (
    <div className="bg-pax2-mist">
      <LandingOnly>
        <LandingGrid />
        {/* Videos soften as they scroll in and out: blur bands at the viewport's edges,
            each hiding when there is nothing beyond it. Under the header's z-30. */}
        <GradualBlur position="top" target="page" autoHide height="5rem" zIndex={20} />
        <GradualBlur position="bottom" target="page" autoHide height="5rem" zIndex={20} />
        <LandingHeader />
        {/* Not positioned: the gradient must paint beneath the fixed grid layer, while
            FlapHero (positioned itself) paints above it. */}
        <section className="-mt-16 flex min-h-dvh flex-col justify-center bg-gradient-to-b from-pax2-lavender to-pax2-mist">
          <FlapHero />
        </section>
        <section className="relative flex min-h-dvh flex-col justify-center">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-10 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-6">
              <h1 className="font-display text-5xl font-bold leading-[1.05] text-pax2-blue lg:text-[4.25rem]">Video built for Resonance.</h1>
              <p className="max-w-md text-lg leading-relaxed text-slate-900">We help you choose what to say, how to say it and share it. Because your voice is the difference.</p>
              <Link href="/record/start" className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-medium text-slate-500 shadow-md transition-colors hover:bg-slate-50">
                Let&apos;s go <ArrowRight className="size-4" />
              </Link>
              <p className="text-sm text-muted-foreground">Powered by Resonant Amplification &copy;</p>
            </div>
            <PhoneMock videoId={`yt-${top.id}`} timer={timerOf(top.duration)} />
          </div>
        </section>
      </LandingOnly>
      {/* Positioned, so the feed paints above the fixed grid layer. */}
      <div className="relative">
        <Feed videos={feed} />
      </div>
      <LandingOnly>
        <ScrollTop />
      </LandingOnly>
    </div>
  )
}
