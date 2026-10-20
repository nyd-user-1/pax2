"use client"

import * as React from "react"
import { Bar, Cell, ComposedChart, ErrorBar, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts"

import data from "../../../data/generated/model/topic-lift.json"
import { ChartBlock } from "@/components/blocks"
import { TourButton, TourCard, type TourStep } from "@/components/record/chart-tour"

// The resonant topic, in the first two charts' manner. Each row is a topic found across real channels
// (scripts/resonance/topic-lift.mjs); its bar is how much more, or less, often its shorts reach 3x their
// channel's median than those channels usually manage, in points, with the 90% range from re-drawing
// the topic's channels. Right of zero the topic lifts a short; left of it, the topic weighs it down.
// The pointer picks a row; the tooltip shows a real short from it.

const RED = "#dc2626"
const NAVY = "#1e3a8a"
const INK = "#0f172a"
const AXIS = { fontSize: 12, fill: "#334155" }

const MARGIN = { top: 28, right: 24, bottom: 4, left: 0 }
const Y_WIDTH = 220
const X_HEIGHT = 40
const LEFT = MARGIN.left + Y_WIDTH
const BOTTOM = MARGIN.bottom + X_HEIGHT

type Topic = { id: number; name: string; lift: number; low: number; high: number; shorts: number; channels: number; channelsUp: number; channelsSized: number; example: { id: string; title: string } | null }

const TOPICS = (data.topics as Topic[]).map((t) => ({ ...t, range: [t.lift - t.low, t.high - t.lift] as [number, number] }))
const X_MIN = Math.floor(Math.min(...TOPICS.map((t) => t.low)) / 5) * 5
const X_MAX = Math.ceil(Math.max(...TOPICS.map((t) => t.high)) / 5) * 5
const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`

// Each stage says what to take from it; the topics are picked from the data.
const TOP = TOPICS[0]
const BOTTOM_TOPIC = TOPICS[TOPICS.length - 1]
const REFORM = TOPICS.find((t) => t.name === "Electoral reform explainers")
const UNSETTLED = TOPICS.filter((t) => t.low < 0 && t.high > 0).reduce<Topic | null>((a, t) => (!a || Math.abs(t.lift) > Math.abs(a.lift) ? t : a), null)
const TOUR: TourStep[] = [
  { text: `${TOP.name} lift shorts the most: they reach 3× their channel's median ${Math.abs(TOP.lift).toFixed(1)} points more often than those channels usually do, across ${TOP.channels} channels.`, at: TOP.id },
  ...(REFORM ? [{ text: `${REFORM.name} land at ${pts(REFORM.lift)}: the topic neither lifts nor sinks a short, so the lift has to come from how it's made — its length, its opening, its delivery.`, at: REFORM.id }] : []),
  { text: `${BOTTOM_TOPIC.name} sink the most: ${Math.abs(BOTTOM_TOPIC.lift).toFixed(1)} points under their channels' usual rate, across ${BOTTOM_TOPIC.channels} channels.`, at: BOTTOM_TOPIC.id },
  ...(UNSETTLED ? [{ text: `The black line on each bar is its 90% range. Where it crosses zero, as with ${UNSETTLED.name.toLowerCase()}, the lift isn't settled either way.`, at: UNSETTLED.id }] : []),
  { text: "Hover any row for a real short from that topic." },
]

