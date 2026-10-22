"use client"

import * as React from "react"
import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts"

import channelQ from "../../../data/generated/model/channel-q.json"
import { ChartBlock } from "@/components/blocks"
import { TourButton, TourCard, type TourStep } from "@/components/record/chart-tour"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/nova/select"

// The universal resonance curve, after George Watson's PHYS345 figure (Univ. of Delaware): the response
// 1/√(1 + Q²(x − 1/x)²) against the dimensionless frequency x = f/f₀, on a log axis from 0.1 to 10,
// where it is symmetric about 1. Dividing by f₀ takes any system's scale out; Q is what's left, how sharp
// it answers. A short's ratio (views over its channel's median) is the same division, so a channel's
// shorts can be drawn on the same axes: the black curve is how one channel's shorts spread, scaled to
// peak at 1, with the Q of the textbook curve as wide as it (scripts/resonance/channel-q.mjs). The
// pointer's x is the frequency, or the ratio; the readout gives every curve there, and the card shows
// one of the channel's shorts near that ratio.

const RED = "#dc2626"
const NAVY = "#1e3a8a"
const SKY = "#60a5fa"
const INK = "#0f172a"
const AXIS = { fontSize: 12, fill: "#334155" }

const MARGIN = { top: 28, right: 16, bottom: 4, left: 0 }
const Y_WIDTH = 40
const X_HEIGHT = 40
const LEFT = MARGIN.left + Y_WIDTH
const BOTTOM = MARGIN.bottom + X_HEIGHT

const QS = [
  { q: 1, key: "q1", color: SKY },
  { q: 10, key: "q10", color: NAVY },
  { q: 100, key: "q100", color: RED },
] as const
type Key = (typeof QS)[number]["key"]

const response = (x: number, q: number) => 1 / Math.sqrt(1 + q * q * (x - 1 / x) ** 2)

// Log-spaced across the axis, and dense around 1 so Q = 100's needle peak is drawn whole.
const XS = [...Array.from({ length: 601 }, (_, i) => 10 ** (-1 + (2 * i) / 600)), ...Array.from({ length: 241 }, (_, i) => 0.97 + i * 0.00025)].sort((a, b) => a - b)
const DATA = XS.map((x) => ({ x, q1: response(x, 1), q10: response(x, 10), q100: response(x, 100) }))

type Short = { id: string; title: string; ratio: number }
type Channel = { id: string; name: string; count: number; spread: number; p10: number; p90: number; at3x: number; peak: number; q: number; curve: number[]; shorts: Short[] }
const GRID = channelQ.grid as number[]
const CHANNELS = (channelQ.channels as Channel[]).filter((c) => c.shorts.length >= 10).sort((a, b) => a.name.localeCompare(b.name))
const byId = (id: string) => CHANNELS.find((c) => c.id === id) ?? CHANNELS[0]

/** A channel's curve at any ratio, read straight between its grid points in log space. */
function curveAt(c: Channel, x: number) {
  const g = Math.min(GRID.length - 1, Math.max(0, ((Math.log10(x) + 1) / 2) * (GRID.length - 1)))
  const i = Math.floor(g)
  const t = g - i
  return c.curve[i] + t * ((c.curve[Math.min(i + 1, GRID.length - 1)] ?? c.curve[i]) - c.curve[i])
}
/** The channel's short whose ratio sits nearest the cursor, on the log scale. */
const nearest = (c: Channel, x: number) => c.shorts.reduce((a, s) => (Math.abs(Math.log10(s.ratio / x)) < Math.abs(Math.log10(a.ratio / x)) ? s : a))

// The tour's channels: the tightest and the loosest of those with 500 or more shorts; and the range of
// Q across channels with 200 or more.
const big = CHANNELS.filter((c) => c.count >= 500)
const TIGHT = big.reduce((a, c) => (c.spread < a.spread ? c : a))
const LOOSE = big.reduce((a, c) => (c.spread > a.spread ? c : a))
const sized = CHANNELS.filter((c) => c.count >= 200)
const QMIN = sized.reduce((a, c) => (c.q < a.q ? c : a))
const QMAX = sized.reduce((a, c) => (c.q > a.q ? c : a))
const DEFAULT = CHANNELS.find((c) => c.name === "Brennan Center for Justice") ?? TIGHT
const pct = (v: number) => `${Math.round(v * 100)}%`

