import Link from "next/link"
import { ArrowRight, Clock, PencilLine, Send, Smile, Video } from "lucide-react"

import { HelpLine } from "@/components/record/chrome"

export const metadata = { title: "Record a video" }

export default function RecordLanding() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-pax-lavender to-pax-mist">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr] md:py-24">
          <div className="flex flex-col gap-6">
            <Link href="/" className="font-display text-2xl text-pax-ink">PAX</Link>
            <span className="flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-pax-ink shadow-sm">
              <Clock className="size-4" /> About five minutes
            </span>
            <h1 className="font-display text-5xl font-bold leading-[1.05] text-pax-ink lg:text-[4.25rem]">
              Record your video.
              <br />
              <span className="text-primary lg:whitespace-nowrap">We&apos;ll handle the rest.</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">Choose what you want to say, then record here or upload a video you already made. The team takes it from there.</p>
            <Link href="/record/start" className="flex w-fit items-center gap-2 rounded-full bg-pax-ink px-7 py-4 text-base font-medium text-white shadow-lg transition-transform hover:-translate-y-0.5">
              Let&apos;s get started <ArrowRight className="size-4" />
            </Link>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smile className="size-4" /> No production skills needed. <span className="text-pax-ink">Just be yourself.</span>
            </p>
          </div>
          <div className="mx-auto w-64 rotate-[4deg] rounded-[2.5rem] border-[10px] border-pax-ink bg-pax-ink shadow-2xl md:w-72">
            <div className="relative flex aspect-[9/19] flex-col justify-end overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-primary/60 via-pax-ink/80 to-pax-ink p-5 text-center">
              <span className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80" />
              <span className="absolute left-1/2 top-12 -translate-x-1/2 font-mono text-xs text-white/80">00:00</span>
              <p className="font-display text-xl font-semibold uppercase leading-tight text-white">
                When politicians don&apos;t have to compete, <span className="text-[var(--pax-red)]">they don&apos;t have to listen.</span>
              </p>
              <span className="mx-auto mt-6 size-14 rounded-full border-4 border-white/90 bg-[var(--pax-red)]" />
              <span className="mt-3 text-[10px] font-medium tracking-widest text-white/80">VIDEO</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-20">
        <h2 className="font-display text-4xl font-semibold text-pax-ink">
          It really is that <span className="text-primary">simple.</span>
        </h2>
        <ol className="grid w-full gap-10 sm:grid-cols-3">
          {[
            { icon: PencilLine, t: "Pick", d: "Choose what you want to say." },
            { icon: Video, t: "Record", d: "Record here, or upload." },
            { icon: Send, t: "Send", d: "The team takes care of the rest." },
          ].map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="flex flex-col items-center gap-3 text-center">
              <span className="relative flex size-20 items-center justify-center rounded-full bg-white shadow-md">
                <Icon className="size-7 text-pax-ink" />
                <span className="absolute -left-1 -top-1 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
              </span>
              <span className="text-lg font-semibold text-pax-ink">{t}</span>
              <span className="text-muted-foreground">{d}</span>
            </li>
          ))}
        </ol>
        <HelpLine />
      </section>
    </div>
  )
}