function Tip({ t, x, y }: { t: (typeof TOPICS)[number]; x: number; y: number }) {
  if (!t.example) return null
  const up = t.lift >= 0
  return (
    <div
      className={`pointer-events-none absolute z-10 flex w-40 flex-col gap-1 rounded-lg p-1 shadow-e3 ${up ? "bg-pax2-blue text-white" : "bg-pax2-red text-white"}`}
      style={{
        left: `calc(${LEFT}px + ${x} * (100% - ${LEFT + MARGIN.right}px))`,
        top: `calc(${MARGIN.top}px + ${y} * (100% - ${MARGIN.top + BOTTOM}px))`,
        // Beyond the bar's end, on the side it points to.
        transform: `translate(${up ? "16px" : "calc(-100% - 16px)"}, -50%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${t.example.id}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-md object-cover" />
      <p className="truncate px-0.5 pb-0.5 text-[11px] font-semibold leading-snug">{t.example.title}</p>
    </div>
  )
}

function TopicChart({ tour }: { tour: TourStep | null }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - box.top - MARGIN.top) / (box.height - MARGIN.top - BOTTOM)
    setHover(y < 0 || y >= 1 ? null : Math.floor(y * TOPICS.length))
  }
  // While the tour runs, it picks the row; the pointer takes over when it ends.
  const i = tour ? (tour.at != null ? TOPICS.findIndex((t) => t.id === tour.at) : null) : hover
  const t = i != null && i >= 0 ? TOPICS[i] : null
  return (
    <div onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => setHover(null)} className="relative size-full cursor-crosshair touch-pan-y select-none [&_*:focus]:outline-none">
      <div className="pointer-events-none absolute right-6 top-1 z-10 font-mono text-xs tabular-nums text-slate-900">
        {t && (
          <>
            {t.name} · <span className={t.lift >= 0 ? "text-pax2-blue" : "text-pax2-red"}>{pts(t.lift)} pts</span> ({pts(t.low)} to {pts(t.high)}) · {t.shorts} shorts · {t.channels} channels
          </>
        )}
      </div>
      {t && <Tip t={t} x={((t.lift >= 0 ? t.high : t.low) - X_MIN) / (X_MAX - X_MIN)} y={(i! + 0.5) / TOPICS.length} />}
      <ComposedChart layout="vertical" data={TOPICS} margin={MARGIN} barCategoryGap={6} responsive style={{ width: "100%", height: "100%" }}>
        <ReferenceArea x1={X_MIN} x2={0} fill={RED} fillOpacity={0.06} />
        <ReferenceArea x1={0} x2={X_MAX} fill={NAVY} fillOpacity={0.06} />
        <XAxis type="number" domain={[X_MIN, X_MAX]} ticks={Array.from({ length: (X_MAX - X_MIN) / 5 + 1 }, (_, k) => X_MIN + k * 5)} tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)} tick={AXIS} height={X_HEIGHT} label={{ value: "Points over the channels' usual 3× rate", position: "insideBottomRight", offset: 0, ...AXIS }} />
        <YAxis type="category" dataKey="name" width={Y_WIDTH} tick={AXIS} tickLine={false} interval={0} />
        <ReferenceLine x={0} stroke="#475569" strokeDasharray="5 5" />
        <Bar dataKey="lift" isAnimationActive={false} activeBar={false}>
          {TOPICS.map((row, k) => (
            <Cell key={row.id} fill={row.lift >= 0 ? NAVY : RED} fillOpacity={i == null || i === k ? 1 : 0.25} />
          ))}
          <ErrorBar dataKey="range" direction="x" width={6} stroke={INK} strokeWidth={1.5} />
        </Bar>
      </ComposedChart>
    </div>
  )
}

export function TopicBlock() {
  const [step, setStep] = React.useState<number | null>(null)
  return (
    <ChartBlock
      title="Resonant Topic"
      height="auto"
      className="lift"
      rows={TOPICS.map(({ name, lift, low, high, shorts, channels }) => ({ topic: name, lift, low, high, shorts, channels }))}
      name="resonant-topic"
      actions={<TourButton on={step != null} onClick={() => setStep(step == null ? 0 : null)} />}
    >
      <div className="relative aspect-[1130/545] min-h-80 w-full">
        <TopicChart tour={step == null ? null : TOUR[step]} />
        {/* Bottom right: the bars there are short or point left. */}
        {step != null && <TourCard steps={TOUR} step={step} onStep={setStep} className="bottom-14 top-auto" />}
      </div>
    </ChartBlock>
  )
}
