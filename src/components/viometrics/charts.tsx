"use client"

import * as React from "react"
import * as echarts from "echarts"

// The viometric charts on ECharts canvas: the composite timeline (every frame's scene score as a
// striation, the loudness, brightness and saturation curves, on-screen-text ticks, cuts), the
// 44-cell percentile heat bar, and the embedding's every component. Drag on the composite zooms;
// hover gets the crosshair readout. All data arrives measured from the page.

type Dense = { duration: number; scenes: [number, number][]; cuts: number[]; frames: { t: number; y: number; sat: number; words: number }[]; loudness: [number, number][] }
type SpecPoint = { band: string; key: string; raw: number | null; v: number | null }

const BAND_HUE: Record<string, number> = { Title: 243, Thumbnail: 35, Visual: 224, "On-screen text": 173, Sound: 0, Speech: 142, Judgment: 271 }
const AXIS = { axisLine: { lineStyle: { color: "#cbd5e1" } }, axisLabel: { color: "#64748b", fontSize: 11 }, splitLine: { lineStyle: { color: "#f1f5f9" } } }

function Chart({ option, height }: { option: echarts.EChartsOption; height: number }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = ref.current!
    const chart = echarts.init(el, undefined, { renderer: "canvas" })
    chart.setOption(option)
    const onResize = () => chart.resize()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      chart.dispose()
    }
  }, [option])
  return <div ref={ref} style={{ height }} className="w-full" />
}

export function CompositeChart({ d }: { d: Dense }) {
  const maxScene = Math.max(...d.scenes.map(([, s]) => s), 0.1)
  const option: echarts.EChartsOption = React.useMemo(() => ({
    animation: false,
    grid: { left: 44, right: 16, top: 28, bottom: 64 },
    tooltip: { trigger: "axis", axisPointer: { type: "cross", label: { backgroundColor: "#334155" } }, valueFormatter: (v) => (typeof v === "number" ? v.toFixed(2) : String(v)) },
    legend: { bottom: 0, icon: "roundRect", itemWidth: 14, itemHeight: 5, textStyle: { color: "#475569", fontSize: 11 } },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 26, borderColor: "#e2e8f0", fillerColor: "rgba(99,102,241,0.08)" }],
    xAxis: { type: "value", min: 0, max: Math.ceil(d.duration), name: "s", nameTextStyle: { color: "#64748b" }, ...AXIS },
    yAxis: { type: "value", min: 0, max: 1, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: AXIS.splitLine },
    series: [
      {
        name: "Visual cut energy",
        type: "bar",
        data: d.scenes.map(([t, s]) => [t, Math.sqrt(s / maxScene) * 0.78]),
        barWidth: 1,
        large: true,
        itemStyle: { color: (p) => `hsl(${300 - ((p.value as number[])[0] / d.duration) * 80} 75% 52%)`, opacity: 0.8 },
        z: 1,
      },
      {
        name: "Loudness · EBU R128",
        type: "line",
        data: d.loudness.map(([t, v]) => [t, Math.max(0, Math.min(1, (v + 40) / 30))]),
        showSymbol: false,
        lineStyle: { color: "#dc2626", width: 2 },
        itemStyle: { color: "#dc2626" },
        z: 4,
      },
      {
        name: "Brightness",
        type: "line",
        data: d.frames.map((f) => [f.t, f.y / 255]),
        showSymbol: false,
        lineStyle: { color: "#d97706", width: 1.25 },
        itemStyle: { color: "#d97706" },
        z: 3,
      },
      {
        name: "Saturation",
        type: "line",
        data: d.frames.map((f) => [f.t, f.sat / 255]),
        showSymbol: false,
        lineStyle: { color: "#059669", width: 1.25 },
        itemStyle: { color: "#059669" },
        z: 3,
      },
      {
        name: "On-screen text",
        type: "scatter",
        data: d.frames.filter((f) => f.words > 0).map((f) => [f.t, 0.97, f.words]),
        symbol: "rect",
        symbolSize: (v) => [3, Math.min(1, (v as number[])[2] / 5) * 22],
        itemStyle: { color: "#0d9488", opacity: 0.85 },
        z: 2,
      },
      {
        name: "Cuts",
        type: "scatter",
        data: d.cuts.map((t) => [t, 0]),
        symbol: "none",
        markLine: {
          symbol: "none",
          silent: true,
          label: { show: false },
          lineStyle: { color: "#94a3b8", opacity: 0.4, width: 1, type: "solid" },
          data: d.cuts.map((t) => ({ xAxis: t })),
        },
        itemStyle: { color: "#94a3b8" },
        z: 0,
      },
    ],
  }), [d, maxScene])
  return <Chart option={option} height={360} />
}

