'use client'

// Under each finished script: its footage. Shots are the opening shot and the b-roll behind each line,
// generated one at a time on tap with the composer's video model (the others take over down the
// fallback list when one fails) and banked for everyone who picks the same script. Graphics are drawn
// by Remotion from the script's own words and cost nothing. The plan behind both is written once per
// script and kept.

import * as React from 'react'
import { Player } from '@remotion/player'
import { Loader2 } from 'lucide-react'

import { bankedShots, footagePlan, shotStatus, startShot, type BankedShot } from '@/app/footage-actions'
import { GraphicVideo } from '@/components/studio/graphic-video'
import { GRAPHIC_KINDS, type FootageFocus, type FootagePlan, type GraphicKind } from '@/lib/footage'
import { FPS } from '@/lib/studio-style'
import { videoModelById, type VideoProvider } from '@/lib/video-model-options'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'
import { Skeleton } from '@/ui/components/nova/skeleton'
import { cn } from '@/ui/lib/utils'

type Job = { state: 'working'; provider: VideoProvider; tried: VideoProvider[] } | { state: 'error'; message: string }

const usable = (kind: GraphicKind, plan: FootagePlan) => !!plan.graphics?.[kind] && (kind !== 'stat' || !!plan.graphics.stat.value)

export function FootageBlock({ script, videoModel, focus }: { script: string; videoModel: VideoProvider; focus?: FootageFocus | null }) {
  const [plan, setPlan] = React.useState<FootagePlan | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [banked, setBanked] = React.useState<Record<string, BankedShot>>({})
  const [jobs, setJobs] = React.useState<Record<string, Job>>({})
  const ref = React.useRef<HTMLDivElement>(null)
  const alive = React.useRef(true)
  React.useEffect(() => () => { alive.current = false }, [])

  React.useEffect(() => {
    let off = false
    footagePlan(script)
      .then(async (p) => {
        if (off) return
        setPlan(p)
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

  return (
    <Card ref={ref} className="my-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="border-b [.border-b]:pb-2">
        <CardTitle>Footage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 py-4">
        {!plan ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <section className={cn('flex flex-col gap-2 rounded-xl', focus === 'shots' && 'ring-2 ring-pax2-light-blue ring-offset-4')}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shots</h3>
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
                      {!b && (
                        job?.state === 'working' ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--muted)]">
                            <Loader2 className="size-3.5 animate-spin" />
                            {videoModelById(job.provider).label}
                          </span>
                        ) : (
                          <button type="button" onClick={() => run(s.id, videoModel)} title={job?.state === 'error' ? job.message : undefined} className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold hover:bg-pax2-lavender/60', job?.state === 'error' ? 'text-pax2-red' : 'text-pax2-blue')}>
                            {job?.state === 'error' ? 'Retry' : 'Generate'}
                          </button>
                        )
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graphics</h3>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {GRAPHIC_KINDS.filter((k) => usable(k.id, plan)).map((k) => (
                  <figure key={k.id} className="flex w-[150px] shrink-0 flex-col gap-1.5" title={k.about}>
                    <div className={cn('overflow-hidden rounded-lg border border-[var(--border)]', focus === k.id && 'ring-2 ring-pax2-light-blue ring-offset-2')}>
                      <Player component={GraphicVideo} inputProps={{ kind: k.id, graphics: plan.graphics }} durationInFrames={k.seconds * FPS} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: '100%', aspectRatio: '9 / 16' }} loop autoPlay />
                    </div>
                    <figcaption className="text-xs text-[var(--muted)]">{k.label}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
