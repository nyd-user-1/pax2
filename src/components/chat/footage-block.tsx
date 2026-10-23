'use client'

// Under each finished script: its footage, as a storyboard. The preview plays the whole short; each
// line of the script carries its shot (generated on tap with the composer's video model, the others
// taking over down the fallback list when one fails, banked for everyone who picks the same script) and
// at most one graphic over it. Captions and the lower third run across the whole video; the narration
// is the studio's voice, made once per script and voice. Graphics are drawn by Remotion in the brand kit
// and cost nothing; each one downloads as an MP4, and so does the whole short. Signed-in edits to a
// shot's prompt or a graphic's words save to the shared plan.

import * as React from 'react'
import { Player } from '@remotion/player'
import { Download, Loader2, Palette } from 'lucide-react'

import { bankedShots, footagePlan, shotStatus, startShot, updatePlan, type BankedShot } from '@/app/footage-actions'
import { narrate, type Narration } from '@/app/studio-actions'
import { GraphicVideo, type TimedWord } from '@/components/studio/graphic-video'
import { StoryboardVideo, storyTiming } from '@/components/studio/storyboard-video'
import { BRAND_PRESETS, FONTS, GRAPHIC_KINDS, defaultRows, sentencesOf, type Brand, type BrandFont, type FootageFocus, type FootagePlan, type GraphicKind, type Graphics, type Row } from '@/lib/footage'
import { FPS, VOICES, type VoiceId } from '@/lib/studio-style'
import { videoModelById, type VideoProvider } from '@/lib/video-model-options'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'
import { Skeleton } from '@/ui/components/nova/skeleton'
import { cn } from '@/ui/lib/utils'

type Job = { state: 'working'; provider: VideoProvider } | { state: 'error'; message: string }

const BRAND_KEY = 'pax2-brand'
const ON_SHOT: GraphicKind[] = ['checklist', 'callout', 'stat', 'quote', 'intro', 'end']
const FIELD = 'w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] text-[var(--txt)] outline-none focus:border-pax2-light-blue'
const LINK = 'text-xs font-semibold text-pax2-blue hover:underline disabled:opacity-40'

/** The fields each graphic's words edit in. */
const FIELDS: Partial<Record<keyof Graphics, { key: string; label: string }[]>> = {
  checklist: [{ key: 'title', label: 'Title' }, { key: 'items.0', label: 'Row 1' }, { key: 'items.1', label: 'Row 2' }, { key: 'items.2', label: 'Row 3' }, { key: 'footer', label: 'Footer' }],
  lowerThird: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }],
  callout: [{ key: 'text', label: 'Phrase' }, { key: 'highlight', label: 'Word in color' }],
  stat: [{ key: 'value', label: 'Number' }, { key: 'label', label: 'What it counts' }],
  quote: [{ key: 'text', label: 'Quote' }, { key: 'by', label: 'By' }],
  intro: [{ key: 'title', label: 'Title' }, { key: 'sub', label: 'Subtitle' }],
  end: [{ key: 'ask', label: 'Ask' }, { key: 'handle', label: 'Handle' }],
}

const read = (o: Record<string, unknown>, path: string) => {
  const [k, i] = path.split('.')
  const v = o[k]
  return i != null ? ((v as string[] | undefined)?.[Number(i)] ?? '') : ((v as string | undefined) ?? '')
}
const write = (o: Record<string, unknown>, path: string, value: string) => {
  const [k, i] = path.split('.')
  if (i == null) return { ...o, [k]: value }
  const arr = [...((o[k] as string[] | undefined) ?? [])]
  arr[Number(i)] = value
  return { ...o, [k]: arr }
}

