"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Loader2, RotateCcw, Upload, Video } from "lucide-react"

import { uploadUrl } from "@/app/actions"
import { againDraft, submitOriginal, viewer } from "@/app/original-actions"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"
import { Teleprompter } from "@/components/record/teleprompter"
import { RevealFx } from "@/components/reveal-fx"
import { cn } from "@/ui/lib/utils"

type Clip = { blob: Blob; url: string; seconds: number; mime: string; source: "recorded" | "uploaded" }

const TIPS = ["Find a quiet spot with light on your face, not behind you.", "Hold your phone upright, around eye level.", "Talk to the lens like you're talking to a friend."]

/** The recording step: the teleprompter or an upload, then watch it back and send it. /record/camera
 *  shows it with the step bar; the landing shows it in place after Make it yours, `embedded`, where
 *  each stage wipes in under its own heading and `onBack` returns to the script. */
export function CameraFlow({ embedded }: { embedded?: { onBack: () => void } }) {
  const { draft, update, ready } = useDraft()
  const [prompter, setPrompter] = React.useState(false)
  const [clip, setClip] = React.useState<Clip | null>(null)
  const [drag, setDrag] = React.useState(false)
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle")
  const [err, setErr] = React.useState<string | null>(null)
  const file = React.useRef<HTMLInputElement>(null)
  // Signed in, the account's email gets the link; signed out, the sender types one.
  const [me, setMe] = React.useState<string | null | undefined>(undefined)
  const [email, setEmail] = React.useState("")
  React.useEffect(() => {
    viewer().then((v) => setMe(v?.email ?? null))
  }, [])
  // From the findings email: record the same script again, as the next version of that video.
  React.useEffect(() => {
    if (!ready) return
    const again = new URLSearchParams(window.location.search).get("again")
    if (again && draft.again !== again) againDraft(again).then((d) => d && update({ ...d, again }))
  }, [ready, draft.again, update])

  const take = (f: File) => {
    const url = URL.createObjectURL(f)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => setClip({ blob: f, url, seconds: v.duration || 0, mime: f.type || "video/mp4", source: "uploaded" })
    v.src = url
  }

  const send = async (asDraft = false) => {
    if (!clip) return
    setState("sending")
    setErr(null)
    try {
      const u = await uploadUrl(clip.mime.split(";")[0])
      const r = await fetch(u.url, { method: "PUT", body: clip.blob, headers: { "Content-Type": clip.mime.split(";")[0] } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const name = [draft.name, draft.lastName].map((x) => (x ?? "").trim()).filter(Boolean).join(" ") || undefined
      await submitOriginal({ id: u.id, key: u.key, email: me ? undefined : email, scriptId: draft.scriptId, title: draft.title, text: draft.text, name, seconds: Math.round(clip.seconds), consent: true, parent: draft.again, draft: asDraft })
      update({ again: undefined })
      setState("sent")
    } catch (e) {
      setErr((e as Error).message)
      setState("error")
    }
  }

  if (state === "sent")
    return (
      <Frame embedded={!!embedded} back={{ href: "/recording", label: "Start" }} title="Thanks, we'll send you a link to your video soon.">
          <div className="flex flex-col gap-4 surface p-7">
            <CheckCircle2 className="size-10 text-primary" />
            <div className="flex flex-wrap gap-4">
              <Link href="/recording" className="rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">Record another</Link>
              {me && <Link href="/videos" className="rounded-full border px-6 py-3 font-medium text-pax2-blue">Your videos</Link>}
            </div>
          </div>
      </Frame>
    )

  if (clip)
    return (
      <Frame embedded={!!embedded} back={{ href: "/record/script", label: "Script" }} title="Looks good?" lead="Watch it back. Send it, or try again.">
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <video src={clip.url} controls playsInline className="aspect-[9/16] w-full rounded-3xl bg-black object-cover shadow-xl" />
            <div className="flex flex-col gap-4">
              <div className="surface p-6 text-sm">
                <p className="font-medium text-pax2-blue">{draft.title ?? "Your video"}</p>
                <p className="text-slate-800">{Math.round(clip.seconds)} seconds</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["name", "lastName"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1">
                      <span className="text-xs text-slate-800">{k === "name" ? "First name" : "Last name"}</span>
                      <input value={draft[k] ?? ""} onChange={(e) => update({ [k]: e.target.value })} className="rounded-lg border bg-pax2-mist px-3 py-2 outline-none focus:border-primary" />
                    </label>
                  ))}
                </div>
                <label className="mt-4 flex flex-col gap-1">
                  <span className="text-xs text-slate-800">Email</span>
                  <input type="email" value={me ?? email} disabled={!!me} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border bg-pax2-mist px-3 py-2 outline-none focus:border-primary disabled:text-slate-500" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" disabled={state === "sending" || (me === null && !/^\S+@\S+\.\S+$/.test(email))} onClick={() => send(false)} className="flex items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-medium text-white shadow-lg disabled:opacity-40">
                  {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null} Save
                </button>
                <button type="button" disabled={state === "sending" || (me === null && !/^\S+@\S+\.\S+$/.test(email))} onClick={() => send(true)} className="rounded-full bg-pax2-blue/70 px-7 py-4 font-medium text-white shadow-lg disabled:opacity-40">
                  Draft
                </button>
                <button type="button" onClick={() => setClip(null)} className="flex items-center gap-2 font-medium text-primary">
                  <RotateCcw className="size-4" /> Try again
                </button>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
            </div>
          </div>
      </Frame>
    )

  return (
    <>
      <Frame embedded={!!embedded} back={{ href: "/record/script", label: "Script" }} title="Ready when you are." lead="Your script will scroll on screen while you record. Don't worry about getting it perfect — you can always try again.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-5 surface p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-pax2-mist">
                <Video className="size-5 text-pax2-blue" />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-semibold text-pax2-blue">Record with the teleprompter</span>
                <span className="text-slate-800">PAX2 opens your camera and scrolls your words for you.</span>
              </span>
            </div>
            <button type="button" disabled={!ready || !draft.text} onClick={() => setPrompter(true)} className="flex items-center justify-center gap-2 rounded-full bg-pax2-blue py-4 font-medium text-white shadow-lg disabled:opacity-40">
              <Video className="size-4" /> Start recording
            </button>
            {ready && !draft.text && (
              <p className="text-sm text-slate-800">
                No script yet. <Link href="/recording" className="text-primary underline">Pick or write one first</Link>, or upload a video below.
              </p>
            )}
          </div>
          <div
            id="upload"
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const f = e.dataTransfer.files[0]
              if (f) take(f)
            }}
            onClick={() => file.current?.click()}
            className={cn("flex cursor-pointer items-center gap-4 rounded-3xl border-2 border-dashed bg-pax2-mist p-6 transition-colors", drag && "border-primary bg-white")}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white">
              <Upload className="size-5 text-pax2-blue" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-semibold text-pax2-blue">Already recorded it?</span>
              <span className="text-slate-800">Drop your video here, or choose a file.</span>
            </span>
            <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && take(e.target.files[0])} />
          </div>
          <div className="rounded-3xl bg-white/70 p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-800">A few things that help</p>
            <ul className="flex flex-col gap-2">
              {TIPS.map((t) => (
                <li key={t} className="flex items-center gap-2 text-pax2-blue">
                  <CheckCircle2 className="size-4 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
          {embedded && (
            <button type="button" onClick={embedded.onBack} className="self-start font-medium text-primary">
              Back to the script
            </button>
          )}
        </div>
      </Frame>
      {prompter && draft.text && (
        <Teleprompter
          text={draft.text}
          onClose={() => setPrompter(false)}
          onDone={(blob, seconds, mime) => {
            setPrompter(false)
            setClip({ blob, url: URL.createObjectURL(blob), seconds, mime, source: "recorded" })
          }}
        />
      )}
    </>
  )
}

/** A stage's chrome: the way back and the page on /record/camera; in place on the landing, a
 *  heading over the stage, wiping in as each stage replaces the last. */
function Frame({ embedded, back, title, lead, children }: { embedded: boolean; back: { href: string; label: string }; title: string; lead?: string; children: React.ReactNode }) {
  if (embedded)
    return (
      <RevealFx key={title} translateY={4} className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h2 className="font-display text-4xl font-semibold leading-tight text-pax2-blue md:text-5xl">{title}</h2>
          {lead && <p className="text-lg text-slate-800">{lead}</p>}
        </header>
        {children}
      </RevealFx>
    )
  return (
    <>
      <StepBar back={back} />
      <FlowPage title={title} lead={lead}>
        {children}
      </FlowPage>
    </>
  )
}