export function HeatBar({ spectrum }: { spectrum: SpecPoint[] }) {
  const option: echarts.EChartsOption = React.useMemo(() => ({
    animation: false,
    grid: { left: 44, right: 16, top: 6, bottom: 42 },
    tooltip: {
      formatter: (p) => {
        const s = spectrum[(p as { dataIndex: number }).dataIndex]
        return `<b>${s.key}</b><br/>${s.raw == null ? "not measured" : s.raw}${s.v != null ? ` · p${Math.round(s.v * 100)}` : ""}`
      },
    },
    xAxis: { type: "category", data: spectrum.map((s) => s.key), axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value", show: false, min: 0, max: 1 },
    series: [
      {
        type: "bar",
        data: spectrum.map((s) => ({
          value: 1,
          itemStyle: { color: s.v == null ? "#f1f5f9" : `hsl(${BAND_HUE[s.band] ?? 220} ${40 + s.v * 45}% ${90 - s.v * 48}%)`, borderRadius: 3 },
        })),
        barCategoryGap: "12%",
      },
    ],
    graphic: (() => {
      const bands: { band: string; from: number; to: number }[] = []
      spectrum.forEach((s, i) => {
        const last = bands[bands.length - 1]
        if (last && last.band === s.band) last.to = i
        else bands.push({ band: s.band, from: i, to: i })
      })
      const w = 1
      return bands.map((b) => ({
        type: "text",
        left: `${(44 / 1130) * 100 + (((b.from + b.to + 1) / 2 / spectrum.length) * (1 - 60 / 1130) * 100) * w}%`,
        bottom: 4,
        style: { text: b.band.toUpperCase(), fill: `hsl(${BAND_HUE[b.band]} 60% 40%)`, fontSize: 10, fontWeight: 700 },
      }))
    })(),
  }), [spectrum])
  return <Chart option={option} height={96} />
}

export function EmbeddingChart({ vector, invented }: { vector: number[] | null; invented: boolean }) {
  const option: echarts.EChartsOption | null = React.useMemo(() => {
    if (!vector) return null
    const n = vector.length
    return {
      animation: false,
      grid: { left: 44, right: 16, top: 10, bottom: 40 },
      tooltip: { trigger: "axis", valueFormatter: (v) => (typeof v === "number" ? v.toFixed(4) : String(v)) },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 14, bottom: 4, borderColor: "#e2e8f0", fillerColor: "rgba(99,102,241,0.08)" }],
      xAxis: { type: "category", data: vector.map((_, i) => String(i)), axisLabel: { ...AXIS.axisLabel, interval: 127 }, axisTick: { show: false }, axisLine: AXIS.axisLine, name: invented ? `${n} components · invented` : `${n} components`, nameLocation: "middle", nameGap: 22, nameTextStyle: { color: "#64748b", fontSize: 11 } },
      yAxis: { type: "value", axisLabel: AXIS.axisLabel, splitLine: AXIS.splitLine },
      series: [
        {
          type: "bar",
          data: vector.map((v, i) => ({ value: v, itemStyle: { color: `hsl(${(i / n) * 300} 80% 48%)` } })),
          barCategoryGap: "8%",
          large: true,
        },
      ],
    }
  }, [vector, invented])
  if (!option) return <p className="flex h-24 items-center justify-center text-sm text-slate-400">The content vector computes on the embed run; this chart fills when it lands.</p>
  return <Chart option={option} height={210} />
}
