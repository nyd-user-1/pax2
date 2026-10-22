"use client"

import * as React from "react"
import { Area, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts"

import data from "../../../data/generated/model/length-crossing.json"
import { ChartBlock } from "@/components/blocks"
import { TourButton, TourCard, type TourStep } from "@/components/record/chart-tour"

// The resonant frequency chart's measured twin. Across the settled shorts, by length: the share that
// outperform (3x their channel's median or more) and the share that underperform (half the median or less),
// each short scored against its own channel's rates (scripts/resonance/length-crossing.mjs). Below the
// crossing a short is likelier to outperform than to underperform; above it, the reverse. The pointer's x is the
// length, eased like the first chart; the tooltip shows a real short from the band under the cursor.

const RED = "#dc2626"
const INK = "#0f172a"
const NAVY = "#1e3a8a"
const AXIS = { fontSize: 12, fill: "#334155" }

const MARGIN = { top: 28, right: 12, bottom: 4, left: 0 }
const Y_WIDTH = 44
const X_HEIGHT = 40
const LEFT = MARGIN.left + Y_WIDTH
const BOTTOM = MARGIN.bottom + X_HEIGHT

type Short = { id: string; title: string; channel: string; family: string; ratio: number; seconds: number } | null
type Bin = { from: number; to: number; mid: number; n: number; within: { outperform: number; underperform: number }; outperformShort: Short; underperformShort: Short }

const BINS = data.bins as Bin[]
const CROSS = data.crossing.within as { seconds: number; share: number }
const S_MIN = 0
// The axis ends at the last measured point: the 120–180 second band, plotted at its midpoint.
const S_MAX = 150
const Y_TOP = 26
const POINTS = BINS.map((b) => ({ s: b.mid, outperform: b.within.outperform, underperform: b.within.underperform }))
// The shading follows the curves: blue under the outperform curve before the crossing, red under the underperform curve after.
const SHADE = [...POINTS.filter((p) => p.s < CROSS.seconds), { s: CROSS.seconds, outperform: CROSS.share, underperform: CROSS.share }, ...POINTS.filter((p) => p.s > CROSS.seconds)].map((p) => ({
  ...p,
  before: p.s <= CROSS.seconds ? p.outperform : null,
  after: p.s >= CROSS.seconds ? p.underperform : null,
}))

/** Both curves at any length, read straight between the measured band midpoints. */
function at(s: number) {
  const i = Math.max(1, POINTS.findIndex((p) => p.s >= s))
  const a = POINTS[i - 1]
  const b = POINTS[Math.min(i, POINTS.length - 1)]
  const t = b.s === a.s ? 0 : Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s)))
  return { outperform: a.outperform + t * (b.outperform - a.outperform), underperform: a.underperform + t * (b.underperform - a.underperform) }
}

const bandAt = (s: number) => BINS.find((b) => s >= b.from && s < b.to) ?? BINS[BINS.length - 1]
const onMessage = (x: Short) => !!x && (x.family === "Reform" || x.family === "Voting rights")

