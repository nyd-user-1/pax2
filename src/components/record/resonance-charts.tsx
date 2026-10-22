"use client"

import * as React from "react"
import * as echarts from "echarts"

import data from "../../../data/generated/model/length-crossing.json"
import { ChartBlock } from "@/components/blocks"
import { TourButton, TourCard, type TourStep } from "@/components/record/chart-tour"

// The resonant frequency chart, read off the shorts. The textbook LC figure's two curves keep their
// forms — X_C falls as 1/f, X_L rises with f — each with a constant added, fitted (least squares,
// weighted by shorts per band) to the measured bands of Resonant Length from 5 to 90 seconds
// (scripts/resonance/length-crossing.mjs, within channel):
//   blue, X_C: the share that outperform (3x their channel's median or more) = c + b / length;
//   red, X_L: the share that underperform (half the median or less) = c + a · length.
// Where they meet is the resonant length. The small dots are the measured bands, so the fit shows.
// The pointer's x is the length; the tooltip shows a real short from the band under it. Drawn on
// ECharts (canvas): the curves draw in once, and the crossing ripples when the cursor reaches it.

const RED = "#dc2626"
const NAVY = "#1e3a8a"
const INK = "#0f172a"
const AXIS = { fontSize: 12, fill: "#334155" }

// Plot-area insets, matching the chart margins and the axes' sizes: pointer pixels map to data through them.
const MARGIN = { top: 28, right: 12, bottom: 4, left: 0 }
const Y_WIDTH = 44
const X_HEIGHT = 40
const LEFT = MARGIN.left + Y_WIDTH
const BOTTOM = MARGIN.bottom + X_HEIGHT

type Short = { id: string; title: string; family: string } | null
type Bin = { from: number; to: number; mid: number; n: number; within: { outperform: number; underperform: number }; outperformShort: Short; underperformShort: Short }
const BINS = (data.bins as Bin[]).filter((b) => b.mid <= 90)

/** Weighted least squares for y = c + k·f. */
function fit(fs: number[], ys: number[], ws: number[]) {
  let s0 = 0, s1 = 0, s2 = 0, sy = 0, sfy = 0
  fs.forEach((f, i) => {
    s0 += ws[i]; s1 += ws[i] * f; s2 += ws[i] * f * f; sy += ws[i] * ys[i]; sfy += ws[i] * f * ys[i]
  })
  const k = (s0 * sfy - s1 * sy) / (s0 * s2 - s1 * s1)
  const c = (sy - k * s1) / s0
  const mean = sy / s0
  const r2 = 1 - fs.reduce((t, f, i) => t + ws[i] * (ys[i] - (c + k * f)) ** 2, 0) / ys.reduce((t, y, i) => t + ws[i] * (y - mean) ** 2, 0)
  return { c, k, r2 }
}
const W = BINS.map((b) => b.n)
const XL = fit(BINS.map((b) => b.mid), BINS.map((b) => b.within.underperform), W)
const XC = fit(BINS.map((b) => 1 / b.mid), BINS.map((b) => b.within.outperform), W)
const xl = (s: number) => XL.c + XL.k * s
const xc = (s: number) => XC.c + XC.k / s
// Where they meet: XL.c + XL.k·s = XC.c + XC.k/s, so XL.k·s² + (XL.c − XC.c)·s − XC.k = 0.
const FR = (-(XL.c - XC.c) + Math.sqrt((XL.c - XC.c) ** 2 + 4 * XL.k * XC.k)) / (2 * XL.k)
const AT_FR = xl(FR)

const S_MIN = 5
const S_MAX = 90
const Y_TOP = 30
const CURVES = Array.from({ length: (S_MAX - S_MIN) * 4 + 1 }, (_, i) => {
  const s = S_MIN + i / 4
  return { s, xc: xc(s), xl: xl(s), xlRight: s >= FR ? xl(s) : null }
})
const MEASURED = BINS.map((b) => ({ s: b.mid, o: b.within.outperform, u: b.within.underperform }))

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

