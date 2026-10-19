"use client"

import * as React from "react"
import { Activity, Brain, ChevronRight, Gauge, ListChecks } from "lucide-react"

import { MainBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"

// The closed loop, run on screen with one real short: scored from what it carried at publish,
// the measured changes it could have made, its real curve under the poller with the model's live
// calls, and the files the tracked outcomes refit — the same files the first stage reads. Every
// number on this page comes from the serving model files and the poller's rows, nothing typed in.

export type LoopData = {
  short: { id: string; title: string; channel: string; publishedAt: string; durationSec: number; median: number }
  predict: {
    p: number
    expectedViews: number | null
    contributions: { label: string; pull: number }[]
    model: { version: string; auc: number; n: number; builtAt: string }
  }
  recommend: {
    changes: { action: string; points: number; low: number; high: number; scope: string }[]
    keeps: { label: string; points: number }[]
    measured: { videos: number; channels: number; builtAt: string }
  }
  track: { series: [number, number][]; calls: { hour: number; p: number }[]; views72: number; ratio: number; hit: boolean; readings: number }
  learn: {
    trainingRows: number
    outliers: number
    setBuiltAt: string
    velocityCurves: number
    velocityAuc6: number | null
    velocityBuiltAt: string
    liftVideos: number
    liftBuiltAt: string
  }
}

const STAGES = [
  { key: "score", label: "Score", icon: Gauge },
  { key: "recommend", label: "Recommend", icon: ListChecks },
  { key: "track", label: "Track", icon: Activity },
  { key: "learn", label: "Learn", icon: Brain },
] as const

const STAGE_MS = 9000
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n))
const pct = (p: number) => `${(p * 100).toFixed(0)}%`

/** Views at an hour, linear on the series anchored at (0, 0), flat past the last reading. */
function viewsAt(series: [number, number][], t: number): number {
  let ph = 0
  let pv = 0
  for (const [h, v] of series) {
    if (t <= h) return h === ph ? v : pv + ((v - pv) * (t - ph)) / (h - ph)
    ph = h
    pv = v
  }
  return pv
}

