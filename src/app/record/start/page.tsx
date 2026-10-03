import Link from "next/link"
import { ArrowRight, ListChecks, PencilLine, Sparkles, Upload } from "lucide-react"

import { FlowPage, HelpLine, StepBar } from "@/components/record/chrome"

export const metadata = { title: "How would you like to start?" }

const OPTIONS = [
  { href: "/record/camera#upload", icon: Upload, title: "Upload a video", body: "Already have a video ready? Upload it here." },
  { href: "/record/library", icon: ListChecks, title: "Choose a script", body: "Pick a ready-made campaign script and make it yours." },
  { href: "/record/script?own=1", icon: PencilLine, title: "Create your own", body: "Already know what you want to say? Start from a blank page." },
]

export default function StartPage() {
  return (
    <>
      <StepBar step={1} back={{ href: "/record", label: "Back" }} />
      <FlowPage title="How would you like to start?" lead="There's no wrong answer here. Pick whatever feels easiest.">
        <div className="flex flex-col gap-4">
          <div className="flex gap-5 rounded-3xl border-2 border-primary/40 bg-white p-6 shadow-sm">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Sparkles className="size-5" />
            </span>
            <div className="flex flex-col items-start gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Recommended</span>
              <h2 className="font-display text-2xl font-semibold text-pax-ink">Let&apos;s write a script in your own words</h2>
              <p className="text-muted-foreground">Answer three short questions about yourself and why this matters to you. PAX turns your answers into a script that sounds like you, built on the argument that is testing best.</p>
              <Link href="/record/personal" className="mt-2 flex items-center gap-2 rounded-full bg-pax-ink px-5 py-3 text-sm font-medium text-white">
                Write my script <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {OPTIONS.map(({ href, icon: Icon, title, body }) => (
            <Link key={href} href={href} className="lift group flex items-center gap-5 surface p-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pax-mist">
                <Icon className="size-5 text-pax-ink" />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-lg font-semibold text-pax-ink">{title}</span>
                <span className="text-muted-foreground">{body}</span>
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-pax-mist transition-colors group-hover:bg-primary group-hover:text-white">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
        <HelpLine />
      </FlowPage>
    </>
  )
}