function useBrand(): [Brand, (b: Brand) => void] {
  const [brand, setBrand] = React.useState<Brand>(BRAND_PRESETS[0])
  React.useEffect(() => {
    try {
      const kept = localStorage.getItem(BRAND_KEY)
      if (kept) setBrand({ ...BRAND_PRESETS[0], ...(JSON.parse(kept) as Brand) })
    } catch {}
  }, [])
  const choose = React.useCallback((b: Brand) => {
    setBrand(b)
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(b))
    } catch {}
  }, [])
  return [brand, choose]
}

/** The script's words paced evenly over `seconds`, for captions before a voice exists. */
function paced(script: string, seconds: number): TimedWord[] {
  const words = script.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const span = Math.max(1, seconds - 1)
  return words.map((w, i) => ({ w, t: 0.3 + (i / Math.max(1, words.length)) * span }))
}

async function renderToFile(component: React.ComponentType<any>, props: Record<string, unknown>, frames: number, name: string, withAudio: boolean, onProgress: (p: number) => void) {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
  const opts = withAudio ? { muted: false, audioCodec: 'aac' as const } : { muted: true }
  const check = await canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width: 1080, height: 1920, ...opts })
  if (!check.canRender) throw new Error(`This browser can't render the video: ${check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`)
  const { getBlob } = await renderMediaOnWeb({
    composition: { component, id: name, width: 1080, height: 1920, fps: FPS, durationInFrames: frames, defaultProps: props },
    inputProps: props,
    container: 'mp4',
    videoCodec: 'h264',
    ...opts,
    onProgress: (p) => onProgress(p.progress),
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
  })
  const blob = await getBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.mp4`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

export function FootageBlock({ script, videoModel, focus }: { script: string; videoModel: VideoProvider; focus?: FootageFocus | null }) {
  const [plan, setPlan] = React.useState<FootagePlan | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [banked, setBanked] = React.useState<Record<string, BankedShot>>({})
  const [jobs, setJobs] = React.useState<Record<string, Job>>({})
  const [rows, setRows] = React.useState<Row[]>([])
  const [captions, setCaptions] = React.useState(true)
  const [lowerThird, setLowerThird] = React.useState(false)
  const [brand, setBrand] = useBrand()
  const [brandOpen, setBrandOpen] = React.useState(false)
  const [voiceId, setVoiceId] = React.useState<VoiceId>(VOICES.find((v) => v.provider === 'Polly')?.id ?? 'Matthew')
  const [voice, setVoice] = React.useState<Narration | null>(null)
  const [voicing, setVoicing] = React.useState(false)
  const [prompting, setPrompting] = React.useState<{ id: string; text: string } | null>(null)
  const [editing, setEditing] = React.useState<keyof Graphics | null>(null)
  const [draft, setDraft] = React.useState<Record<string, unknown>>({})
  const [rendering, setRendering] = React.useState<{ name: string; p: number } | null>(null)
  const [note, setNote] = React.useState<string | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const alive = React.useRef(true)
  React.useEffect(() => () => { alive.current = false }, [])

  React.useEffect(() => {
    let off = false
    footagePlan(script)
      .then(async (p) => {
        if (off) return
        setPlan(p)
        setRows(defaultRows(p, script))
        setLowerThird(!!p.graphics.lowerThird?.name)
        const b = await bankedShots(p.key)
        if (!off) setBanked(b)
      })
      .catch((e) => !off && setFailed((e as Error).message))
    return () => { off = true }
  }, [script])

  React.useEffect(() => {
    if (focus && plan) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus, plan])

  const run = async (shotId: string, first: VideoProvider, tried: VideoProvider[] = []) => {
    if (!plan) return
    setJobs((j) => ({ ...j, [shotId]: { state: 'working', provider: first } }))
    try {
      const s = await startShot(plan.key, shotId, first, tried)
      if (s.url) {
        if (alive.current) setBanked((b) => ({ ...b, [shotId]: { url: s.url!, provider: s.provider, at: new Date().toISOString() } }))
        return
      }
      setJobs((j) => ({ ...j, [shotId]: { state: 'working', provider: s.provider } }))
      for (;;) {
        await new Promise((r) => setTimeout(r, 5000))
        if (!alive.current) return
        const st = await shotStatus(plan.key, shotId, s.provider as Exclude<VideoProvider, 'higgsfield'>, s.task!)
        if (st.status === 'done' && st.url) {
          setBanked((b) => ({ ...b, [shotId]: { url: st.url!, provider: s.provider, at: new Date().toISOString() } }))
          return
        }
        if (st.status === 'failed') return run(shotId, first, [...tried, s.provider])
      }
    } catch (e) {
      if (alive.current) setJobs((j) => ({ ...j, [shotId]: { state: 'error', message: (e as Error).message } }))
    }
  }

  const save = async (edit: Parameters<typeof updatePlan>[1]) => {
    if (!plan) return
    setNote(null)
    try {
      setPlan(await updatePlan(plan.key, edit))
    } catch (e) {
      setNote(`${(e as Error).message} The change shows here only.`)
    }
  }

  const voiceIt = async () => {
    setVoicing(true)
    setNote(null)
    try {
      setVoice(await narrate(script, voiceId))
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setVoicing(false)
    }
  }

  const download = async (name: string, component: React.ComponentType<any>, props: Record<string, unknown>, frames: number, withAudio: boolean) => {
    setNote(null)
    setRendering({ name, p: 0 })
    try {
      await renderToFile(component, props, frames, name, withAudio, (p) => alive.current && setRendering({ name, p }))
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      if (alive.current) setRendering(null)
    }
  }

  if (failed) return null

  const shotOf = (id: string) => plan?.shots.find((s) => s.id === id)
  const story = rows.map((r) => ({ seconds: r.seconds, clip: banked[r.shotId]?.url ?? null, graphic: r.graphic }))
  const timing = storyTiming(story, FPS, voice?.seconds ?? 0)
  const words: TimedWord[] = voice ? voice.marks : paced(script, timing.total / FPS)
  const storyProps = plan ? { rows: story, graphics: plan.graphics, brand, captions, lowerThird, words, voiceUrl: voice?.url ?? null, voiceSeconds: voice?.seconds ?? 0 } : null
  const sample = paced(sentencesOf(script).slice(0, 2).join(' '), 5)
  const usable = (k: GraphicKind) => !!plan && (k === 'captions' || (!!plan.graphics[k as keyof Graphics] && (k !== 'stat' || !!plan.graphics.stat?.value)))

  return (
    <Card ref={ref} className="my-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="border-b [.border-b]:pb-2">
        <CardTitle>Footage</CardTitle>
        <CardAction>
          <button type="button" onClick={() => setBrandOpen((o) => !o)} aria-expanded={brandOpen} className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors', brandOpen ? 'bg-pax2-lavender text-pax2-blue' : 'text-slate-600 hover:bg-pax2-lavender/60')}>
            <Palette className="size-3.5" />
            {brand.name}
          </button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 py-4">
        {brandOpen && (
          <div className="flex flex-wrap items-end gap-4 rounded-xl bg-pax2-mist p-3">
            <div className="flex gap-1.5">
              {BRAND_PRESETS.map((b) => (
                <button key={b.name} type="button" onClick={() => setBrand(b)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', brand.name === b.name ? 'border-pax2-blue bg-pax2-blue text-white' : 'border-[var(--border)] bg-white text-slate-700')}>{b.name}</button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
              Logo
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => setBrand({ ...brand, name: 'Custom', logo: String(r.result) })
                  r.readAsDataURL(f)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
              Primary
              <input type="color" value={brand.primary} onChange={(e) => setBrand({ ...brand, name: 'Custom', primary: e.target.value })} className="h-7 w-12 cursor-pointer rounded" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
              Accent
              <input type="color" value={brand.accent} onChange={(e) => setBrand({ ...brand, name: 'Custom', accent: e.target.value })} className="h-7 w-12 cursor-pointer rounded" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
              Typeface
              <select value={brand.font} onChange={(e) => setBrand({ ...brand, name: 'Custom', font: e.target.value as BrandFont })} className={FIELD + ' w-auto'}>
                {(Object.keys(FONTS) as BrandFont[]).map((f) => <option key={f} value={f}>{FONTS[f].label}</option>)}
              </select>
            </label>
            {brand.logo && <button type="button" onClick={() => setBrand({ ...brand, name: 'Custom', logo: null })} className={LINK}>Remove logo</button>}
          </div>
        )}

        {!plan || !storyProps ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="flex flex-col gap-3 md:sticky md:top-4 md:self-start">
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <Player component={StoryboardVideo} inputProps={storyProps} durationInFrames={timing.total} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: '100%', aspectRatio: '9 / 16' }} controls loop />
                </div>
                <div className="flex items-center gap-2">
                  <select value={voiceId} onChange={(e) => { setVoiceId(e.target.value as VoiceId); setVoice(null) }} className={FIELD} aria-label="Voice">
                    {VOICES.filter((v) => v.provider !== 'none').map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  <button type="button" onClick={voiceIt} disabled={voicing || !!voice} className={cn(LINK, 'shrink-0')}>
                    {voicing ? <Loader2 className="size-3.5 animate-spin" /> : voice ? 'Voiced' : 'Voice it'}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[var(--txt)]">
                  <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} /> Captions
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--txt)]">
                  <input type="checkbox" checked={lowerThird} onChange={(e) => setLowerThird(e.target.checked)} /> Lower third
                </label>
                {lowerThird && (
                  <div className="flex flex-col gap-1.5">
                    {(['name', 'role'] as const).map((k) => (
                      <input
                        key={k}
                        value={plan.graphics.lowerThird?.[k] ?? ''}
                        placeholder={k === 'name' ? 'Name' : 'Role'}
                        onChange={(e) => setPlan({ ...plan, graphics: { ...plan.graphics, lowerThird: { ...(plan.graphics.lowerThird ?? { name: '', role: '' }), [k]: e.target.value } } })}
                        onBlur={() => save({ kind: 'lowerThird', fields: plan.graphics.lowerThird })}
                        className={FIELD}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!!rendering}
                  onClick={() => download('short', StoryboardVideo, storyProps, timing.total, !!voice)}
                  className="flex items-center justify-center gap-2 rounded-full bg-pax2-blue px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                >
                  {rendering?.name === 'short' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {rendering?.name === 'short' ? `Rendering ${Math.round(rendering.p * 100)}%` : 'Download the video'}
                </button>
              </div>

              <ol className={cn('flex flex-col divide-y divide-[var(--border)] rounded-xl', focus === 'shots' && 'ring-2 ring-pax2-light-blue ring-offset-4')}>
                {rows.map((r, i) => {
                  const s = shotOf(r.shotId)
                  const b = banked[r.shotId]
                  const job = jobs[r.shotId]
                  return (
                    <li key={r.shotId} className="flex flex-col gap-2 py-2.5">
                      <div className="flex items-start gap-3">
                        <div className="aspect-[9/16] w-9 shrink-0 overflow-hidden rounded border border-dashed border-slate-300 bg-slate-50">
                          {b && <video src={b.url} muted loop playsInline autoPlay className="size-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--txt)]">{r.line}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                            <span className="tabular">{r.seconds} s{b ? ` · ${videoModelById(b.provider).label}` : ''}</span>
                            {!b && (job?.state === 'working' ? (
                              <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" />{videoModelById(job.provider).label}</span>
                            ) : (
                              <button type="button" onClick={() => run(r.shotId, videoModel)} title={job?.state === 'error' ? job.message : undefined} className={cn(LINK, job?.state === 'error' && 'text-pax2-red')}>
                                {job?.state === 'error' ? 'Retry the shot' : 'Generate the shot'}
                              </button>
                            ))}
                            {!b && s && job?.state !== 'working' && (
                              <button type="button" onClick={() => setPrompting(prompting?.id === s.id ? null : { id: s.id, text: s.prompt })} className={LINK}>
                                {prompting?.id === s.id ? 'Close the prompt' : 'Edit the prompt'}
                              </button>
                            )}
                          </div>
                        </div>
                        <select
                          value={r.graphic ?? ''}
                          onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, graphic: (e.target.value || null) as GraphicKind | null } : x)))}
                          className={FIELD + ' w-auto shrink-0'}
                          aria-label="Graphic over this line"
                        >
                          <option value="">No graphic</option>
                          {ON_SHOT.filter(usable).map((k) => <option key={k} value={k}>{GRAPHIC_KINDS.find((g) => g.id === k)?.label}</option>)}
                        </select>
                      </div>
                      {prompting?.id === r.shotId && (
                        <div className="ml-12 flex flex-col gap-1.5">
                          <textarea value={prompting.text} onChange={(e) => setPrompting({ id: r.shotId, text: e.target.value })} rows={3} className={FIELD + ' resize-none'} aria-label="Shot prompt" />
                          <button
                            type="button"
                            onClick={async () => {
                              setPlan({ ...plan, shots: plan.shots.map((x) => (x.id === r.shotId ? { ...x, prompt: prompting.text } : x)) })
                              await save({ shotId: r.shotId, prompt: prompting.text })
                              setPrompting(null)
                            }}
                            className={cn(LINK, 'self-start')}
                          >
                            Save the prompt
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {GRAPHIC_KINDS.filter((k) => usable(k.id)).map((k) => (
                <figure key={k.id} className="flex w-[140px] shrink-0 flex-col gap-1.5" title={k.about}>
                  <div className={cn('overflow-hidden rounded-lg border border-[var(--border)]', (focus === k.id || editing === k.id) && 'ring-2 ring-pax2-light-blue ring-offset-2')}>
                    <Player component={GraphicVideo} inputProps={{ kind: k.id, graphics: plan.graphics, brand, words: sample }} durationInFrames={k.seconds * FPS} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: '100%', aspectRatio: '9 / 16' }} loop autoPlay />
                  </div>
                  <figcaption className="flex flex-col gap-0.5">
                    <span className="text-xs text-[var(--muted)]">{k.label}</span>
                    <span className="flex gap-3">
                      {k.id !== 'captions' && (
                        <button type="button" onClick={() => { const kk = k.id as keyof Graphics; setEditing(editing === kk ? null : kk); setDraft({ ...(plan.graphics[kk] as Record<string, unknown>) }) }} className={LINK}>
                          {editing === k.id ? 'Close' : 'Edit'}
                        </button>
                      )}
                      <button type="button" disabled={!!rendering} onClick={() => download(k.id, GraphicVideo, { kind: k.id, graphics: plan.graphics, brand, words: sample }, k.seconds * FPS, false)} className={LINK}>
                        {rendering?.name === k.id ? `${Math.round(rendering.p * 100)}%` : 'Download'}
                      </button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            {editing && FIELDS[editing] && (
              <div className="grid gap-2 rounded-xl bg-pax2-mist p-3 sm:grid-cols-2">
                {FIELDS[editing]!.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {f.label}
                    <input value={read(draft, f.key)} onChange={(e) => setDraft(write(draft, f.key, e.target.value))} className={FIELD} />
                  </label>
                ))}
                <div className="flex items-end gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const fields = draft as unknown as Graphics[keyof Graphics]
                      setPlan({ ...plan, graphics: { ...plan.graphics, [editing]: fields } })
                      await save({ kind: editing, fields })
                      setEditing(null)
                    }}
                    className={LINK}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {note && <p className="text-xs text-pax2-red">{note}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