type Step = TourStep<Key> & { channel?: string }
const TOUR: Step[] = [
  { text: "How to read it: the bottom axis is a video's views divided by its channel's usual (median) views. 1 means exactly usual, 2 means double, 3 means triple. The same scale fits a tiny channel and a huge one, which is the whole trick.", at: 0.5, focus: "q1" },
  { text: `The grey curves come from physics: how sharply a system answers around its natural point, written Q. A sharp system (Q = 100) only answers very near 1 — at 1.01 it is already down to ${pct(response(1.01, 100))}.`, at: 1.01, focus: "q100" },
  { text: `A broad system (Q = 1) answers almost everywhere — at double its natural point it still gives ${pct(response(2, 1))}.`, at: 2, focus: "q1" },
  { text: `The black curve is a real channel, ${TIGHT.name}: how its shorts spread around their usual. It behaves like a broad system — Q ${TIGHT.q}.`, at: 1, channel: TIGHT.id },
  { text: `Every channel measured is broad: Q runs only from ${QMIN.q} (${QMIN.name}) to ${QMAX.q} (${QMAX.name}). Here is ${LOOSE.name}, at Q ${LOOSE.q}.`, at: 1, channel: LOOSE.id },
  { text: `Why it matters: reaching 3× is common on some channels (${LOOSE.at3x}% for ${LOOSE.name}) and rare on others (${TIGHT.at3x}% for ${TIGHT.name}). So PAX2 always judges a short against its own channel, never across channels.`, at: 3, channel: LOOSE.id },
]

const fmtX = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(2) : x.toFixed(3))

