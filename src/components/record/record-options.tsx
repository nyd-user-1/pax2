"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, ListChecks, MessageSquareText, PencilLine, Upload } from "lucide-react"

import { loadLibraryCards } from "@/app/library-actions"
import { LibraryCard, type CardData } from "@/components/record/library-card"
import { RevealFx } from "@/components/reveal-fx"
import { whiteButton } from "@/components/white-button"

// The ways into recording: write in your own words, or choose, skip the camera, create or upload.
// Shared by /recording and the landing's third section, where Choose a script opens the scripts in place.

const OPTIONS = [
  { href: "/record/library", icon: ListChecks, title: "Choose a script", body: "Pick a ready-made campaign script and make it yours." },
  { href: "/record/studio", icon: Clapperboard, title: "Skip the camera", body: "Turn your script into an animated video instead." },
  { href: "/record/script?own=1", icon: PencilLine, title: "Create your own", body: "Already know what you want to say? Start from a blank page." },
  { href: "/record/camera#upload", icon: Upload, title: "Upload a video", body: "Already have a video ready? Upload it here." },
]

/** With `onChoose`, Choose a script opens the scripts in place instead of going to /record/library. */
export function RecordOptions({ onChoose }: { onChoose?: () => void }) {
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
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                </span>
              </span>
              <span className="text-lg font-semibold text-pax2-blue">{title}</span>
            </>
          )
          return inPlace ? (
            <button key={href} type="button" onClick={onChoose} className="lift group surface flex flex-col gap-3 p-5 text-left">
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

/** The landing's recording section. Choose a script swaps the options for the scripts in place,
 *  wiping in with the page transition: a horizontal slider, four cards a page, paged by chevrons
 *  opposite the heading (right alone at first, left joining after the first step). The cards are
 *  fetched when the reader reaches for Choose a script, not on every load. */
export function RecordChooser({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [cards, setCards] = React.useState<CardData[] | null>(null)
  const [, startLoading] = React.useTransition()
  const [stepped, setStepped] = React.useState(false)
  const track = React.useRef<HTMLDivElement>(null)
  const fetchCards = () => {
    if (!cards) startLoading(async () => setCards(await loadLibraryCards()))
  }
  const pages = cards ? Array.from({ length: Math.ceil(cards.length / 4) }, (_, i) => cards.slice(i * 4, i * 4 + 4)) : []
  // One page either way, wrapping round at the ends.
  const page = (by: 1 | -1) => {
    const el = track.current
    if (!el) return
    const at = Math.round(el.scrollLeft / el.clientWidth)
    const next = (at + by + pages.length) % pages.length
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" })
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {open && cards ? (
        <RevealFx translateY={4} className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-pax2-blue">By Polling and Narrative Style</h2>
              {pages.length > 1 && (
                <div className="flex shrink-0 gap-2">
                  {stepped && (
                    <button type="button" aria-label="Previous scripts" onClick={() => page(-1)} className={whiteButton("circle", "size-8")}>
                      <ChevronLeft className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="More scripts"
                    onClick={() => {
                      page(1)
                      setStepped(true)
                    }}
                    className={whiteButton("circle", "size-8")}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
            {/* The slider: whole pages side by side, snapping, its scrollbar hidden; padded so the cards' shadows aren't clipped. */}
            <div ref={track} className="no-scrollbar -m-2 flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
              {pages.map((group, i) => (
                <div key={i} className="grid w-full shrink-0 snap-start auto-rows-fr gap-4 p-2 sm:grid-cols-2">
                  {group.map((c) => (
                    <LibraryCard key={c.id} s={c} compact />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm">
            <Link href="/record/library" className="font-medium text-primary underline underline-offset-4">
              Full Library
            </Link>
          </p>
        </RevealFx>
      ) : (
        <>
          <div onPointerEnter={fetchCards} onFocusCapture={fetchCards}>
            <RecordOptions
              onChoose={() => {
                fetchCards()
                setOpen(true)
              }}
            />
          </div>
          {children}
        </>
      )}
    </div>
  )
}
