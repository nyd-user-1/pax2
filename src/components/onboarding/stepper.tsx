"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3, Check, ChevronLeft, Clapperboard, Gauge, LineChart, PenLine, Send, Sparkles, Upload, Video } from "lucide-react"

import { linkUpload, myVideos, saveProfile, videoUploadUrl, type Profile } from "@/app/onboarding-actions"
import { whiteButton } from "@/components/white-button"
import { ChannelCard, ChannelChip } from "@/components/onboarding/ingest"
import type { Progress } from "@/lib/channel-ingest"
import { cn } from "@/ui/lib/utils"

// The onboarding stepper, after account creation at /signup, copied from ElevenLabs' app onboarding
// (elevenlabs.io/app/onboarding) as the baseline: a white page with no header, one step at a time in a
// 451px column, plain left-aligned headings, small black buttons, a Skip that turns into Continue once
// something is picked, the back chevron beside it, and a dot rail at the foot. The step rides in ?step=
// so Google's consent screen returns to the connect step.

const STEPS = ["about", "makes", "wants", "connect", "upload", "done"] as const
type Step = (typeof STEPS)[number]

const MAKES = [
  { key: "shorts", label: "Shorts and Reels" },
  { key: "long", label: "Longer videos" },
  { key: "scripts", label: "Scripts without a camera" },
]

const WANTS = [
  { key: "record", label: "Content Generation", icon: Sparkles },
  { key: "studio", label: "Studio Effects", icon: Clapperboard },
  { key: "score", label: "Video Analysis", icon: Gauge },
  { key: "publish", label: "Publishing Reach", icon: Send },
  { key: "track", label: "Performance Tracking", icon: LineChart },
  { key: "write", label: "Script Writing", icon: PenLine },
]

export type ConnectedForStepper = { channelId: string; title: string; thumbnail: string | null; progress: Progress | null }

