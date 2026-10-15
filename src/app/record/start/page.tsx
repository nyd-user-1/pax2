import Link from "next/link"
import { ArrowRight, Clapperboard, ListChecks, MessageSquareText, PencilLine, Upload } from "lucide-react"

import { FlowPage, HelpLine } from "@/components/record/chrome"

export const metadata = { title: "How would you like to start?" }

const OPTIONS = [
  { href: "/record/library", icon: ListChecks, title: "Choose a script", body: "Pick a ready-made campaign script and make it yours." },
  { href: "/record/studio", icon: Clapperboard, title: "Skip the camera", body: "Turn your script into an animated video instead." },
  { href: "/record/script?own=1", icon: PencilLine, title: "Create your own", body: "Already know what you want to say? Start from a blank page." },
  { href: "/record/camera#upload", icon: Upload, title: "Upload a video", body: "Already have a video ready? Upload it here." },
]

export default function StartPage() {
  return (
    <FlowPage className="min-h-[calc(100dvh-11.5rem)] justify-center py-0">
        <div className="flex flex-col gap-4">
          <Link href="/record/personal" className="lift group surface flex cursor-pointer flex-col gap-3 p-6">
            <span className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-full bg-hermes-mist">
                <MessageSquareText className="size-[18px] text-hermes-ink" />
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-hermes-mist transition-colors group-hover:bg-primary group-hover:text-white">
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
              </span>
            </span>
            <h2 className="font-display text-2xl font-semibold text-hermes-ink">Let&apos;s write a script in your own words</h2>
          </Link>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
            {OPTIONS.map(({ href, icon: Icon, title }) => (
              <Link key={href} href={href} className="lift group surface flex flex-col gap-3 p-5">
                <span className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-hermes-mist">
                    <Icon className="size-[18px] text-hermes-ink" />
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-hermes-mist transition-colors group-hover:bg-primary group-hover:text-white">
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                  </span>
                </span>
                <span className="text-lg font-semibold text-hermes-ink">{title}</span>
              </Link>
            ))}
          </div>
        </div>
        <HelpLine />
    </FlowPage>
  )
}