/** Eases toward `target` for the tour's moves and the glide home; `instant` (the pointer on the chart) follows it exactly. */
function useEased(target: number, instant = false) {
  const [value, setValue] = React.useState(target)
  const current = React.useRef(target)
  React.useEffect(() => {
    if (instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target
      setValue(target)
      return
    }
    let raf = 0
    const tick = () => {
      const d = target - current.current
      current.current = Math.abs(d) < 1e-3 ? target : current.current + d * 0.16
      setValue(current.current)
      if (current.current !== target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, instant])
  return value
}

function Dot({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  if (cx == null || cy == null) return <g />
  return <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
}

function Pulse({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  if (cx == null || cy == null) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.35} className="animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
    </g>
  )
}

/** A measured band's midpoint, small, so the reader can see where the line is data and where it's drawn between. */
function Measured({ cx, cy, color, opacity = 1 }: { cx?: number; cy?: number; color: string; opacity?: number }) {
  if (cx == null || cy == null) return <g />
  return <circle cx={cx} cy={cy} r={2.5} fill={color} fillOpacity={opacity} />
}

function Tip({ v, tone, x, y, flip }: { v: NonNullable<Short>; tone: string; x: number; y: number; flip: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute z-10 flex w-40 flex-col gap-1 rounded-lg p-1 shadow-e3 ${tone}`}
      style={{
        left: `calc(${LEFT}px + ${x} * (100% - ${LEFT + MARGIN.right}px))`,
        top: `calc(${MARGIN.top}px + ${1 - y} * (100% - ${MARGIN.top + BOTTOM}px))`,
        transform: `translate(${flip ? "calc(-100% - 16px)" : "16px"}, -50%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-md object-cover" />
      <p className="truncate px-0.5 pb-0.5 text-[11px] font-semibold leading-snug">{v.title}</p>
    </div>
  )
}

type Line2 = "outperform" | "underperform"

// The tour, a stage at a time: each stage sets the cursor's length and the line it's about.
// Each stage says what the reader should take from it; its numbers are read from the measured bands.
const BEST = BINS.reduce((a, b) => (b.within.outperform > a.within.outperform ? b : a))
const WORST = BINS.reduce((a, b) => (b.within.underperform > a.within.underperform ? b : a))
const LONGEST = BINS[BINS.length - 1]
const oneIn = (pct: number) => `1 in ${Math.round(100 / pct)}`
const TOUR: TourStep<Line2>[] = [
  { text: "How to read it: across the bottom is how long a short runs. The blue line is the share of shorts at that length that did very well (3× their channel's usual views). Blue high is good.", at: (BEST.from + BEST.to) / 2, focus: "outperform" },
  { text: "The red line is the share that did badly (under half the channel's usual views). Red high is bad.", at: (WORST.from + WORST.to) / 2, focus: "underperform" },
  { text: `Short wins: under ${BEST.to} seconds, about ${oneIn(BEST.within.outperform)} does very well — the best odds on the chart. Only ${oneIn(BEST.within.underperform)} does badly there.`, at: (BEST.from + BEST.to) / 2, focus: "outperform" },
  { text: `Where the lines cross — ${Math.round(CROSS.seconds)} seconds — is the tipping point. Past it a short is more likely to do badly than very well, worst at ${WORST.from}–${WORST.to} seconds (${oneIn(WORST.within.underperform)} does badly). The longest shorts recover a little, ${LONGEST.within.outperform.toFixed(0)}% against the short ones' ${BEST.within.outperform.toFixed(0)}%.`, at: (WORST.from + WORST.to) / 2 },
  { text: "Now slide your cursor across the chart. The black bar is simply blue minus red at that length, and the little card shows a real short from there.", at: 45 },
]

function LengthChart({ tour }: { tour: TourStep<Line2> | null }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left - LEFT) / (box.width - LEFT - MARGIN.right)
    setHover(S_MIN + Math.min(1, Math.max(0, x)) * (S_MAX - S_MIN))
  }
  // While the tour runs, it moves the cursor; the pointer takes over again when it ends.
  const target = tour ? (tour.at ?? CROSS.seconds) : (hover ?? CROSS.seconds)
  const showTip = tour ? tour.at != null : hover != null
  const dim = (line: Line2) => (tour?.focus && tour.focus !== line ? 0.2 : 1)
  const s = Math.min(S_MAX, Math.max(5, useEased(target, !tour && hover != null)))
  const { outperform, underperform } = at(s)
  const tuned = Math.abs(s - CROSS.seconds) < 2
  const band = bandAt(s)
  const near = bandAt(CROSS.seconds)
  const v = tuned ? [near.outperformShort, near.underperformShort, bandAt(CROSS.seconds - 5).underperformShort, bandAt(CROSS.seconds - 5).outperformShort].find(onMessage) ?? near.outperformShort : s < CROSS.seconds ? band.outperformShort : band.underperformShort
  const tone = tuned ? "bg-white text-pax2-blue ring-1 ring-foreground/10" : s < CROSS.seconds ? "bg-pax2-blue text-white" : "bg-pax2-red text-white"
  return (
    <div onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => setHover(null)} className="relative size-full cursor-crosshair touch-pan-y select-none [&_*:focus]:outline-none">
      <div className="pointer-events-none absolute right-4 top-1 z-10 font-mono text-xs tabular-nums text-slate-900">
        {Math.round(s)}s · <span className="text-pax2-blue">{outperform.toFixed(1)}% outperform 3×</span> · <span className="text-pax2-red">{underperform.toFixed(1)}% underperform ½×</span>
      </div>
      {/* The gap, in points, beside the black bar's middle; opposite the tooltip's side. */}
      {!tuned && (
        <div
          className="pointer-events-none absolute z-10 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white shadow-e1"
          style={{
            background: INK,
            left: `calc(${LEFT}px + ${(s - S_MIN) / (S_MAX - S_MIN)} * (100% - ${LEFT + MARGIN.right}px))`,
            top: `calc(${MARGIN.top}px + ${1 - (outperform + underperform) / 2 / Y_TOP} * (100% - ${MARGIN.top + BOTTOM}px))`,
            transform: `translate(${s > 105 ? "10px" : "calc(-100% - 10px)"}, -50%)`,
          }}
        >
          {outperform - underperform >= 0 ? "+" : "−"}
          {Math.abs(outperform - underperform).toFixed(1)} pts
        </div>
      )}
      {showTip && v && <Tip v={v} tone={tone} x={(s - S_MIN) / (S_MAX - S_MIN)} y={Math.min(tuned ? CROSS.share : Math.max(outperform, underperform), Y_TOP) / Y_TOP} flip={s > 105} />}
      <ComposedChart data={SHADE} margin={MARGIN} responsive style={{ width: "100%", height: "100%" }}>
        <Area dataKey="before" stroke="none" fill={NAVY} fillOpacity={0.07} activeDot={false} isAnimationActive={false} />
        <Area dataKey="after" stroke="none" fill={RED} fillOpacity={0.1} activeDot={false} isAnimationActive={false} />
        <XAxis dataKey="s" type="number" domain={[S_MIN, S_MAX]} ticks={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]} tickFormatter={(t: number) => `${t}s`} tick={AXIS} height={X_HEIGHT} label={{ value: "Length", position: "insideBottomRight", offset: 0, ...AXIS }} />
        <YAxis domain={[0, Y_TOP]} ticks={[0, 5, 10, 15, 20, 25]} tickFormatter={(t: number) => `${t}%`} tick={AXIS} width={Y_WIDTH} label={{ value: "Share of shorts", angle: -90, position: "insideLeft", offset: 4, ...AXIS }} />
        <ReferenceLine x={CROSS.seconds} stroke="#475569" strokeDasharray="5 5" label={{ value: `${CROSS.seconds.toFixed(0)}s`, position: "insideBottomLeft", offset: 6, ...AXIS }} />
        <ReferenceLine segment={[{ x: S_MIN, y: CROSS.share }, { x: CROSS.seconds, y: CROSS.share }]} stroke="#475569" strokeDasharray="5 5" />
        <Line data={POINTS} dataKey="outperform" stroke={NAVY} strokeOpacity={dim("outperform")} strokeWidth={3} dot={(p: { cx?: number; cy?: number; key?: React.Key | null }) => <Measured key={p.key ?? undefined} cx={p.cx} cy={p.cy} color={NAVY} opacity={dim("outperform")} />} activeDot={false} isAnimationActive={false} />
        <Line data={POINTS} dataKey="underperform" stroke={RED} strokeOpacity={dim("underperform")} strokeWidth={3} dot={(p: { cx?: number; cy?: number; key?: React.Key | null }) => <Measured key={p.key ?? undefined} cx={p.cx} cy={p.cy} color={RED} opacity={dim("underperform")} />} activeDot={false} isAnimationActive={false} />
        {!tuned && <ReferenceLine x={s} stroke="#0f172a" strokeOpacity={0.15} />}
        {!tuned && <ReferenceLine segment={[{ x: s, y: outperform }, { x: s, y: underperform }]} stroke={INK} strokeWidth={5} />}
        {!tuned && <ReferenceDot x={s} y={outperform} shape={(p: { cx?: number; cy?: number }) => <Dot {...p} color={NAVY} />} />}
        {!tuned && <ReferenceDot x={s} y={underperform} shape={(p: { cx?: number; cy?: number }) => <Dot {...p} color={RED} />} />}
        <ReferenceDot x={CROSS.seconds} y={CROSS.share} shape={(p: { cx?: number; cy?: number }) => (tuned ? <Pulse {...p} color={RED} /> : <Dot {...p} color="#475569" />)} />
      </ComposedChart>
    </div>
  )
}

export function LengthBlock() {
  const [step, setStep] = React.useState<number | null>(null)
  return (
    <ChartBlock
      title="Resonant Length"
      height="auto"
      className="lift"
      rows={BINS.map((b) => ({ from: b.from, to: b.to, shorts: b.n, outperform: b.within.outperform, underperform: b.within.underperform }))}
      name="resonant-length"
      actions={<TourButton on={step != null} onClick={() => setStep(step == null ? 0 : null)} />}
    >
      <div className="relative aspect-[1130/545] min-h-64 w-full">
        <LengthChart tour={step == null ? null : TOUR[step]} />
        {/* Bottom right, under the lines: past a minute both sit well above the axis. */}
        {step != null && <TourCard steps={TOUR} step={step} onStep={setStep} className="bottom-14 top-auto" />}
      </div>
    </ChartBlock>
  )
}
