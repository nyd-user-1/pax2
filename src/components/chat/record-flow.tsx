'use client'

// The recording, inside the chat column: /record/camera's stages dressed as the chat's blocks
// (nova Card with the title header; camera-flow.tsx keeps the page version). Record on the script
// card opens the full-screen Teleprompter at once — closing it without a take leaves this card as
// the way back in, with the upload fallback. Watch-back and send happen in the card; while PAX2
// scores, the card says the link is on its way and the Consensus card asks about the experience;
// when the scoring lands, onDone carries the video id up (the camera button's dot, the analysis offer).

import * as React from 'react'
import { Check, CheckCircle2, ChevronRight, Loader2, RotateCcw, Upload, Video } from 'lucide-react'

import { uploadUrl } from '@/app/actions'
import { myAnalysis, submitOriginal, viewer } from '@/app/original-actions'
import { EnhanceFlow } from '@/components/chat/enhance-flow'
import { ConsensusVote } from '@/components/consensus-vote'
import { Teleprompter } from '@/components/record/teleprompter'
import { useDraft } from '@/components/record/draft'
import { type VideoProvider } from '@/lib/video-model-options'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'

type Clip = { blob: Blob; url: string; seconds: number; mime: string }
export type Analysis = NonNullable<Awaited<ReturnType<typeof myAnalysis>>>

const TIPS = ['Find a quiet spot with light on your face, not behind you.', 'Hold your phone upright, around eye level.', 'Talk to the lens like you are talking to a friend.']

// The experience, judged one statement at a time — agree, disagree or pass — through Consensus.
const FEEDBACK = [
  { tid: 1, text: 'Building the script in the chat felt easy.' },
  { tid: 2, text: 'The questions asked were the right ones.' },
  { tid: 3, text: 'The teleprompter pace felt natural.' },
  { tid: 4, text: 'It was clear what would happen at each step.' },
  { tid: 5, text: 'Recording this way beats recording alone.' },
]

const CARD = 'my-3 animate-in fade-in slide-in-from-bottom-1 duration-300'
const FIELD = 'w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[15px] text-[var(--txt)] outline-none transition-colors placeholder:text-[var(--muted2)] focus:border-pax2-light-blue disabled:text-slate-500'