const FIELD = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
const BLACK = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-[15px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
const OUTLINE = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-950 transition-colors hover:bg-slate-50 disabled:opacity-40"
const EMPTY: Profile = { name: "", lastName: "", role: "", town: "", heard: "", makes: [], wants: [] }

export function Stepper({ initial, channels }: { initial: Profile | null; channels: ConnectedForStepper[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const asked = params.get("step") as Step | null
  const step: Step = asked && STEPS.includes(asked) ? asked : "about"
  const at = STEPS.indexOf(step)
  const [profile, setProfile] = React.useState<Profile>(initial ?? EMPTY)
  const [busy, setBusy] = React.useState(false)
  const ytError = params.get("youtube_error")

  const go = (s: Step) => router.push(`/signup/welcome?step=${s}`, { scroll: false })
  const back = at > 0 ? () => go(STEPS[at - 1]) : null
  const next = async () => {
    setBusy(true)
    try {
      await saveProfile(profile)
    } finally {
      setBusy(false)
    }
    go(STEPS[Math.min(at + 1, STEPS.length - 1)])
  }
  const skip = () => go(STEPS[at + 1])
  const finish = async () => {
    setBusy(true)
    await saveProfile({ ...profile, finished: true }).catch(() => null)
    // The record flow picks up the messenger's name, role and town from its draft.
    try {
      const k = "pax2-record-draft"
      const d = JSON.parse(sessionStorage.getItem(k) ?? "{}")
      sessionStorage.setItem(k, JSON.stringify({ ...d, name: profile.name, lastName: profile.lastName, role: profile.role, town: profile.town }))
    } catch {}
    router.push(channels.length ? "/my-channels" : "/app/home")
  }
  const toggle = (field: "makes" | "wants", key: string) => setProfile((p) => ({ ...p, [field]: p[field].includes(key) ? p[field].filter((k) => k !== key) : [...p[field], key] }))

  return (
    <main className="flex min-h-dvh w-full justify-center bg-white px-5">
      <section className="flex w-full max-w-[451px] flex-col justify-center pb-24 pt-16">
        {step === "about" && (
          <div className="flex flex-col gap-6">
            <Heading>Help us personalize your experience</Heading>
            <Field label="What's your name?">
              <div className="grid grid-cols-2 gap-3">
                <input autoFocus aria-label="First name" autoComplete="given-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={FIELD} />
                <input aria-label="Last name" autoComplete="family-name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} className={FIELD} />
              </div>
            </Field>
            <Field label="What's your role?">
              <input value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} className={FIELD} />
            </Field>
            <Field label="Where are you based?">
              <input autoComplete="address-level2" value={profile.town} onChange={(e) => setProfile({ ...profile, town: e.target.value })} className={FIELD} />
            </Field>
            <Field label="How did you hear about us?" optional>
              <input value={profile.heard} onChange={(e) => setProfile({ ...profile, heard: e.target.value })} placeholder="A friend, a campaign, social media..." className={FIELD} />
            </Field>
            <Actions back={null} busy={busy || !profile.name.trim()} ready onContinue={next} />
          </div>
        )}

        {step === "makes" && (
          <div className="flex flex-col gap-8">
            <Heading>What content do you produce?</Heading>
            <div className="flex flex-col gap-3">
              <Sub>Select one or more</Sub>
              {MAKES.map((m) => (
                <Option key={m.key} label={m.label} on={profile.makes.includes(m.key)} onClick={() => toggle("makes", m.key)} />
              ))}
            </div>
            <Actions back={back} busy={busy} ready={profile.makes.length > 0} onContinue={next} onSkip={skip} />
          </div>
        )}

        {step === "wants" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Heading>What would you like to do with PAX?</Heading>
              <Sub>Select all that apply</Sub>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {WANTS.map((w) => (
                <Tile key={w.key} icon={w.icon} label={w.label} on={profile.wants.includes(w.key)} onClick={() => toggle("wants", w.key)} />
              ))}
            </div>
            <Actions back={back} busy={busy} ready={profile.wants.length > 0} onContinue={next} onSkip={skip} />
          </div>
        )}

        {step === "connect" && (
          <div className="flex flex-col gap-5">
            <Heading>Connect YouTube</Heading>
            {ytError && <p className="rounded-xl bg-pax2-red-deep/10 px-4 py-3 text-sm text-pax2-red-deep">{ytError === "access_denied" ? "Google's consent was cancelled; nothing was connected." : ytError}</p>}
            {channels.map((c) => (
              <ChannelCard key={c.channelId} channelId={c.channelId} title={c.title} thumbnail={c.thumbnail} initial={c.progress} />
            ))}
            <a href={connectHref} className={cn(OUTLINE, "h-12 w-full")}>
              <YouTubeMark /> {channels.length ? "Connect another channel" : "Connect YouTube"}
            </a>
            <Actions back={back} ready={channels.length > 0} onContinue={skip} onSkip={skip} />
            <p className="text-center text-sm text-slate-500">*Provides read-only analytics authorization.</p>
          </div>
        )}

        {step === "upload" && (
          <div className="flex flex-col gap-6">
            <Heading>Upload your videos</Heading>
            <Uploader hasChannels={channels.length > 0} />
            <Actions back={back} busy={false} ready={false} onContinue={skip} onSkip={skip} />
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-6">
            <Heading>{channels.length ? "PAX is analyzing your channels" : "You're all set"}</Heading>
            {channels.length > 0 && (
              <div className="flex flex-col gap-2">
                {channels.map((c) => (
                  <ChannelChip key={c.channelId} channelId={c.channelId} title={c.title} thumbnail={c.thumbnail} initial={c.progress} />
                ))}
              </div>
            )}
            <Actions back={back} busy={busy} ready onContinue={finish} label={channels.length ? "View analysis" : "Go to PAX"} />
          </div>
        )}
      </section>

      <nav aria-label="Onboarding progress" className="fixed inset-x-0 bottom-0 flex justify-center gap-1.5 pb-8">
        {STEPS.map((s, i) => (
          <button key={s} type="button" aria-label={`Step ${i + 1}`} aria-current={i === at ? "step" : undefined} disabled={i > at} onClick={() => go(s)} className={cn("h-1.5 rounded-full transition-all", i === at ? "w-6 bg-slate-950" : "w-1.5 bg-slate-300 enabled:hover:bg-slate-400")} />
        ))}
      </nav>
    </main>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="m-0 text-[30px] font-normal leading-tight tracking-[-0.01em] text-slate-950">{children}</h1>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-slate-500">{children}</p>
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-[15px] font-medium text-slate-950">
      <span>{label}{optional && <span className="font-normal text-slate-400"> (optional)</span>}</span>
      {children}
    </label>
  )
}

function Option({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="flex items-center gap-3 text-left text-[17px] text-slate-950">
      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", on ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white")}>
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  )
}

function Tile({ icon: Icon, label, on, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border bg-white px-2 text-center transition-colors", on ? "border-slate-950 ring-1 ring-slate-950" : "border-slate-200 hover:border-slate-300")}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-pax2-lavender/70 text-pax2-blue">
        <Icon className="size-5" />
      </span>
      <span className="text-[14px] leading-snug text-slate-950">{label}</span>
    </button>
  )
}

function BackChevron({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Back" className={whiteButton("circle")}>
      <ChevronLeft className="size-4" />
    </button>
  )
}

/** Every step's action row: the circled back chevron on the left, the action on the right —
 *  Skip until something is picked, then Continue. */
function Actions({ back, busy, ready, onContinue, onSkip, label = "Continue", extra }: { back: (() => void) | null; busy?: boolean; ready: boolean; onContinue: () => void; onSkip?: () => void; label?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {back ? <BackChevron onClick={back} /> : <span />}
      <span className="flex items-center gap-4">
        {extra}
        {ready || !onSkip ? (
          <button type="button" disabled={busy} onClick={onContinue} className={BLACK}>{label}</button>
        ) : (
          <button type="button" onClick={onSkip} className={OUTLINE}>Skip</button>
        )}
      </span>
    </div>
  )
}

function YouTubeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z" />
      <path fill="#fff" d="m9.6 15.6 6.2-3.6-6.2-3.6v7.2Z" />
    </svg>
  )
}

