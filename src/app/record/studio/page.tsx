"use client"

import * as React from "react"
import Link from "next/link"
import { Player } from "@remotion/player"
import { Check, Loader2 } from "lucide-react"

import { submitTake, uploadUrl } from "@/app/actions"
import { submitOriginal, viewer } from "@/app/original-actions"
import { musicUrl, narrate, type Narration } from "@/app/studio-actions"
import { FlowPage } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"
import { ScriptVideo } from "@/components/studio/script-video"
import { DEFAULT_STYLE, FONTS, FPS, LOOKS, MOTIONS, MUSIC, POSITIONS, SIZES, VOICES, WPM_MAX, WPM_MIN, styleLabel, timeline, type StyleRecord } from "@/lib/studio-style"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

/** No camera: the script becomes an animated vertical video, styled in place. Every choice is one
 *  field of the style record (src/lib/studio-style.ts) written onto the take. Save renders it to an
 *  mp4 in the browser (@remotion/web-renderer: no bundle, no server render), with the voice and the
 *  sound bed mixed in when chosen, uploads it to S3 like a recording, and submits it through
 *  submitOriginal, so PAX2 scores it like one; Draft saves it unscored. */
export default function StudioPage() {
  const { draft, ready } = useDraft()
  const [style, setStyle] = React.useState<StyleRecord>(DEFAULT_STYLE)
  const [ask, setAsk] = React.useState("Vote YES on 3")
  const [voice, setVoice] = React.useState<Narration | null>(null)
  const [voicing, setVoicing] = React.useState(false)
  const [music, setMusic] = React.useState<string | null>(null)
  const [state, setState] = React.useState<"idle" | "rendering" | "sending" | "sent" | "error">("idle")
  const [progress, setProgress] = React.useState(0)
  const [err, setErr] = React.useState<string | null>(null)
  const [sentId, setSentId] = React.useState<string | null>(null)
  const [me, setMe] = React.useState<string | null | undefined>(undefined)
  const [email, setEmail] = React.useState("")
  React.useEffect(() => {
    viewer().then((v) => setMe(v?.email ?? null))
  }, [])
  const lines = React.useMemo(() => (draft.text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 10), [draft.text])
  const set = (patch: Partial<StyleRecord>) => setStyle((s) => ({ ...s, ...patch }))

  // A voice is made once per voice and text, on the server, and kept; silence clears it.
  React.useEffect(() => {
    if (style.voice === "none") {
      setVoice(null)
      return
    }
    if (!lines.length) return
    let alive = true
    setVoicing(true)
    narrate(lines.join("\n"), style.voice)
      .then((n) => alive && setVoice(n))
      .catch((e) => alive && setErr((e as Error).message))
      .finally(() => alive && setVoicing(false))
    return () => {
      alive = false
    }
  }, [style.voice, lines])
  React.useEffect(() => {
    musicUrl(style.music).then(setMusic)
  }, [style.music])

  const marks = style.voice !== "none" && voice ? voice.marks : null
  const t = timeline(lines, style, marks)
  const frames = Math.max(FPS * 3, t.total)
  const seconds = Math.round(frames / FPS)
  const props = { lines, style, ask, name: draft.name, voiceUrl: style.voice !== "none" ? (voice?.url ?? null) : null, marks, musicUrl: music }
  const withAudio = !!(props.voiceUrl || music)
  const busy = state === "rendering" || state === "sending" || voicing

  const renderTake = async (asDraft: boolean) => {
    setErr(null)
    setProgress(0)
    setState("rendering")
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer")
      const check = await canRenderMediaOnWeb({ container: "mp4", videoCodec: "h264", width: 1080, height: 1920, muted: !withAudio, ...(withAudio ? { audioCodec: "aac" as const } : {}) })
      if (!check.canRender) throw new Error(`This browser can't render the video: ${check.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")}`)
      const { getBlob } = await renderMediaOnWeb({
        composition: { component: ScriptVideo, id: "script-video", width: 1080, height: 1920, fps: FPS, durationInFrames: frames, defaultProps: props },
        inputProps: props,
        container: "mp4",
        videoCodec: "h264",
        muted: !withAudio,
        ...(withAudio ? { audioCodec: "aac" as const } : {}),
        onProgress: (p) => setProgress(p.progress),
        licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
      })
      const blob = await getBlob()
      setState("sending")
      const u = await uploadUrl("video/mp4")
      const r = await fetch(u.url, { method: "PUT", body: blob, headers: { "Content-Type": "video/mp4" } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const label = styleLabel(style)
      const title = `${draft.title ?? "Studio video"} · ${label}`
      const record = JSON.stringify({ ...style, ask, seconds, lines: lines.length, voiceKey: voice?.key ?? null })
      await submitOriginal({ id: u.id, key: u.key, email: me ? undefined : email, scriptId: draft.scriptId, title, text: draft.text, name: draft.name, seconds, consent: true, draft: asDraft, style: record, styleLabel: label })
      await submitTake({ id: u.id, key: u.key, style: record, scriptId: draft.scriptId, title, text: draft.text, name: draft.name, seconds, consent: true })
      setSentId(u.id)
      setState("sent")
    } catch (e) {
      setErr((e as Error).message)
      setState("error")
    }
  }

  const chip = (on: boolean) => cn("press rounded-full px-3.5 py-1.5 text-sm transition-colors", on ? "bg-pax2-blue font-semibold text-white" : "bg-white text-slate-600 shadow-e1 hover:text-pax2-blue")
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
  const toggle = (on: boolean, label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={chip(on)}>
      {label}
    </button>
  )

  if (state === "sent")
    return (
      <FlowPage title="Saved. Thank you.">
        <div className="flex gap-4">
          {sentId && (
            <Link href={`/v/${sentId}`} className="rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
              See the video
            </Link>
          )}
          <Link href="/recording" className={whiteButton("lg")}>Make another</Link>
        </div>
      </FlowPage>
    )

  return (
    <FlowPage title="Make it without a camera." wide>
      {ready && !lines.length ? (
        <p className="text-slate-500">
          No script yet. <Link href="/recording" className="text-pax2-light-blue underline">Pick or write one first</Link>.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-3xl bg-black shadow-e3">
              {lines.length > 0 && (
                <Player key={`${frames}-${props.voiceUrl ?? ""}-${music ?? ""}`} component={ScriptVideo} inputProps={props} durationInFrames={frames} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: "100%", aspectRatio: "9 / 16" }} controls loop autoPlay />
              )}
            </div>
            <p className="text-sm text-slate-600">
              {lines.length} scenes · {seconds} seconds{style.voice !== "none" ? (voicing ? " · making the voice" : voice ? ` · read by ${style.voice}` : "") : ` · ${style.wpm} words a minute`}
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <div className="surface flex flex-col gap-5 p-5">
              <Group title="Color">
                {LOOKS.map((l) => (
                  <button key={l.id} type="button" onClick={() => set({ color: l.id })} className={cn("press flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm shadow-e1 transition-shadow", style.color === l.id ? "bg-pax2-blue text-white" : "bg-white text-slate-600 hover:text-pax2-blue")}>
                    <span className="flex size-7 items-center justify-center rounded-full" style={{ background: l.background, border: `3px solid ${l.accent}` }}>
                      {style.color === l.id && <Check className="size-3.5" style={{ color: l.ink }} />}
                    </span>
                    {l.label}
                  </button>
                ))}
              </Group>
              <Group title="Motion">{MOTIONS.map((m) => toggle(style.motion === m.id, m.label, () => set({ motion: m.id })))}</Group>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-slate-900">Pace</p>
                <div className="flex items-center gap-4">
                  <input type="range" min={WPM_MIN} max={WPM_MAX} step={5} value={style.wpm} disabled={style.voice !== "none"} onChange={(e) => set({ wpm: Number(e.target.value) })} className="w-64 accent-[var(--pax2-blue)] disabled:opacity-40" aria-label="Words a minute" />
                  <span className="tabular text-sm text-slate-700">{style.voice !== "none" ? "the voice sets the pace" : `${style.wpm} words a minute · ${seconds} seconds`}</span>
                </div>
              </div>
            </div>
            <div className="surface flex flex-col gap-5 p-5">
              <Group title="Voice">{VOICES.map((v) => toggle(style.voice === v.id, v.label, () => set({ voice: v.id })))}</Group>
              <p className="-mt-3 text-xs text-slate-500">Sarah, Matilda, Eric and Brian by ElevenLabs; Ruth, Danielle, Stephen and Matthew by Amazon Polly.</p>
              <Group title="Sound bed">{MUSIC.map((m) => toggle(style.music === m.id, m.label, () => set({ music: m.id })))}</Group>
            </div>
            <div className="surface flex flex-col gap-5 p-5">
              <Group title="Typeface">{FONTS.map((f) => toggle(style.font === f.id, f.label, () => set({ font: f.id })))}</Group>
              <Group title="Size">{SIZES.map((s) => toggle(style.size === s.id, s.label, () => set({ size: s.id })))}</Group>
              <Group title="Position">{POSITIONS.map((p) => toggle(style.position === p.id, p.label, () => set({ position: p.id })))}</Group>
              <Group title="Emphasis">
                {toggle(style.emphasis, "Numbers and names in the accent", () => set({ emphasis: true }))}
                {toggle(!style.emphasis, "Plain", () => set({ emphasis: false }))}
              </Group>
            </div>
            <div className="surface flex flex-col gap-5 p-5">
              <Group title="Hook card">
                {toggle(style.hookCard, "The number or the first line first", () => set({ hookCard: true }))}
                {toggle(!style.hookCard, "Straight in", () => set({ hookCard: false }))}
              </Group>
              <Group title="End card">
                {toggle(style.endCard, "Close on the ask", () => set({ endCard: true }))}
                {toggle(!style.endCard, "None", () => set({ endCard: false }))}
              </Group>
              {style.endCard && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-900">Call to action</span>
                  <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={28} className="rounded-xl border bg-pax2-mist px-4 py-3 outline-none focus:border-pax2-light-blue" />
                </label>
              )}
              <Group title="Mark">
                {toggle(!style.mark, "Off", () => set({ mark: false }))}
                {toggle(style.mark, "A small text mark on every scene", () => set({ mark: true }))}
              </Group>
              {style.mark && <input value={style.markText} onChange={(e) => set({ markText: e.target.value })} maxLength={24} placeholder="The words of the mark" className="rounded-xl border bg-pax2-mist px-4 py-3 outline-none focus:border-pax2-light-blue" />}
            </div>
            <div className="surface flex flex-col gap-3 p-5">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-800">Email</span>
                <input type="email" value={me ?? email} disabled={!!me} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border bg-pax2-mist px-3 py-2 outline-none focus:border-pax2-light-blue disabled:text-slate-500" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" disabled={busy || !lines.length || (me === null && !/^\S+@\S+\.\S+$/.test(email))} onClick={() => renderTake(false)} className="press flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-semibold text-white shadow-e2 disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {state === "rendering" ? `Rendering ${Math.round(progress * 100)}%` : state === "sending" ? "Saving" : "Save"}
              </button>
              <button type="button" disabled={busy || !lines.length || (me === null && !/^\S+@\S+\.\S+$/.test(email))} onClick={() => renderTake(true)} className="press rounded-full bg-pax2-blue/70 px-7 py-4 font-semibold text-white shadow-e2 disabled:opacity-40">
                Draft
              </button>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
        </div>
      )}
    </FlowPage>
  )
}