function Card({ s, x, y }: { s: Short; x: number; y: number }) {
  const flip = x > 0.7
  return (
    <div
      className="pointer-events-none absolute z-10 flex w-40 flex-col gap-1 rounded-lg bg-slate-900 p-1 text-white shadow-e3"
      style={{
        left: `calc(${LEFT}px + ${x} * (100% - ${LEFT + MARGIN.right}px))`,
        top: `calc(${MARGIN.top}px + ${1 - y} * (100% - ${MARGIN.top + BOTTOM}px))`,
        transform: `translate(${flip ? "calc(-100% - 16px)" : "16px"}, -50%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-md object-cover" />
      <p className="truncate px-0.5 text-[11px] font-semibold leading-snug">{s.title}</p>
      <p className="px-0.5 pb-0.5 font-mono text-[10px] tabular-nums text-white/70">{s.ratio.toFixed(2)}× its channel&apos;s median</p>
    </div>
  )
}

function UniversalChart({ channel, tour }: { channel: Channel; tour: Step | null }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - box.left - LEFT) / (box.width - LEFT - MARGIN.right)))
    setHover(10 ** (-1 + 2 * f))
  }
  // While the tour runs, it moves the cursor; the pointer takes over when it ends.
  const x = tour ? (tour.at ?? null) : hover
  const dim = (key: Key) => (tour?.focus && tour.focus !== key ? 0.2 : 1)
  const curve = React.useMemo(() => GRID.map((gx, i) => ({ x: gx, v: channel.curve[i] })), [channel])
  const s = x != null && !tour?.focus ? nearest(channel, x) : null
  const cv = x != null ? curveAt(channel, x) : 0
  return (
    <div onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => setHover(null)} className="relative size-full cursor-crosshair touch-pan-y select-none [&_*:focus]:outline-none">
      <div className="pointer-events-none absolute right-4 top-1 z-10 font-mono text-xs tabular-nums text-slate-900">
        {x != null && (
          <>
            f/f₀ = {fmtX(x)}
            {QS.map(({ q, color }) => (
              <span key={q} style={{ color }}>
                {" "}· Q={q}: {response(x, q).toFixed(2)}
              </span>
            ))}
            <span className="font-semibold"> · {channel.name}: {cv.toFixed(2)}</span>
          </>
        )}
      </div>
      {s && <Card s={s} x={(Math.log10(x!) + 1) / 2} y={cv} />}
      <ComposedChart data={DATA} margin={MARGIN} responsive style={{ width: "100%", height: "100%" }}>
        <XAxis dataKey="x" type="number" scale="log" domain={[0.1, 10]} ticks={[0.1, 0.2, 0.5, 1, 2, 5, 10]} tickFormatter={(v: number) => String(v)} tick={AXIS} height={X_HEIGHT} label={{ value: "Dimensionless frequency, f / f₀ · a short's views over its channel's median", position: "insideBottomRight", offset: 0, ...AXIS }} allowDataOverflow />
        <YAxis domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={AXIS} width={Y_WIDTH} label={{ value: "Response", angle: -90, position: "insideLeft", offset: 4, ...AXIS }} />
        {[0.2, 0.5, 2, 5].map((v) => (
          <ReferenceLine key={v} x={v} stroke="#e2e8f0" />
        ))}
        <ReferenceLine x={1} stroke="#475569" strokeDasharray="5 5" />
        <Area data={curve} dataKey="v" stroke={INK} strokeWidth={2.5} fill={INK} fillOpacity={0.07} strokeOpacity={tour?.focus ? 0.2 : 1} dot={false} activeDot={false} isAnimationActive={false} />
        {QS.map(({ key, color }) => (
          <Line key={key} dataKey={key} stroke={color} strokeOpacity={dim(key)} strokeWidth={key === "q100" ? 2 : 3} dot={false} activeDot={false} isAnimationActive={false} />
        ))}
        {x != null && <ReferenceLine x={x} stroke="#0f172a" strokeOpacity={0.15} />}
        {x != null &&
          QS.map(({ q, key, color }) => (
            <ReferenceDot key={key} x={x} y={response(x, q)} shape={(p: { cx?: number; cy?: number }) => (p.cx == null || p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={4.5} fill={color} fillOpacity={dim(key)} stroke="#fff" strokeWidth={2} />)} />
          ))}
        {x != null && <ReferenceDot x={x} y={cv} shape={(p: { cx?: number; cy?: number }) => (p.cx == null || p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={5} fill={INK} stroke="#fff" strokeWidth={2} />)} />}
      </ComposedChart>
    </div>
  )
}

export function UniversalBlock() {
  const [step, setStep] = React.useState<number | null>(null)
  const [picked, setPicked] = React.useState(DEFAULT.id)
  // The tour shows its own channels; the pick comes back when it ends.
  const channel = byId(step != null ? (TOUR[step].channel ?? picked) : picked)
  return (
    <ChartBlock
      title="Universal Resonance"
      height="auto"
      className="lift"
      rows={CHANNELS.map(({ name, count, q, spread, p10, p90, at3x }) => ({ channel: name, shorts: count, q, middleHalf: spread, p10, p90, at3x }))}
      name="universal-resonance"
      actions={
        <>
          <Select value={channel.id} onValueChange={(v) => v && setPicked(String(v))}>
            <SelectTrigger className="w-max min-w-44" size="sm" aria-label="Channel">
              <SelectValue>{() => `${channel.name} · Q ${channel.q}`}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-80 w-max min-w-56 rounded-xl">
              {CHANNELS.map((c) => (
                <SelectItem key={c.id} value={c.id} className="whitespace-nowrap">
                  {c.name} · Q {c.q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TourButton on={step != null} onClick={() => setStep(step == null ? 0 : null)} />
        </>
      }
    >
      <div className="relative aspect-[1130/545] min-h-64 w-full">
        <UniversalChart channel={channel} tour={step == null ? null : TOUR[step]} />
        {/* Top right: past double the natural frequency every curve has fallen under half. */}
        {step != null && <TourCard steps={TOUR} step={step} onStep={setStep} className="right-6 top-8" />}
      </div>
    </ChartBlock>
  )
}
