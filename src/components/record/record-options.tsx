"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Clapperboard, ListChecks, MessageSquareText, PencilLine, Upload } from "lucide-react"

import { loadLibraryCards } from "@/app/library-actions"
import { LibraryCard, type CardData } from "@/components/record/library-card"
import { RevealFx } from "@/components/reveal-fx"
import { cn } from "@/ui/lib/utils"

// The ways into recording: write in your own words, or choose, skip the camera, create or upload.
// Shared by /recording and the landing's third section, where Choose a script opens the scripts in place.

const OPTIONS = [
  { href: "/record/library", icon: ListChecks, title: "Choose a script", body: "Pick a ready-made campaign script and make it yours." },
  { href: "/record/studio", icon: Clapperboard, title: "Skip the camera", body: "Turn your script into an animated video instead." },
  { href: "/record/script?own=1", icon: PencilLine, title: "Create your own", body: "Already know what you want to say? Start from a blank page." },
  { href: "/record/camera#upload", icon: Upload, title: "Upload a video", body: "Already have a video ready? Upload it here." },
]

/** With `onChoose`, Choose a script opens the scripts in place instead of going to /record/library. */
export function RecordOptions({ onChoose, choosing = false }: { onChoose?: () => void; choosing?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/record/personal" className="lift group surface flex cursor-pointer flex-col gap-3 p-6">
        <span className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-full bg-pax2-mist">
            <MessageSquareText className="size-[18px] text-pax2-blue" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-pax2-mist transition-colors group-hover:bg-primary group-hover:text-white">
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
          </span>
        </span>
        <h2 className="font-display text-2xl font-semibold text-pax2-blue">Let&apos;s write a script in your own words</h2>
      </Link>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
        {OPTIONS.map(({ href, icon: Icon, title }) => {
          const inPlace = onChoose && href === "/record/library"
          const body = (
            <>
              <span className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-full bg-pax2-mist">
                  <Icon className="size-[18px] text-pax2-blue" />
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-pax2-mist transition-colors group-hover:bg-primary group-hover:text-white">
                  {inPlace ? (
                    <ChevronDown className={cn("size-4 transition-transform duration-200", choosing && "rotate-180")} />
                  ) : (
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                  )}
                </span>
              </span>
              <span className="text-lg font-semibold text-pax2-blue">{title}</span>
            </>
          )
          return inPlace ? (
            <button key={href} type="button" onClick={onChoose} aria-expanded={choosing} className="lift group surface flex flex-col gap-3 p-5 text-left">
              {body}
            </button>
          ) : (
            <Link key={href} href={href} className="lift group surface flex flex-col gap-3 p-5">
              {body}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** The landing's recording section: the options, and under them — once Choose a script is pressed —
 *  the library's scripts, fetched then and revealed with the page transition's wipe. */
export function RecordChooser({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [cards, setCards] = React.useState<CardData[] | null>(null)
  const [loading, startLoading] = React.useTransition()
  const toggle = () => {
    setOpen((o) => !o)
    if (!cards) startLoading(async () => setCards(await loadLibraryCards()))
  }
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <RecordOptions onChoose={toggle} choosing={open} />
        {children}
      </div>
      {open && (loading || !cards ? (
        <p className="text-center text-sm text-slate-800">Loading the scripts…</p>
      ) : (
        <RevealFx translateY={4}>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <LibraryCard key={c.id} s={c} />
            ))}
          </div>
        </RevealFx>
      ))}
    </div>
  )
}
