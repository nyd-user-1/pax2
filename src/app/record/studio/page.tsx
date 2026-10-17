"use client"

import * as React from "react"
import Link from "next/link"
import { Player } from "@remotion/player"
import { ArrowRight, Check, Loader2 } from "lucide-react"

import { submitTake } from "@/app/actions"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"
import { FPS, LOOKS, ScriptVideo, totalFrames, type Motion } from "@/components/studio/script-video"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

const MOTIONS: { id: Motion; label: string }[] = [
  { id: "rise", label: "Rise" },
  { id: "zoom", label: "Zoom" },
  { id: "type", label: "Word by word" },
]

/** No camera: the script becomes an animated vertical video, styled in place, sent as a design. */
export default function StudioPage() {
  const { draft, ready } = useDraft()
  const [look, setLook] = React.useState(LOOKS[0])
  const [motion, setMotion] = React.useState<Motion>("rise")
  const [ask, setAsk] = React.useState("Vote YES on 3")
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle")
  const lines = React.useMemo(() => (draft.text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 10), [draft.text])
  const frames = Math.max(FPS * 3, totalFrames(lines))
  const chip = (on: boolean) => cn("press rounded-full px-3.5 py-1.5 text-sm transition-colors", on ? "bg-pax2-blue font-semibold text-white" : "bg-white text-slate-600 shadow-e1 hover:text-pax2-blue")

  if (state === "sent")
    return (
      <>
        <StepBar step={3} back={{ href: "/record", label: "Home" }} />
        <FlowPage title="Sent. Thank you." lead="The team has your design and renders it at full quality. If it runs, its results come back to the partner's Home with a score.">
          <div className="flex gap-4">
            <Link href="/recording" className="rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">Make another</Link>
            <Link href="/" className={whiteButton("lg")}>Open the partner view</Link>
          </div>
        </FlowPage>
      </>
    )

  return (
    <>
      <StepBar step={2} back={{ href: "/record/script", label: "Script" }} />
      <FlowPage title="Make it without a camera." lead="Your words, animated line by line. Pick a look and a motion; the preview plays as you choose." wide>
        {ready && !lines.length ? (
          <p className="text-slate-500">
            No script yet. <Link href="/recording" className="text-pax2-light-blue underline">Pick or write one first</Link>.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div className="overflow-hidden rounded-3xl bg-black shadow-e3">
              {lines.length > 0 && (
                <Player
                  component={ScriptVideo}
                  inputProps={{ lines, look, motion, ask, name: draft.name }}
                  durationInFrames={frames}
                  fps={FPS}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  style={{ width: "100%", aspectRatio: "9 / 16" }}
                  controls
                  loop
                  autoPlay
                />
              )}
            </div>
            <div className="flex flex-col gap-6">
              <div className="surface flex flex-col gap-3 p-5">
                <p className="font-semibold text-slate-900">Look</p>
                <div className="flex flex-wrap gap-3">
                  {LOOKS.map((l) => (
                    <button key={l.id} type="button" onClick={() => setLook(l)} className={cn("press flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm shadow-e1 transition-shadow", look.id === l.id ? "bg-pax2-blue text-white" : "bg-white text-slate-600 hover:shadow-e2")}>
                      <span className="flex size-7 items-center justify-center rounded-full" style={{ background: l.background, border: `3px solid ${l.accent}` }}>
                        {look.id === l.id && <Check className="size-3.5" style={{ color: l.ink }} />}
                      </span>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="surface flex flex-col gap-3 p-5">
                <p className="font-semibold text-slate-900">Motion</p>
                <div className="flex flex-wrap gap-2">
                  {MOTIONS.map((m) => (
                    <button key={m.id} type="button" onClick={() => setMotion(m.id)} className={chip(motion === m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="surface flex flex-col gap-3 p-5">
                <p className="font-semibold text-slate-900">The ask on the last card</p>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={28} className="rounded-xl border bg-pax2-mist px-4 py-3 outline-none focus:border-pax2-light-blue" />
              </div>
              <div className="surface flex flex-col gap-2 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{lines.length} scenes · {Math.round(frames / FPS)} seconds</p>
                <p>Any number in a line becomes that scene&apos;s headline. Fewer words per line reads better on a phone.</p>
              </div>
              <button
                type="button"
                disabled={state === "sending" || !lines.length}
                onClick={async () => {
                  setState("sending")
                  await submitTake({ id: `studio-${Date.now().toString(36)}`, key: `studio:${look.id}:${motion}`, scriptId: draft.scriptId, title: `${draft.title ?? "Studio video"} · ${look.label}, ${MOTIONS.find((m) => m.id === motion)!.label}`, text: draft.text, name: draft.name, role: draft.role, town: draft.town, seconds: Math.round(frames / FPS), consent: true })
                  setState("sent")
                }}
                className="press flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-semibold text-white shadow-e2 disabled:opacity-40"
              >
                {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null} Send this design <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </FlowPage>
    </>
  )
}