const bandAt = (s: number) => BINS.find((b) => s >= b.from && s < b.to) ?? BINS[BINS.length - 1]
const onMessage = (x: Short) => !!x && (x.family === "Reform" || x.family === "Voting rights")

/** The tooltip, beside the cursor's point: a real short's landscape thumbnail, its title beneath. */
function VideoTip({ v, tone, x, y, flip }: { v: NonNullable<Short>; tone: string; x: number; y: number; flip: boolean }) {
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

type Curve = "xc" | "xl"

// The tour, a stage at a time: each stage sets the cursor's length and the curve it's about.
const TOUR: TourStep<Curve>[] = [
  { text: `How to read it: across the bottom is how long a short runs. The blue curve is the share of shorts at that length that did very well (3× their channel's usual views) — about ${Math.round(xc(10))}% at 10 seconds, ${Math.round(xc(60))}% at a minute. Shorter is better.`, at: 10, focus: "xc" },
  { text: `The red line is the share that did badly (under half the usual). It climbs about ${(XL.k * 10).toFixed(1)} points every 10 seconds, from ${Math.round(xl(10))}% at 10 seconds to ${Math.round(xl(60))}% at a minute. Longer is worse.`, at: 60, focus: "xl" },
  { text: `The lines meet at ${Math.round(FR)} seconds. Shorter than that, doing very well is the likelier outcome; longer, doing badly is.`, at: FR },
  { text: `The small dots are the real measurements. The smooth curves are drawn through the dots to show the trend (fits: blue R² ${XC.r2.toFixed(2)}, red ${XL.r2.toFixed(2)}).`, at: 45 },
  { text: "Now slide your cursor across the chart. The black bar is simply blue minus red at that length, and the card shows a real short from there.", at: 40 },
]

const SILENT = { silent: true, animation: false } as const

/** What never moves: the axes, the shading, the two fitted curves, the measured dots, the guides to fr. */
function baseOption(): echarts.EChartsOption {
  const ticks = [15, FR, 30, 45, 60, 75, 90]
  return {
    animation: true,
    animationDuration: 900,
    animationDurationUpdate: 0,
    grid: { left: LEFT, right: MARGIN.right, top: MARGIN.top, bottom: BOTTOM },
    tooltip: { show: false },
    xAxis: {
      type: "value",
      min: S_MIN,
      max: S_MAX,
      name: "Length",
      nameLocation: "end",
      nameGap: -36,
      nameTextStyle: { ...AXIS, align: "right", verticalAlign: "top", padding: [28, 0, 0, 0] },
      axisLine: { lineStyle: { color: "#475569" } },
      axisTick: { customValues: ticks, lineStyle: { color: "#475569" } },
      axisLabel: { customValues: ticks, color: AXIS.fill, fontSize: AXIS.fontSize, formatter: (t: number) => (Math.abs(t - FR) < 1e-6 ? "fr" : `${t}s`) },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: Y_TOP,
      interval: 10,
      name: "Share of shorts",
      nameLocation: "middle",
      nameRotate: 90,
      nameGap: 32,
      nameTextStyle: AXIS,
      axisLine: { show: true, lineStyle: { color: "#475569" } },
      axisTick: { show: true, lineStyle: { color: "#475569" } },
      axisLabel: { color: AXIS.fill, fontSize: AXIS.fontSize, formatter: (t: number) => `${t}%` },
      splitLine: { show: false },
    },
    series: [
      {
        id: "shade",
        type: "line",
        data: CURVES.map((p) => [p.s, p.xlRight]),
        showSymbol: false,
        lineStyle: { width: 0 },
        areaStyle: { color: RED, opacity: 0.1 },
        markArea: { silent: true, itemStyle: { color: NAVY, opacity: 0.07 }, data: [[{ xAxis: S_MIN }, { xAxis: FR }]] },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "#475569", type: [5, 5], width: 1 },
          data: [{ xAxis: FR }, [{ coord: [S_MIN, AT_FR] }, { coord: [FR, AT_FR] }]],
        },
        z: 1,
        ...SILENT,
      },
      { id: "xc", type: "line", data: CURVES.map((p) => [p.s, p.xc]), showSymbol: false, lineStyle: { color: NAVY, width: 3 }, z: 3, silent: true },
      { id: "xl", type: "line", data: CURVES.map((p) => [p.s, p.xl]), showSymbol: false, lineStyle: { color: RED, width: 3 }, z: 3, silent: true },
      { id: "o", type: "scatter", data: MEASURED.map((m) => [m.s, m.o]), symbolSize: 5, itemStyle: { color: NAVY }, z: 4, silent: true },
      { id: "u", type: "scatter", data: MEASURED.map((m) => [m.s, m.u]), symbolSize: 5, itemStyle: { color: RED }, z: 4, silent: true },
    ],
  }
}