function Rail({ at, progress, onPick }: { at: number; progress: number; onPick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />}
          <button type="button" onClick={() => onPick(i)} className={cn("relative flex items-center gap-2 overflow-hidden rounded-md px-3 py-1.5 text-sm transition-colors", i === at ? "bg-pax2-lavender text-pax2-blue" : "text-slate-800 hover:bg-muted")}>
            <s.icon className="size-4" aria-hidden />
            {s.label}
            {i === at && <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-pax2-light-blue" style={{ transform: `scaleX(${progress})` }} />}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

function Pull({ label, pull, max }: { label: string; pull: number; max: number }) {
  const up = pull > 0
  return (
    <div className="flex items-center gap-2 text-sm" data-find={label}>
      <span className="w-1/2 truncate text-slate-800">{label}</span>
      <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={cn("h-full rounded-full", up ? "bg-pax2-above" : "bg-pax2-below")} style={{ width: `${Math.max(6, (Math.abs(pull) / max) * 100)}%` }} />
      </span>
      <span className={cn("w-12 text-right tabular-nums", up ? "text-pax2-above" : "text-pax2-below")}>
        {up ? "+" : ""}
        {pull.toFixed(2)}
      </span>
    </div>
  )
}

function Curve({ track, median, clock }: { track: LoopData["track"]; median: number; clock: number }) {
  const W = 640
  const H = 230
  const PAD = 10
  const top = Math.max(track.views72, median * 3.4, 1)
  const x = (h: number) => PAD + (h / 72) * (W - 2 * PAD)
  const y = (v: number) => H - 18 - (v / top) * (H - 42)
  const shown = track.series.filter(([h]) => h <= clock)
  if (shown.length && clock < 72) shown.push([clock, viewsAt(track.series, clock)])
  const pts = shown.map(([h, v]) => `${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const done = clock >= 72
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={PAD} x2={W - PAD} y1={y(median)} y2={y(median)} stroke="var(--pax2-blue)" strokeDasharray="3 4" strokeOpacity="0.45" />
      <text x={W - PAD} y={y(median) - 4} textAnchor="end" className="fill-slate-500 text-[10px]">
        channel median {fmt(median)}
      </text>
      <line x1={PAD} x2={W - PAD} y1={y(median * 3)} y2={y(median * 3)} stroke="var(--pax2-above)" strokeDasharray="3 4" strokeOpacity="0.6" />
      <text x={W - PAD} y={y(median * 3) - 4} textAnchor="end" className="fill-pax2-above text-[10px]">
        Hit at 3x, {fmt(median * 3)}
      </text>
      <line x1={PAD} x2={W - PAD} y1={H - 18} y2={H - 18} stroke="#e2e8f0" />
      {[0, 24, 48, 72].map((h) => (
        <text key={h} x={x(h)} y={H - 5} textAnchor="middle" className="fill-slate-400 text-[10px]">
          {h}h
        </text>
      ))}
      {pts && <polyline points={pts} fill="none" stroke="var(--pax2-light-blue)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />}
      {track.calls
        .filter((c) => c.hour <= clock)
        .map((c) => (
          <g key={c.hour}>
            <circle cx={x(c.hour)} cy={y(viewsAt(track.series, c.hour))} r="3.5" fill="var(--pax2-blue)" />
            <text x={x(c.hour)} y={y(viewsAt(track.series, c.hour)) - 8} textAnchor="middle" className="fill-pax2-blue text-[11px] font-medium">
              p {pct(c.p)} at {c.hour}h
            </text>
          </g>
        ))}
      {done && (
        <text x={x(72) - 4} y={y(track.views72) - 8} textAnchor="end" className={cn("text-[12px] font-semibold", track.hit ? "fill-pax2-above" : "fill-slate-700")}>
          {fmt(track.views72)} views, {track.ratio.toFixed(1)}x {track.hit ? "· Hit" : "· no Hit"}
        </text>
      )}
    </svg>
  )
}

function LearnRow({ name, count, unit, date }: { name: string; count: number; unit: string; date: string }) {
  return (
    <div className="flex items-baseline justify-between border-b py-3 text-sm last:border-b-0" data-find={name}>
      <span className="text-slate-800">{name}</span>
      <span className="flex items-baseline gap-3">
        <span className="font-semibold tabular-nums">
          {fmt(count)} {unit}
        </span>
        <span className="text-xs text-slate-500">{date}</span>
      </span>
    </div>
  )
}

export function LoopDemo({ data }: { data: LoopData | null }) {
  const [at, setAt] = React.useState(0)
  const [progress, setProgress] = React.useState(0)
  const [held, setHeld] = React.useState(false)
  const start = React.useRef(Date.now())
  React.useEffect(() => {
    if (!data || held) return
    start.current = Date.now()
    const t = window.setInterval(() => {
      const gone = (Date.now() - start.current) / STAGE_MS
      if (gone >= 1) {
        setAt((i) => (i + 1) % STAGES.length)
        start.current = Date.now()
        setProgress(0)
      } else setProgress(gone)
    }, 80)
    return () => window.clearInterval(t)
  }, [data, held, at])
  const clock = at === 2 ? Math.min(72, progress * 1.25 * 72) : 72

  return (
    <BlockOrder page="loop" initial={["loop"]}>
      <OrderedBlock id="loop" label="The loop">
        <MainBlock
          title="The loop"
          height="auto"
          tools={data ? <Rail at={at} progress={progress} onPick={(i) => (setAt(i), (start.current = Date.now()), setProgress(0))} /> : undefined}
          footer={
            data
              ? `One real short, ${data.short.title.slice(0, 60)} (${data.short.channel}); every number read from the serving model files and the poller's rows. The short sits in the models' training catalog; the mechanism, not a held-out test.`
              : undefined
          }
        >
          {!data ? (
            <p className="py-10 text-center text-sm text-slate-500">No finished short under watch yet. The poller writes the first curve within days of a channel joining the watch list.</p>
          ) : (
            <div onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} className="min-h-[300px]">
              {at === 0 && (
                <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
                  <div>
                    <p className="text-sm font-medium">{data.short.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {data.short.channel} · {data.short.durationSec}s · scored from what it carried at publish, {data.short.publishedAt}
                    </p>
                    <p className="mt-6 text-5xl font-semibold tabular-nums text-pax2-blue">{pct(data.predict.p)}</p>
                    <p className="mt-1 text-sm text-slate-800">chance of a Hit: 3x the channel&apos;s median of {fmt(data.short.median)} views</p>
                    {data.predict.expectedViews != null && <p className="mt-3 text-sm text-slate-800">{fmt(data.predict.expectedViews)} views expected</p>}
                    <p className="mt-6 text-xs text-slate-500">
                      PAX2 Classifier {data.predict.model.version}, AUC {data.predict.model.auc.toFixed(3)} across {fmt(data.predict.model.n)} shorts, fit {data.predict.model.builtAt}
                    </p>
                  </div>
                  <div className="space-y-2.5 self-center">
                    {data.predict.contributions.map((c) => (
                      <Pull key={c.label} label={c.label} pull={c.pull} max={Math.max(...data.predict.contributions.map((v) => Math.abs(v.pull)), 0.01)} />
                    ))}
                  </div>
                </div>
              )}
              {at === 1 && (
                <div className="max-w-2xl">
                  {data.recommend.changes.map((r) => (
                    <div key={r.action} className="flex items-baseline justify-between gap-4 border-b py-3 text-sm last:border-b-0" data-find={r.action}>
                      <span>{r.action}</span>
                      <span className="shrink-0 text-right">
                        <span className={cn("font-semibold tabular-nums", r.points > 0 ? "text-pax2-above" : "text-pax2-below")}>
                          {r.points > 0 ? "+" : ""}
                          {r.points.toFixed(1)} points
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {r.low.toFixed(1)} to {r.high.toFixed(1)}, {r.scope}
                        </span>
                      </span>
                    </div>
                  ))}
                  <p className="mt-4 text-xs text-slate-500">
                    Hit-rate lifts measured within channel across {fmt(data.recommend.measured.videos)} shorts on {fmt(data.recommend.measured.channels)} channels, refreshed {data.recommend.measured.builtAt}
                    {data.recommend.keeps.length ? `; ${data.recommend.keeps.length} favorable traits already in place` : ""}
                  </p>
                </div>
              )}
              {at === 2 && (
                <div>
                  <Curve track={data.track} median={data.short.median} clock={clock} />
                  <p className="mt-2 text-xs text-slate-500">
                    {fmt(data.track.readings)} poller readings over 72 hours; at 1, 3 and 6 hours, the velocity model&apos;s live call from the curve so far
                  </p>
                </div>
              )}
              {at === 3 && (
                <div className="max-w-2xl">
                  <LearnRow name="Training set: settled shorts with outcomes, the classifier's food" count={data.learn.trainingRows} unit="rows" date={data.learn.setBuiltAt} />
                  <LearnRow name="Velocity curves with a 72-hour verdict, the velocity model's food" count={data.learn.velocityCurves} unit="curves" date={data.learn.velocityBuiltAt} />
                  <LearnRow name="Recommendation evidence: within-channel lifts" count={data.learn.liftVideos} unit="shorts" date={data.learn.liftBuiltAt} />
                  <p className="mt-4 text-sm text-slate-800">
                    Each refit writes the files the Score stage reads. {fmt(data.learn.outliers)} of {fmt(data.learn.trainingRows)} settled shorts are Hits
                    {data.learn.velocityAuc6 != null ? `; the 6-hour call holds AUC ${data.learn.velocityAuc6.toFixed(2)} out of channel` : ""}.
                  </p>
                </div>
              )}
            </div>
          )}
        </MainBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
