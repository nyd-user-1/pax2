'use client'

// Enhancing the recorded take, in the chat column: overlays drawn by Remotion (captions, the hook
// on screen, the end card), a Runway Aleph clean-up of the footage itself, and a generated b-roll
// insert from Kling, Higgsfield or ElevenLabs — previewed live, rendered in the browser like the
// studio (studio-flow.tsx), and submitted through submitOriginal with the take as parent, so PAX2
// scores it as the next version and the evaluation carries the pairwise call against the original.

import * as React from 'react'
import { Player } from '@remotion/player'
import { Check, Loader2, Sparkles, X } from 'lucide-react'

import { uploadUrl } from '@/app/actions'
import { bankedForScript } from '@/app/footage-actions'
import { submitOriginal } from '@/app/original-actions'
import { cleanupStatus, generateHiggsfield, generationStatus, startCleanup, startGeneration } from '@/app/video-gen-actions'
import { EnhanceVideo } from '@/components/studio/enhance-video'
import { FPS } from '@/lib/studio-style'
import { fallbackChain, VIDEO_MODEL_OPTIONS, videoModelById, type VideoProvider } from '@/lib/video-model-options'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'

const CHIP = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13px] transition-colors ${on ? 'border-pax2-blue bg-pax2-blue text-white' : 'border-[var(--border)] text-[var(--txt)] hover:bg-muted'}`
const FIELD = 'rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[14px] text-[var(--txt)] outline-none transition-colors placeholder:text-[var(--muted2)] focus:border-pax2-light-blue'

type Job = { state: 'idle' | 'working' | 'done' | 'error'; url?: string; message?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function EnhanceFlow({ clipUrl, clipKey, seconds, script, parentId, email, defaultProvider, onScored }: { clipUrl: string; clipKey: string; seconds: number; script: string; parentId: string; email: string | null; defaultProvider: VideoProvider; onScored: (id: string) => void }) {
  const [captions, setCaptions] = React.useState(true)
  const [hook, setHook] = React.useState(true)
  const [endCard, setEndCard] = React.useState(true)
  const [ask, setAsk] = React.useState('Vote YES on 3')

  const [cleanup, setCleanup] = React.useState<Job>({ state: 'idle' })
  const [useCleaned, setUseCleaned] = React.useState(true)

  const numberLine = React.useMemo(() => script.split(/(?<=[.!?…])\s+/).find((s) => /\d/.test(s)) ?? script.split(/(?<=[.!?…])\s+/)[0] ?? '', [script])
  const [provider, setProvider] = React.useState<VideoProvider>(defaultProvider)
  const [brollPrompt, setBrollPrompt] = React.useState(`Documentary b-roll, no one speaking to camera: ${numberLine}`)
  const [atSec, setAtSec] = React.useState(Math.max(2, Math.round(seconds * 0.4)))
  const [broll, setBroll] = React.useState<Job>({ state: 'idle' })
  // Shots already made for this script under its Footage block, each one tap to use.
  const [madeFor, setMadeFor] = React.useState<{ id: string; url: string; line?: string }[]>([])
  React.useEffect(() => {
    bankedForScript(script).then(setMadeFor).catch(() => {})
  }, [script])

  const [render, setRender] = React.useState<'idle' | 'rendering' | 'sending' | 'done' | 'error'>('idle')
  const [progress, setProgress] = React.useState(0)
  const [err, setErr] = React.useState<string | null>(null)

  const timers = React.useRef<ReturnType<typeof setInterval>[]>([])
  const alive = React.useRef(true)
  React.useEffect(
    () => () => {
      alive.current = false
      timers.current.forEach(clearInterval)
    },
    [],
  )

  const poll = (every: () => Promise<{ status: string; url?: string; message?: string }>, set: (j: Job) => void) => {
    const t = setInterval(async () => {
      try {
        const s = await every()
        if (s.status === 'done') {
          clearInterval(t)
          set({ state: 'done', url: s.url })
        } else if (s.status === 'failed') {
          clearInterval(t)
          set({ state: 'error', message: s.message })
        }
      } catch (e) {
        clearInterval(t)
        set({ state: 'error', message: (e as Error).message })
      }
    }, 10_000)
    timers.current.push(t)
  }

  const runCleanup = async () => {
    setCleanup({ state: 'working' })
    try {
      const { task } = await startCleanup(clipKey, 'Clean up the footage: steady the camera, balance the lighting on the face, keep the person, the voice and every word exactly as recorded.')
      poll(() => cleanupStatus(task), setCleanup)
    } catch (e) {
      setCleanup({ state: 'error', message: (e as Error).message })
    }
  }

  // The chosen provider first, then every other one: a provider out of credits, out of quota, or
  // behind a dead model id throws or fails its task, and the next in line gets the same prompt.
  const runBroll = async () => {
    const tried: string[] = []
    for (const p of fallbackChain(provider)) {
      if (!alive.current) return
      const name = videoModelById(p).label
      setBroll({ state: 'working', message: tried.length ? `${name}, after ${tried.join(' and ')}` : name })
      try {
        let url: string | undefined
        if (p === 'higgsfield') {
          url = (await generateHiggsfield({ prompt: brollPrompt, seconds: 5, aspect: '9:16' })).url
        } else {
          const { task } = await startGeneration(p, { prompt: brollPrompt, seconds: 5, aspect: '9:16' })
          for (;;) {
            await sleep(10_000)
            if (!alive.current) return
            const s = await generationStatus(p, task)
            if (s.status === 'done') {
              url = s.url
              break
            }
            if (s.status === 'failed') throw new Error(s.message ?? 'failed')
          }
        }
        if (!alive.current) return
        setBroll({ state: 'done', url, message: name })
        return
      } catch {
        tried.push(name)
      }
    }
    if (alive.current) setBroll({ state: 'error', message: `Every provider failed: ${tried.join(', ')}.` })
  }

  const src = useCleaned && cleanup.state === 'done' && cleanup.url ? cleanup.url : clipUrl
  const props = {
    src,
    seconds,
    script,
    captions,
    hook,
    endCard,
    ask,
    broll: broll.state === 'done' && broll.url ? { url: broll.url, atSec, seconds: 5 } : null,
  }
  const frames = Math.max(FPS, Math.ceil(seconds * FPS))

  const renderAndScore = async () => {
    setErr(null)
    setProgress(0)
    setRender('rendering')
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
      const check = await canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width: 1080, height: 1920, muted: false, audioCodec: 'aac' })
      if (!check.canRender) throw new Error(`This browser can't render the video: ${check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`)
      const { getBlob } = await renderMediaOnWeb({
        composition: { component: EnhanceVideo, id: 'enhance-video', width: 1080, height: 1920, fps: FPS, durationInFrames: frames, defaultProps: props },
        inputProps: props,
        container: 'mp4',
        videoCodec: 'h264',
        muted: false,
        audioCodec: 'aac',
        onProgress: (p) => setProgress(p.progress),
        licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
      })
      const blob = await getBlob()
      setRender('sending')
      const u = await uploadUrl('video/mp4')
      const r = await fetch(u.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const record = JSON.stringify({ enhanced: true, captions, hook, endCard, ask, cleaned: useCleaned && cleanup.state === 'done', broll: broll.state === 'done' ? { made: broll.message ?? null, atSec } : null })
      await submitOriginal({ id: u.id, key: u.key, email: email ?? undefined, parent: parentId, text: script, seconds, consent: true, style: record, styleLabel: 'Enhanced' })
      setRender('done')
      onScored(u.id)
    } catch (e) {
      setErr((e as Error).message)
      setRender('error')
    }
  }

  if (render === 'done')
    return (
      <Card size="sm" className="my-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Enhanced version submitted</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-800">
          It is scored as the next version of your take, and the evaluation carries the call against the original.
        </CardContent>
      </Card>
    )

  const jobRow = (label: string, job: Job, run: () => void, extra?: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--txt)]">{label}</span>
        {job.state === 'idle' && (
          <button type="button" onClick={run} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-[12px] font-medium text-pax2-blue transition-colors hover:bg-muted">
            <Sparkles className="size-3.5" /> Generate
          </button>
        )}
        {job.state === 'working' && (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <Loader2 className="size-3.5 animate-spin" /> working{job.message ? ` — ${job.message}` : ''} · minutes; it keeps going while you chat
          </span>
        )}
        {job.state === 'done' && (
          <span className="flex items-center gap-1.5 text-[12px] text-pax2-blue">
            <Check className="size-3.5" /> ready{job.message ? ` — ${job.message}` : ''} — it is in the preview
          </span>
        )}
        {job.state === 'error' && (
          <span className="flex items-center gap-1.5 text-[12px] text-destructive">
            <X className="size-3.5" /> {job.message ?? 'failed'}
            <button type="button" onClick={run} className="font-medium text-pax2-blue hover:underline">Try again</button>
          </span>
        )}
      </div>
      {extra}
    </div>
  )

  return (
    <Card size="sm" className="my-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="border-b [.border-b]:pb-2">
        <CardTitle>Enhance it</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="overflow-hidden rounded-2xl bg-black">
          <Player component={EnhanceVideo} inputProps={props} durationInFrames={frames} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: '100%', aspectRatio: '9 / 16' }} controls loop />
        </div>
        <div className="flex min-w-0 flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCaptions(!captions)} className={CHIP(captions)}>Captions</button>
            <button type="button" onClick={() => setHook(!hook)} className={CHIP(hook)}>Hook on screen</button>
            <button type="button" onClick={() => setEndCard(!endCard)} className={CHIP(endCard)}>End card</button>
            {endCard && <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={28} className={`${FIELD} w-44`} aria-label="Call to action" />}
          </div>
          <p className="-mt-2 text-[12px] text-[var(--muted)]">Caption timing is the script paced over the clip's {seconds} seconds — an estimate; check it in the preview.</p>

          {jobRow(
            'Clean-up pass (Runway Aleph)',
            cleanup,
            runCleanup,
            cleanup.state === 'done' ? (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setUseCleaned(true)} className={CHIP(useCleaned)}>Use the cleaned take</button>
                <button type="button" onClick={() => setUseCleaned(false)} className={CHIP(!useCleaned)}>Original footage</button>
              </div>
            ) : undefined,
          )}

          {jobRow(
            'B-roll insert (5 s)',
            broll,
            runBroll,
            broll.state === 'idle' || broll.state === 'error' ? (
              <div className="flex flex-col gap-2">
                {madeFor.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {madeFor.map((m) => (
                      <button key={m.id} type="button" onClick={() => setBroll({ state: 'done', url: m.url, message: 'Made for this script' })} title={m.line ?? 'Opening shot'} className="aspect-[9/16] w-[54px] shrink-0 overflow-hidden rounded-md border border-[var(--border)] hover:ring-2 hover:ring-pax2-light-blue">
                        <video src={m.url} muted loop playsInline autoPlay className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {VIDEO_MODEL_OPTIONS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProvider(p.id)} className={CHIP(provider === p.id)}>{p.label}</button>
                  ))}
                </div>
                <textarea value={brollPrompt} onChange={(e) => setBrollPrompt(e.target.value)} rows={2} className={`${FIELD} w-full resize-none`} aria-label="B-roll prompt" />
                <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  Insert at second
                  <input type="number" min={0} max={Math.max(0, seconds - 5)} value={atSec} onChange={(e) => setAtSec(Number(e.target.value) || 0)} className={`${FIELD} w-20`} />
                </label>
              </div>
            ) : undefined,
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={render === 'rendering' || render === 'sending'}
              onClick={renderAndScore}
              className="flex items-center gap-2 rounded-full bg-pax2-blue px-6 py-2.5 font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {render === 'rendering' || render === 'sending' ? <Loader2 className="size-4 animate-spin" /> : null}
              {render === 'rendering' ? `Rendering ${Math.round(progress * 100)}%` : render === 'sending' ? 'Scoring' : 'Render and score it'}
            </button>
            {err && <p className="text-[12px] text-destructive">{err}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
