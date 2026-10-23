'use client'

// Under each finished script: its footage, as two cards (Brendan, 2026-10-23). Shots: the opening shot and
// the b-roll behind each line, generated one at a time on tap with the composer's video model (the others
// take over down the fallback list when one fails) and banked for everyone who picks the same script.
// Graphics: drawn by Remotion from the script's own words at no cost, dressed in a brand kit picked from
// the palette in the card's corner (a preset, a typeface, two colors, a logo); its footer downloads every
// graphic as one MP4 and saves the kit to the script. Each card sits in the chat's block frame, Add to Blocks
// in its bar. The plan behind both is written once per script and kept.

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Player } from '@remotion/player'
import { Check, Download, LayoutGrid, Loader2, Palette } from 'lucide-react'

import { bankedShots, footageBrand, footagePlan, saveFootageBrand, shotStatus, startShot, type BankedShot } from '@/app/footage-actions'
import { GraphicVideo, GraphicsReel } from '@/components/studio/graphic-video'
import { useShelf } from '@/lib/home-blocks'
import { BRAND_PRESETS, FONTS, GRAPHIC_KINDS, type Brand, type BrandFont, type FootageFocus, type FootagePlan, type GraphicKind } from '@/lib/footage'
import { FPS } from '@/lib/studio-style'
import { videoModelById, type VideoProvider } from '@/lib/video-model-options'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/ui/components/nova/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/components/nova/dropdown-menu'
import { Skeleton } from '@/ui/components/nova/skeleton'
import { cn } from '@/ui/lib/utils'

type Job = { state: 'working'; provider: VideoProvider; tried: VideoProvider[] } | { state: 'error'; message: string }

const usable = (kind: GraphicKind, plan: FootagePlan) => !!plan.graphics?.[kind] && (kind !== 'stat' || !!plan.graphics.stat.value)
const ITEM = 'flex items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm'
const FOOT_LINK = 'flex items-center gap-1.5 font-medium text-slate-800 underline underline-offset-2 hover:text-pax2-light-blue disabled:pointer-events-none disabled:opacity-50'

