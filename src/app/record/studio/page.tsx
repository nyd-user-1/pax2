"use client"

import * as React from "react"
import Link from "next/link"
import { Player } from "@remotion/player"
import { ArrowRight, Check, Loader2 } from "lucide-react"

import { submitTake, uploadUrl } from "@/app/actions"
import { submitOriginal, viewer } from "@/app/original-actions"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"
import { FPS, LOOKS, ScriptVideo, totalFrames, type Motion } from "@/components/studio/script-video"
import { nextWeekdayNine } from "@/lib/post-time"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

const MOTIONS: { id: Motion; label: string }[] = [
  { id: "rise", label: "Rise" },
  { id: "zoom", label: "Zoom" },
  { id: "type", label: "Word by word" },
]

/** No camera: the script becomes an animated vertical video, styled in place. "Use this take" renders
 *  it to an mp4 in the browser (@remotion/web-renderer: no bundle, no server render), uploads it to
 *  S3 like a recording, and submits it through submitOriginal, so PAX2 scores it like one. */
export default function StudioPage() {
  const { draft, ready } = useDraft()
  const [look, setLook] = React.useState(LOOKS[0])
  const [motion, setMotion] = React.useState<Motion>("rise")
  const [ask, setAsk] = React.useState("Vote YES on 3")
  const [state, setState] = React.useState<"idle" | "rendering" | "sending" | "sent" | "error">("idle")
  const [progress, setProgress] = React.useState(0)
  const [err, setErr] = React.useState<string | null>(null)
  const [sentId, setSentId] = React.useState<string | null>(null)
  const [consent, setConsent] = React.useState(false)
  // Signed in, the account's email gets the link; signed out, the sender types one.
  const [me, setMe] = React.useState<string | null | undefined>(undefined)
  const [email, setEmail] = React.useState("")
  React.useEffect(() => {
    viewer().then((v) => setMe(v?.email ?? null))
  }, [])
  const lines = React.useMemo(() => (draft.text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 10), [draft.text])
  const frames = Math.max(FPS * 3, totalFrames(lines))
  const busy = state === "rendering" || state === "sending"

  const renderTake = async () => {
    setErr(null)
    setProgress(0)
    setState("rendering")
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer")
      const check = await canRenderMediaOnWeb({ container: "mp4", videoCodec: "h264", width: 1080, height: 1920, muted: true })
      if (!check.canRender) throw new Error(`This browser can't render the video: ${check.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")}`)
      const props = { lines, look, motion, ask, name: draft.name }
      const { getBlob } = await renderMediaOnWeb({
        composition: { component: ScriptVideo, id: "script-video", width: 1080, height: 1920, fps: FPS, durationInFrames: frames, defaultProps: props },
        inputProps: props,
        container: "mp4",
        videoCodec: "h264",
        muted: true,
        onProgress: (p) => setProgress(p.progress),
        licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
      })
      const blob = await getBlob()
      setState("sending")
      const u = await uploadUrl("video/mp4")
      const r = await fetch(u.url, { method: "PUT", body: blob, headers: { "Content-Type": "video/mp4" } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const seconds = Math.round(frames / FPS)
      const title = `${draft.title ?? "Studio video"} · ${look.label}, ${MOTIONS.find((m) => m.id === motion)!.label}`
      await submitOriginal({ id: u.id, key: u.key, email: me ? undefined : email, scriptId: draft.scriptId, title, text: draft.text, name: draft.name, role: draft.role, town: draft.town, seconds, consent, publishAt: draft.publishAt ?? nextWeekdayNine() })
      await submitTake({ id: u.id, key: u.key, style: `${look.id}:${motion}`, scriptId: draft.scriptId, title, text: draft.text, name: draft.name, role: draft.role, town: draft.town, seconds, consent })
      setSentId(u.id)
      setState("sent")
    } catch (e) {
      setErr((e as Error).message)
      setState("error")
    }
  }

  const chip = (on: boolean) => cn("press rounded-full px-3.5 py-1.5 text-sm transition-colors", on ? "bg-pax2-blue font-semibold text-white" : "bg-white text-slate-600 shadow-e1 hover:text-pax2-blue")

  if (state === "sent")
    return (
      <>
        <StepBar step={3} back={{ href: "/record", label: "Home" }} />
        <FlowPage title="Sent. Thank you.">
          <div className="flex gap-4">
            {sentId && (
              <Link href={`/v/${sentId}`} className="rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
                See the video
              </Link>
            )}
            <Link href="/recording" className={whiteButton("lg")}>Make another</Link>
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
              <div className="surface flex flex-col gap-3 p-5">
                {me === null && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-800">Email, for the link to the video</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border bg-pax2-mist px-3 py-2 outline-none focus:border-pax2-light-blue" />
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[var(--primary)]" />
                  <span className="text-slate-800">The campaign may edit this video, run it as a paid ad, and describe me by what I wrote.</span>
                </label>
              </div>
              <button
                type="button"
                disabled={busy || !lines.length || !consent || (me === null && !/^\S+@\S+\.\S+$/.test(email))}
                onClick={renderTake}
                className="press flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-semibold text-white shadow-e2 disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {state === "rendering" ? `Rendering ${Math.round(progress * 100)}%` : state === "sending" ? "Sending" : "Use this take"}
                {!busy && <ArrowRight className="size-4" />}
              </button>
              {err && <p className="text-sm text-destructive">{err}</p>}
            </div>
          </div>
        )}
      </FlowPage>
    </>
  )
}