const connectHref = `/api/youtube/oauth?mode=connect&return=${encodeURIComponent("/signup/welcome?step=connect")}`

// ---------- The uploader ----------

type Item = { uploadId: string; key: string; name: string; size: number; sent: number; state: "sending" | "sent" | "failed"; error?: string; youtubeId: string | null; channelId: string | null }
type Vid = Awaited<ReturnType<typeof myVideos>>[number]

const stem = (n: string) => n.replace(/\.[^.]+$/, "").trim().toLowerCase()

function put(url: string, file: File, onProgress: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open("PUT", url)
    x.setRequestHeader("Content-Type", file.type)
    x.upload.onprogress = (e) => onProgress(e.loaded)
    x.onload = () => (x.status < 300 ? resolve() : reject(new Error(`S3 refused the file (${x.status}).`)))
    x.onerror = () => reject(new Error("The upload was interrupted."))
    x.send(file)
  })
}

function Uploader({ hasChannels }: { hasChannels: boolean }) {
  const [items, setItems] = React.useState<Item[]>([])
  const [videos, setVideos] = React.useState<Vid[]>([])
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (hasChannels) myVideos().then(setVideos).catch(() => null)
  }, [hasChannels])
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.uploadId === id ? { ...x, ...p } : x)))

  const add = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const type = file.type || (file.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "")
      let up: { id: string; key: string; url: string }
      try {
        up = await videoUploadUrl(type)
      } catch (e) {
        setItems((xs) => [...xs, { uploadId: `x-${file.name}-${Date.now()}`, key: "", name: file.name, size: file.size, sent: 0, state: "failed", error: (e as Error).message, youtubeId: null, channelId: null }])
        continue
      }
      // A Takeout file is named for the video's title, so a title match is linked from the start.
      const match = videos.find((v) => stem(v.title) === stem(file.name))
      setItems((xs) => [...xs, { uploadId: up.id, key: up.key, name: file.name, size: file.size, sent: 0, state: "sending", youtubeId: match?.youtubeId ?? null, channelId: match?.channelId ?? null }])
      try {
        await put(up.url, new File([file], file.name, { type }), (n) => patch(up.id, { sent: n }))
        await linkUpload({ uploadId: up.id, key: up.key, name: file.name, youtubeId: match?.youtubeId ?? null, channelId: match?.channelId ?? null })
        patch(up.id, { state: "sent", sent: file.size })
      } catch (e) {
        patch(up.id, { state: "failed", error: (e as Error).message })
      }
    }
  }

  const relink = async (it: Item, youtubeId: string) => {
    const v = videos.find((x) => x.youtubeId === youtubeId) ?? null
    patch(it.uploadId, { youtubeId: v?.youtubeId ?? null, channelId: v?.channelId ?? null })
    if (it.state === "sent") await linkUpload({ uploadId: it.uploadId, key: it.key, name: it.name, youtubeId: v?.youtubeId ?? null, channelId: v?.channelId ?? null }).catch(() => null)
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => (e.preventDefault(), setOver(false), add(e.dataTransfer.files))}
        className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center transition-colors", over ? "border-slate-950 bg-slate-50" : "border-slate-200 hover:border-slate-300")}
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-950"><Upload className="size-5" /></span>
        <span className="text-[15px] font-medium text-slate-950">Drop mp4 files or choose them</span>
        <span className="text-xs text-slate-500">Transcript, audio, frames and memorability, about four minutes a video.</span>
      </button>
      <input ref={input} type="file" accept="video/mp4,video/webm" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.uploadId} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Video className="size-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-950">{it.name}</p>
                  {it.state === "sending" ? (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-950 transition-all" style={{ width: `${Math.round((it.sent / Math.max(1, it.size)) * 100)}%` }} /></div>
                  ) : (
                    <p className={cn("text-xs", it.state === "failed" ? "text-pax2-red-deep" : "text-slate-500")}>{it.state === "failed" ? it.error : "Uploaded; content analysis is running"}</p>
                  )}
                </div>
              </div>
              {videos.length > 0 && it.state !== "failed" && (
                <select value={it.youtubeId ?? ""} onChange={(e) => relink(it, e.target.value)} aria-label={`Which YouTube video ${it.name} is`} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950">
                  <option value="">Not on YouTube</option>
                  {videos.map((v) => (
                    <option key={v.youtubeId} value={v.youtubeId}>{v.title}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-950"><BarChart3 className="size-4 text-slate-500" /> Getting your files from YouTube</summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 leading-relaxed">
          <li>One video: in YouTube Studio, open Content, then the video&apos;s three-dot menu, then Download. The file is an mp4.</li>
          <li>Every video at once: at takeout.google.com, deselect all, select YouTube and YouTube Music, keep only videos, and export. Google emails a link when the archive is ready; each file is named for its video&apos;s title, so PAX links it to the video by itself.</li>
          <li>Until a file arrives, a video shows its YouTube Analytics and the PAX2 Classifier forecast only.</li>
        </ol>
      </details>
    </div>
  )
}