/** What moves with the cursor, by series id: the cursor line, the black gap bar, the two dots, the
 *  crossing (rippling when the cursor sits on it), and the tour's dimming. */
function liveSeries(s: number, up: number, down: number, tuned: boolean, dimXc: number, dimXl: number): echarts.SeriesOption[] {
  const dot = (color: string) => ({ color, borderColor: "#fff", borderWidth: 2 })
  return [
    { id: "xc", type: "line", lineStyle: { color: NAVY, width: 3, opacity: dimXc } },
    { id: "xl", type: "line", lineStyle: { color: RED, width: 3, opacity: dimXl } },
    { id: "o", type: "scatter", itemStyle: { color: NAVY, opacity: dimXc } },
    { id: "u", type: "scatter", itemStyle: { color: RED, opacity: dimXl } },
    { id: "cursor", type: "line", data: tuned ? [] : [[s, 0], [s, Y_TOP]], showSymbol: false, lineStyle: { color: INK, opacity: 0.15, width: 1 }, z: 2, ...SILENT },
    { id: "gap", type: "line", data: tuned ? [] : [[s, up], [s, down]], showSymbol: false, lineStyle: { color: INK, width: 5, cap: "butt" }, z: 5, ...SILENT },
    {
      id: "dots",
      type: "scatter",
      data: tuned ? [] : [{ value: [s, up], itemStyle: dot(NAVY) }, { value: [s, down], itemStyle: dot(RED) }],
      symbolSize: 10,
      z: 6,
      ...SILENT,
    },
    {
      id: "fr",
      type: "effectScatter",
      data: [[FR, AT_FR]],
      // Always red and rippling; a touch larger while the cursor sits on it, as the sidebar's icons grow on hover.
      symbolSize: tuned ? 14 : 11,
      showEffectOn: "render",
      rippleEffect: { scale: 2.6, brushType: "fill", period: 1.6, color: RED },
      itemStyle: dot(RED),
      label: { show: tuned, position: "top", distance: 12, formatter: "XL = Xc", color: NAVY, fontSize: 15, fontWeight: 700 },
      z: 7,
      silent: true,
      animation: true,
      animationDuration: 0,
      animationDurationUpdate: 150,
      animationEasingUpdate: "cubicOut",
    },
  ]
}