export function RecordFlow({ script, videoModel, onDone, onAnalysis }: { script: string; videoModel: VideoProvider; onDone: (id: string) => void; onAnalysis: (a: Analysis) => void }) {
  const { draft } = useDraft()
  // Record on the script card means record: the teleprompter opens at once.
  const [prompter, setPrompter] = React.useState(true)
  const [clip, setClip] = React.useState<Clip | null>(null)
  const [stage, setStage] = React.useState<'ready' | 'sending' | 'done' | 'error'>('ready')
  const [err, setErr] = React.useState<string | null>(null)
  const [me, setMe] = React.useState<string | null | undefined>(undefined)
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null)
  const [sent, setSent] = React.useState<{ id: string; key: string } | null>(null)
  const file = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    viewer().then((v) => setMe(v?.email ?? null))
  }, [])
  React.useEffect(() => {
    setName((n) => n || draft.name || '')
    setLastName((n) => n || draft.lastName || '')
  }, [draft.name, draft.lastName])

  const take = (f: File) => {
    const url = URL.createObjectURL(f)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => setClip({ blob: f, url, seconds: v.duration || 0, mime: f.type || 'video/mp4' })
    v.src = url
  }

  const emailOk = !!me || /^\S+@\S+\.\S+$/.test(email)

  const send = async () => {
    if (!clip || !emailOk) return
    setStage('sending')
    setErr(null)
    try {
      const u = await uploadUrl(clip.mime.split(';')[0])
      const r = await fetch(u.url, { method: 'PUT', body: clip.blob, headers: { 'Content-Type': clip.mime.split(';')[0] } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const fullName = [name, lastName].map((x) => x.trim()).filter(Boolean).join(' ') || undefined
      await submitOriginal({ id: u.id, key: u.key, email: me ? undefined : email, text: script, name: fullName, seconds: Math.round(clip.seconds), consent: true })
      setSent({ id: u.id, key: u.key })
      setStage('done')
      onDone(u.id)
      const a = await myAnalysis(u.id)
      if (a) setAnalysis(a)
    } catch (e) {
      setErr((e as Error).message)
      setStage('error')
    }
  }

  if (stage === 'done')
    return (
      <>
        <Card size="sm" className={CARD}>
          <CardHeader className="border-b [.border-b]:pb-2">
            <CardTitle>Your video is in</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-800">
            {analysis ? (
              <>
                <p>The scoring is done. The free analysis reads it several ways — the forecast, the persuasion traits in your words, the title.</p>
                <button type="button" onClick={() => onAnalysis(analysis)} className="flex w-fit items-center gap-1.5 rounded-full bg-pax2-blue px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-85">
                  Walk me through it <ChevronRight className="size-4" />
                </button>
              </>
            ) : (
              <p>The link to your video and its analysis is on its way to your email.</p>
            )}
          </CardContent>
        </Card>
        {clip && sent && (
          <EnhanceFlow
            clipUrl={clip.url}
            clipKey={sent.key}
            seconds={Math.round(clip.seconds)}
            script={script}
            parentId={sent.id}
            email={me ? null : email}
            defaultProvider={videoModel}
            onScored={(id) => {
              onDone(id)
              myAnalysis(id).then((a) => a && setAnalysis(a))
            }}
          />
        )}
      </>
    )

  if (stage === 'sending')
    return (
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Processing</CardTitle>
          <CardAction>
            <Loader2 className="size-4 animate-spin text-pax2-blue" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-800">
          <p>Your video is uploading and being scored — a few minutes, and the link lands in your email either way. While it works, a few quick judgments would help make this better:</p>
          <ConsensusVote slug="record-experience" statements={FEEDBACK} voted={{}} finished="All five judged — thank you." />
        </CardContent>
      </Card>
    )

  if (clip)
    return (
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Watch it back</CardTitle>
          <CardAction>
            <button type="button" onClick={() => setClip(null)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-muted hover:text-pax2-blue">
              <RotateCcw className="size-3.5" /> Try again
            </button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <video src={clip.url} controls playsInline className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" />
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-slate-800">{Math.round(clip.seconds)} seconds. Send it, or try again.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-800">First name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-800">Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-800">Email</span>
              <input type="email" value={me ?? email} disabled={!!me} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
            </label>
            <div className="flex items-center gap-3">
              <button type="button" disabled={!emailOk} onClick={send} className="flex items-center gap-2 rounded-full bg-pax2-blue px-6 py-2.5 font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40">
                <Check className="size-4" /> Send it
              </button>
              {err && <p className="text-destructive">{err}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    )

  return (
    <>
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Record with the teleprompter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <button type="button" onClick={() => setPrompter(true)} className="flex items-center justify-center gap-2 rounded-full bg-pax2-blue py-3.5 font-medium text-white shadow-lg transition-opacity hover:opacity-90">
            <Video className="size-4" /> Start recording
          </button>
          <button type="button" onClick={() => file.current?.click()} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-left transition-colors hover:border-pax2-light-blue">
            <Upload className="size-4 shrink-0 text-pax2-blue" />
            <span className="text-sm text-slate-800">Already recorded it? Choose a file.</span>
            <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && take(e.target.files[0])} />
          </button>
          <ul className="flex flex-col gap-1.5">
            {TIPS.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-slate-800">
                <CheckCircle2 className="size-3.5 shrink-0 text-pax2-blue" /> {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {prompter && (
        <Teleprompter
          text={script}
          onClose={() => setPrompter(false)}
          onDone={(blob, seconds, mime) => {
            setPrompter(false)
            setClip({ blob, url: URL.createObjectURL(blob), seconds, mime })
          }}
        />
      )}
    </>
  )
}
