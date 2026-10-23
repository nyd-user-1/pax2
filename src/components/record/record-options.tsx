"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clapperboard, ListChecks, Loader2, MessageSquareText, PencilLine, Upload } from "lucide-react"

import { loadLibraryCards } from "@/app/library-actions"
import { InPlace } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"
import { CameraFlow } from "@/components/record/camera-flow"
import { ScriptBox } from "@/components/record/editor"
import { LibraryCard, type CardData } from "@/components/record/library-card"
import { PersonalForm } from "@/components/record/personal-form"
import { StudioFlow } from "@/components/record/studio-flow"
import { RevealFx } from "@/components/reveal-fx"
import { whiteButton } from "@/components/white-button"
import { cn } from "@/ui/lib/utils"

// The ways into recording: write in your own words, or choose, skip the camera, create or upload.
// Shared by /recording, where the first opens /chat in record mode and the rest their /record pages,
// and the landing's third section, where each opens in place.

type Step = "options" | "personal" | "library" | "script" | "camera" | "studio"

const OPTIONS = [
  { href: "/record/library", step: "library", icon: ListChecks, title: "Choose a script" },
  { href: "/record/studio", step: "studio", icon: Clapperboard, title: "Skip the camera" },
  { href: "/record/script?own=1", step: "own", icon: PencilLine, title: "Create your own" },
  { href: "/record/camera#upload", step: "camera", icon: Upload, title: "Upload a video" },
] as const

type Pick = (typeof OPTIONS)[number]["step"] | "personal"

const ARROW = "flex size-8 items-center justify-center rounded-full bg-pax2-mist transition-colors group-hover:bg-primary group-hover:text-white"

/** With `onPick`, every option stays on the page (the landing) instead of going to its /record page. */
export function RecordOptions({ onPick }: { onPick?: (to: Pick) => void }) {
  const lead = (
    <>
      <span className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-full bg-pax2-mist">
          <MessageSquareText className="size-[18px] text-pax2-blue" />
        </span>
        <span className={ARROW}>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
        </span>
      </span>
      <h2 className="font-display text-2xl font-semibold text-pax2-blue">Let&apos;s write a script in your own words</h2>
    </>
  )
  return (
    <div className="flex flex-col gap-4">
      {onPick ? (
        <button type="button" onClick={() => onPick("personal")} className="lift group surface flex cursor-pointer flex-col gap-3 p-6 text-left">
          {lead}
        </button>
      ) : (
        <Link href="/chat?record=1" className="lift group surface flex cursor-pointer flex-col gap-3 p-6">
          {lead}
        </Link>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
        {OPTIONS.map(({ href, step, icon: Icon, title }) => {
          const body = (
            <>
              <span className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-full bg-pax2-mist">
                  <Icon className="size-[18px] text-pax2-blue" />
                </span>
                <span className={ARROW}>
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                </span>
              </span>
              <span className="text-lg font-semibold text-pax2-blue">{title}</span>
            </>
          )
          return onPick ? (
            <button key={href} type="button" onClick={() => onPick(step)} className="lift group surface flex flex-col gap-3 p-5 text-left">
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

// Where each step's back link returns to, named for the step it returns to.
const BACK: Record<Step, string> = { options: "Start", personal: "About you", library: "Scripts", script: "Script", camera: "Record", studio: "Without a camera" }

/** The landing's recording section: every path of the record flow, in place, up to the moment of
 *  recording, where a signed-out reader is asked to sign in. Each step wipes in over the last, with a
 *  link back to the step before. Choose a script is a horizontal slider, four cards a page, paged by
 *  chevrons opposite the heading (right alone at first, left joining after the first step); the
 *  cards are fetched when the reader reaches for the options, not on every load. */
export function RecordChooser({ children }: { children?: React.ReactNode }) {
  const [trail, setTrail] = React.useState<Step[]>(["options"])
  const step = trail[trail.length - 1]
  const go = (to: Step) => setTrail((t) => [...t, to])
  const back = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t))
  const restart = () => setTrail(["options"])
  const [cards, setCards] = React.useState<CardData[] | null>(null)
  const [, startLoading] = React.useTransition()
  const [stepped, setStepped] = React.useState(false)
  const [text, setText] = React.useState("")
  const { update } = useDraft()
  const track = React.useRef<HTMLDivElement>(null)
  const top = React.useRef<HTMLDivElement>(null)
  const fetchCards = () => {
    if (!cards) startLoading(async () => setCards(await loadLibraryCards()))
  }
  // Each new step starts at its heading: if the reader had scrolled past the section's top, bring it back.
  React.useEffect(() => {
    const el = top.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [trail.length])
  const pick = (to: Pick) => {
    if (to === "own") {
      update({ mode: "own", scriptId: undefined, title: "My own words", text: "" })
      setText("")
      go("script")
      return
    }
    if (to === "library") fetchCards()
    go(to)
  }
  // Pick a different script: back to the scripts, wherever this script came from.
  const toScripts = () => {
    fetchCards()
    setTrail((t) => (t.includes("library") ? t.slice(0, t.indexOf("library") + 1) : [...t.slice(0, -1), "library"]))
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
    <div ref={top} className={cn("mx-auto flex w-full scroll-mt-24 flex-col gap-8", step === "studio" ? "max-w-6xl" : "max-w-3xl")}>
      {step !== "options" && (
        <button type="button" onClick={back} className="-mb-2 flex items-center gap-1.5 self-start text-sm text-slate-800 hover:text-pax2-blue">
          <ArrowLeft className="size-4" /> {BACK[trail[trail.length - 2]]}
        </button>
      )}
      {step === "personal" ? (
        <InPlace title="Tell us a little about you." lead="Three short answers. PAX2 writes a script that sounds like you, and you can change every word.">
          <PersonalForm
            onWritten={(t) => {
              setText(t)
              go("script")
            }}
          />
        </InPlace>
      ) : step === "script" ? (
        <InPlace title="Make it yours." lead="Change anything you'd like. It should sound like you.">
          <ScriptBox
            text={text}
            onText={(t) => {
              setText(t)
              update({ text: t })
            }}
            onPickDifferent={toScripts}
            onRecord={() => go("camera")}
            onStudio={() => go("studio")}
          />
        </InPlace>
      ) : step === "camera" ? (
        <CameraFlow embedded={{ onPick: restart }} />
      ) : step === "studio" ? (
        <StudioFlow embedded={{ onPick: restart }} />
      ) : step === "library" ? (
        cards ? (
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
                      <LibraryCard
                        key={c.id}
                        s={c}
                        compact
                        onPick={(s) => {
                          setText(s.text)
                          go("script")
                        }}
                      />
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
          <Loader2 className="size-6 animate-spin self-center text-pax2-blue" />
        )
      ) : (
        <>
          <div onPointerEnter={fetchCards} onFocusCapture={fetchCards}>
            <RecordOptions onPick={pick} />
          </div>
          {children}
        </>
      )}
    </div>
  )
}