function ReactanceChart({ tour }: { tour: TourStep<Curve> | null }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left - LEFT) / (box.width - LEFT - MARGIN.right)
    setHover(S_MIN + Math.min(1, Math.max(0, x)) * (S_MAX - S_MIN))
  }
  // While the tour runs, it moves the cursor; the pointer takes over again when it ends.
  const showTip = tour ? tour.at != null : hover != null
  const dim = (curve: Curve) => (tour?.focus && tour.focus !== curve ? 0.2 : 1)
  const s = Math.min(S_MAX, Math.max(S_MIN + 1, useEased(tour ? (tour.at ?? FR) : (hover ?? FR), !tour && hover != null)))
  const up = xc(s)
  const down = xl(s)
  const gap = up - down
  const tuned = Math.abs(s - FR) < 1.5
  const band = bandAt(s)
  const near = bandAt(FR)
  const v = tuned ? [near.outperformShort, near.underperformShort].find(onMessage) ?? near.outperformShort : s < FR ? band.outperformShort : band.underperformShort
  const tone = tuned ? "bg-white text-pax2-blue ring-1 ring-foreground/10" : s < FR ? "bg-pax2-blue text-white" : "bg-pax2-red text-white"
  const x = (s - S_MIN) / (S_MAX - S_MIN)

  // The chart: drawn once with what never moves, then patched by series id as the cursor moves.
  const el = React.useRef<HTMLDivElement>(null)
  const chart = React.useRef<echarts.ECharts | null>(null)
  React.useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: "canvas" })
    c.setOption(baseOption())
    chart.current = c
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])
  const dimXc = dim("xc")
  const dimXl = dim("xl")
  React.useEffect(() => {
    chart.current?.setOption({ series: liveSeries(s, up, down, tuned, dimXc, dimXl) })
  }, [s, up, down, tuned, dimXc, dimXl])

  return (
    <div onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => setHover(null)} className="relative size-full cursor-crosshair touch-pan-y select-none [&_*:focus]:outline-none">
      <div className="pointer-events-none absolute right-4 top-1 z-10 font-mono text-xs tabular-nums text-slate-900">
        {Math.round(s)}s · <span className="text-pax2-blue">{up.toFixed(1)}% outperform 3×</span> · <span className="text-pax2-red">{down.toFixed(1)}% underperform ½×</span>
      </div>
      {/* The gap, in points, beside the black bar's middle; opposite the tooltip's side. */}
      {!tuned && (
        <div
          className="pointer-events-none absolute z-10 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white shadow-e1"
          style={{
            background: INK,
            left: `calc(${LEFT}px + ${x} * (100% - ${LEFT + MARGIN.right}px))`,
            top: `calc(${MARGIN.top}px + ${1 - (up + down) / 2 / Y_TOP} * (100% - ${MARGIN.top + BOTTOM}px))`,
            transform: `translate(${x > 0.7 ? "10px" : "calc(-100% - 10px)"}, -50%)`,
          }}
        >
          {gap >= 0 ? "+" : "−"}
          {Math.abs(gap).toFixed(1)} pts
        </div>
      )}
      {showTip && v && <VideoTip v={v} tone={tone} x={x} y={Math.min(tuned ? AT_FR : Math.max(up, down), Y_TOP) / Y_TOP} flip={x > 0.7} />}
      <div ref={el} className="size-full" />
    </div>
  )
}

export function ResonanceBlocks() {
  const [step, setStep] = React.useState<number | null>(null)
  return (
    <ChartBlock title="Resonant Frequency" height="auto" className="lift" rows={BINS.map((b) => ({ from: b.from, to: b.to, shorts: b.n, outperform: b.within.outperform, outperformFit: +xc(b.mid).toFixed(2), underperform: b.within.underperform, underperformFit: +xl(b.mid).toFixed(2) }))} name="resonant-frequency" actions={<TourButton on={step != null} onClick={() => setStep(step == null ? 0 : null)} />}>
      {/* 1130 × 545 at full width; it keeps that shape as it narrows. */}
      <div className="relative aspect-[1130/545] min-h-64 w-full">
        <ReactanceChart tour={step == null ? null : TOUR[step]} />
        {/* Bottom right, under the blue curve, which stays above 13% there. */}
        {step != null && <TourCard steps={TOUR} step={step} onStep={setStep} className="bottom-14 top-auto" />}
      </div>
    </ChartBlock>
  )
}
