import Link from "next/link"
import { FlaskConical, Video } from "lucide-react"

import shorts from "../../../data/raw/yt-shorts.json"
import { FlapHero } from "@/components/flap-hero"
import GradualBlur from "@/components/gradual-blur"
import { LandingGrid } from "@/components/landing-grid"
import { Feed } from "@/components/record/feed"
import { LandingHeader } from "@/components/record/landing-header"
import { LandingOnly, LandingSurface } from "@/components/record/landing-only"
import { HelpLine } from "@/components/record/chrome"
import { PhoneMock } from "@/components/record/phone-mock"
import { RecordChooser } from "@/components/record/record-options"
import { ResonanceSection } from "@/components/record/resonance-section"
import { ScrollCue, ScrollTop } from "@/components/record/scroll-cue"
import { currentUser } from "@/lib/auth"
import { feedFacets, firstPage } from "@/lib/feed-data"
import { whiteButton } from "@/components/white-button"

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
  // The feed's first page only; the rest pages in through /api/feed as the reader scrolls.
  const { initial, total, cursor } = firstPage()
  const facets = feedFacets()
  // Signed in, the hero has done its job: the feed is the page. Local dev is exempt —
  // its auto-admin shortcut would otherwise hide the hero forever.
  if (process.env.NODE_ENV !== "development" && (await currentUser()))
    return (
      <LandingSurface>
        <LandingOnly>
          <LandingHeader signedIn />
        </LandingOnly>
        <Feed initial={initial} total={total} cursor={cursor} facets={facets} />
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
            each hiding when there is nothing beyond it. Under the header's z-30; the top band
            starts at the 4rem header's foot so the header doesn't cover it. */}
        <GradualBlur position="top" target="page" autoHide height="5rem" zIndex={20} style={{ top: "4rem" }} />
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
              <h1 className="font-display text-5xl font-bold leading-[1.05] text-pax2-blue lg:text-[4.25rem]">
                Built for
                <br />
                Resonance
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-slate-900">We help you choose what to say, how to say it and share it. Because your voice is the difference.</p>
              <div className="flex items-center gap-3">
                <Link href="/#record" className={whiteButton("lg", "w-44")}>
                  <Video className="size-5" style={{ color: "#033882", fill: "#dbe7fa" }} /> Create
                </Link>
                <Link href="#resonance" className="press flex w-44 items-center justify-center gap-2 rounded-full bg-pax2-blue px-7 py-4 text-base font-medium text-white shadow-md transition-shadow hover:shadow-e3">
                  <FlaskConical className="size-5" /> Analyze
                </Link>
              </div>
              <p className="text-sm text-slate-800">Powered by Resonant Amplification &copy;</p>
            </div>
            <PhoneMock videoId={`yt-${top.id}`} timer={timerOf(top.duration)} />
          </div>
          {/* As high as the hero's, clear of the bottom blur band. */}
          <ScrollCue next="resonance" className="bottom-[171px]" />
        </section>
        {/* Section three: Resonant Amplification. */}
        <ResonanceSection />
        {/* Section four: the ways into recording, as on /recording; every path opens here, in place. Positioned, so it paints above the fixed grid. Above the feed, which never ends. */}
        <section id="record" className="relative flex min-h-dvh scroll-mt-16 flex-col justify-center">
          <div className="mx-auto w-full max-w-6xl px-5 pb-60 pt-12">
            <div className="mb-8 flex flex-col gap-3">
              <h2 className="font-display text-3xl font-bold text-pax2-blue">Record</h2>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-900">
                Five ways in: choose a script, write your own, answer three questions for one in your voice, build in the studio, or upload a finished video. Every original gets the catalog&rsquo;s
                own read — a forecast before it publishes, measurements after.
              </p>
            </div>
            <RecordChooser>
              <HelpLine />
            </RecordChooser>
          </div>
          <ScrollCue next="learn" className="bottom-[171px]" />
        </section>
      </LandingOnly>
      {/* Positioned, so the feed paints above the fixed grid layer. */}
      <div id="learn" className="relative">
        <LandingOnly>
          <div className="mx-auto w-full max-w-6xl px-6 pb-2 pt-10">
            <h2 className="font-display text-3xl font-bold text-pax2-blue">The Catalog</h2>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-900">
              19,057 political Shorts from 66 channels, searchable end to end. Each card carries its measured record: views, views over the channel&rsquo;s median, and the flask where the full lab
              pipeline has run.
            </p>
          </div>
        </LandingOnly>
        <Feed initial={initial} total={total} cursor={cursor} facets={facets} />
      </div>
      <LandingOnly>
        <ScrollTop />
      </LandingOnly>
    </div>
  )
}