/** Renders a composition to MP4 in the browser and hands it over as a download. */
async function renderToFile(component: React.ComponentType<any>, props: Record<string, unknown>, frames: number, name: string, onProgress: (p: number) => void) {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
  const check = await canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width: 1080, height: 1920, muted: true })
  if (!check.canRender) throw new Error(`This browser can't render the video: ${check.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`)
  const { getBlob } = await renderMediaOnWeb({
    composition: { component, id: name, width: 1080, height: 1920, fps: FPS, durationInFrames: frames, defaultProps: props },
    inputProps: props,
    container: 'mp4',
    videoCodec: 'h264',
    muted: true,
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

/** A card on the chat page in the chat's block frame (chat-block.tsx): a bar with the grid mark, the card's
 *  address in mono and Add to Blocks, then the card. */
function ShelvedCard({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  const path = usePathname()
  const { add, remove, has } = useShelf()
  const [where, setWhere] = React.useState(path)
  React.useEffect(() => setWhere(`${window.location.pathname}${window.location.search}`), [])
  const key = `${where}#${id}`
  const on = has(key)
  return (
    <figure className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-[12px] text-slate-500">
        <LayoutGrid className="size-3.5 text-pax2-blue" />
        <span className="truncate font-mono">{`${path}#${title.toLowerCase()}`}</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => (on ? remove(key) : add({ key, title, path: where, anchor: id }))} className="rounded-md px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-white hover:text-pax2-blue">
            {on ? 'On the shelf' : 'Add to Blocks'}
          </button>
        </span>
      </div>
      <div className="p-3">
        <Card id={id} className={cn('scroll-mt-20', className)}>
          {children}
        </Card>
      </div>
    </figure>
  )
}

export function FootageBlock({ script, videoModel, focus }: { script: string; videoModel: VideoProvider; focus?: FootageFocus | null }) {
  const [plan, setPlan] = React.useState<FootagePlan | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [banked, setBanked] = React.useState<Record<string, BankedShot>>({})
  const [jobs, setJobs] = React.useState<Record<string, Job>>({})
  const [brand, setBrandState] = React.useState<Brand>(BRAND_PRESETS[0])
  const [saved, setSaved] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [rendering, setRendering] = React.useState<number | null>(null)
  const [renderError, setRenderError] = React.useState<string | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const logoInput = React.useRef<HTMLInputElement>(null)
  const primaryInput = React.useRef<HTMLInputElement>(null)
  const accentInput = React.useRef<HTMLInputElement>(null)
  const alive = React.useRef(true)
  React.useEffect(() => () => { alive.current = false }, [])
  const setBrand = (b: Brand) => {
    setBrandState(b)
    setSaved('idle')
  }

  React.useEffect(() => {
    let off = false
    footagePlan(script)
      .then(async (p) => {
        if (off) return
        setPlan(p)
        const [b, kit] = await Promise.all([bankedShots(p.key), footageBrand(p.key).catch(() => null)])
        if (off) return
        setBanked(b)
        if (kit) {
          setBrandState(kit)
          setSaved('saved')
        }
      })
      .catch((e) => !off && setFailed((e as Error).message))
    return () => { off = true }
  }, [script])

  React.useEffect(() => {
    if (focus && plan) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus, plan])

  const run = async (shotId: string, first: VideoProvider, tried: VideoProvider[] = []) => {
    if (!plan) return
    setJobs((j) => ({ ...j, [shotId]: { state: 'working', provider: first, tried } }))
    try {
      const s = await startShot(plan.key, shotId, first, tried)
      if (s.url) {
        if (alive.current) setBanked((b) => ({ ...b, [shotId]: { url: s.url!, provider: s.provider, at: new Date().toISOString() } }))
        return
      }
      setJobs((j) => ({ ...j, [shotId]: { state: 'working', provider: s.provider, tried } }))
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

  if (failed) return null
  if (!plan)
    return (
      <Card className="my-4">
        <CardContent className="flex flex-col gap-3 py-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )

  const kinds = GRAPHIC_KINDS.filter((k) => usable(k.id, plan))
  const download = async () => {
    setRenderError(null)
    setRendering(0)
    try {
      await renderToFile(GraphicsReel, { kinds: kinds.map((k) => ({ id: k.id, seconds: k.seconds })), graphics: plan.graphics, brand }, kinds.reduce((t, k) => t + k.seconds * FPS, 0), 'graphics', (p) => setRendering(p))
    } catch (e) {
      setRenderError((e as Error).message)
    } finally {
      setRendering(null)
    }
  }
  const save = async () => {
    setSaved('saving')
    try {
      await saveFootageBrand(plan.key, brand)
      setSaved('saved')
    } catch {
      setSaved('error')
    }
  }
  const pickColor = (which: 'primary' | 'accent') => (e: React.ChangeEvent<HTMLInputElement>) => setBrand({ ...brand, name: 'Custom', [which]: e.target.value })

  return (
    <div ref={ref}>
      <ShelvedCard id={`shots-${plan.key}`} title="Shots">
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Shots</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {plan.shots.map((s) => {
              const b = banked[s.id]
              const job = jobs[s.id]
              return (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="aspect-[9/16] w-[54px] shrink-0 overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
                    {b && <video src={b.url} muted loop playsInline autoPlay className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1" title={s.prompt}>
                    <p className="text-sm text-[var(--txt)]">{s.kind === 'opening' ? 'Opening shot' : s.line}</p>
                    <p className="text-xs text-[var(--muted)] tabular">{s.seconds} s{b ? ` · ${videoModelById(b.provider).label}` : ''}</p>
                  </div>
                  {!b &&
                    (job?.state === 'working' ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--muted)]">
                        <Loader2 className="size-3.5 animate-spin" />
                        {videoModelById(job.provider).label}
                      </span>
                    ) : (
                      <button type="button" onClick={() => run(s.id, videoModel)} title={job?.state === 'error' ? job.message : undefined} className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold hover:bg-pax2-lavender/60', job?.state === 'error' ? 'text-pax2-red' : 'text-pax2-blue')}>
                        {job?.state === 'error' ? 'Retry' : 'Generate'}
                      </button>
                    ))}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </ShelvedCard>

      <ShelvedCard id={`graphics-${plan.key}`} title="Graphics">
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Graphics</CardTitle>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Brand kit" title="Brand kit" className="flex size-8 items-center justify-center rounded-md text-slate-800 outline-none hover:bg-muted data-[popup-open]:bg-muted">
                <Palette className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-max min-w-56 rounded-2xl p-1.5 shadow-e3">
                <div className="px-3 py-1.5 text-xs text-slate-500">Brand</div>
                {BRAND_PRESETS.map((b) => (
                  <DropdownMenuItem key={b.name} onClick={() => setBrand(b)} className={ITEM}>
                    <span className="flex items-center gap-2.5">
                      <span className="flex">
                        <span className="size-3 rounded-full" style={{ background: b.primary }} />
                        <span className="-ml-1 size-3 rounded-full ring-2 ring-white" style={{ background: b.accent }} />
                      </span>
                      {b.name}
                    </span>
                    {brand.name === b.name && <Check className="size-4 text-pax2-light-blue" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-3 py-1.5 text-xs text-slate-500">Typeface</div>
                {(Object.keys(FONTS) as BrandFont[]).map((f) => (
                  <DropdownMenuItem key={f} onClick={() => setBrand({ ...brand, font: f })} className={ITEM}>
                    <span style={{ fontFamily: FONTS[f].stack }}>{FONTS[f].label}</span>
                    {brand.font === f && <Check className="size-4 text-pax2-light-blue" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => primaryInput.current?.click()} className={ITEM}>
                  Primary color
                  <span className="size-4 rounded-full border" style={{ background: brand.primary }} />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => accentInput.current?.click()} className={ITEM}>
                  Accent color
                  <span className="size-4 rounded-full border" style={{ background: brand.accent }} />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoInput.current?.click()} className={ITEM}>
                  {brand.logo ? 'Replace logo' : 'Upload logo'}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {brand.logo && <img src={brand.logo} alt="" className="size-5 rounded object-cover" />}
                </DropdownMenuItem>
                {brand.logo && (
                  <DropdownMenuItem onClick={() => setBrand({ ...brand, name: 'Custom', logo: null })} className={ITEM}>
                    Remove logo
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={primaryInput} type="color" value={brand.primary} onChange={pickColor('primary')} className="sr-only" tabIndex={-1} aria-hidden />
            <input ref={accentInput} type="color" value={brand.accent} onChange={pickColor('accent')} className="sr-only" tabIndex={-1} aria-hidden />
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const r = new FileReader()
                r.onload = () => setBrand({ ...brand, name: 'Custom', logo: String(r.result) })
                r.readAsDataURL(f)
              }}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {kinds.map((k) => (
              <figure key={k.id} className="flex w-[150px] shrink-0 flex-col gap-1.5" title={k.about}>
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <Player component={GraphicVideo} inputProps={{ kind: k.id, graphics: plan.graphics, brand }} durationInFrames={k.seconds * FPS} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: '100%', aspectRatio: '9 / 16' }} loop autoPlay />
                </div>
                <figcaption className="text-xs text-[var(--muted)]">{k.label}</figcaption>
              </figure>
            ))}
          </div>
          {renderError && <p className="pt-2 text-xs text-pax2-red">{renderError}</p>}
        </CardContent>
        <CardFooter className="justify-between gap-3 bg-transparent py-3 text-xs text-slate-800">
          <button type="button" onClick={download} disabled={rendering != null || !kinds.length} className={FOOT_LINK}>
            {rendering != null ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {rendering != null ? `Rendering ${Math.round(rendering * 100)}%` : 'Download'}
          </button>
          <button type="button" onClick={save} disabled={saved === 'saving' || saved === 'saved'} className={FOOT_LINK}>
            {saved === 'saving' && <Loader2 className="size-3.5 animate-spin" />}
            {saved === 'saved' && <Check className="size-3.5" />}
            {saved === 'saved' ? 'Saved to Script' : saved === 'error' ? 'Save failed. Try again' : 'Save to Script'}
          </button>
        </CardFooter>
      </ShelvedCard>
    </div>
  )
}
