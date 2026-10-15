"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { PatternsData, PatternVideo } from "@/lib/velocity-analytics"
import { fmtCompact } from "@/lib/velocity-meta"
import { cn } from "@/ui/lib/utils"

// The /patterns charts: every reading the poller has taken, drawn full-viewport. All scales
// that span orders of magnitude are log; ratio guides sit at .5x, 1x and 3x everywhere so the
// bands read the same from chart to chart.

const GREEN = "#16a34a"
const RED = "#dc2626"
const DARK = "#475569"
const GRAY = "#94a3b8"

const rx = (r: number) => `${(r >= 10 ? r.toFixed(0) : r.toFixed(1)).replace(/^0\./, ".")}x`
const lg = Math.log10

type Tip = { x: number; y: number; lines: string[] } | null

function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div
      className="tabular pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-e2 ring-1 ring-slate-200"
      style={{ left: `${Math.min(86, Math.max(14, tip.x))}%`, top: `${Math.max(2, tip.y - 8)}%` }}
    >
      {tip.lines.map((l, i) => (
        <p key={i} className={i === 0 ? "font-medium text-slate-900" : ""}>{l}</p>
      ))}
    </div>
  )
}

/* ── 1 · velocity, every 15 minutes ──────────────────────────────────────── */

const BANDS = [
  { key: "breakout", label: "> 3x", test: (r: number) => r >= 3, color: GREEN },
  { key: "mid", label: "1–3x", test: (r: number) => r >= 1 && r < 3, color: DARK },
  { key: "low", label: ".5–1x", test: (r: number) => r > 0.5 && r < 1, color: GRAY },
  { key: "killed", label: "< .5x", test: (r: number) => r <= 0.5, color: RED },
] as const

const VW = 1280
const VH = 640
const ML = 56
const MR = 24
const MT = 16
const MB = 36

export function VelocityLines({ data }: { data: PatternsData }) {
  const router = useRouter()
  const [band, setBand] = useState<(typeof BANDS)[number]["key"]>("breakout")
  const [tip, setTip] = useState<Tip>(null)
  const [hot, setHot] = useState<string | null>(null)

  const withRatio = useMemo(() => data.videos.filter((v) => v.median != null && v.ratio != null && data.series[v.id]?.length > 1), [data])
  const active = BANDS.find((b) => b.key === band)!
  const shown = useMemo(() => withRatio.filter((v) => active.test(v.ratio!)), [withRatio, active])
  const maxR = useMemo(() => Math.max(4, ...withRatio.map((v) => v.ratio!)), [withRatio])
  const dom: [number, number] = [lg(0.02), lg(maxR * 1.2)]
  const X = (h: number) => ML + (h / 72) * (VW - ML - MR)
  const Y = (r: number) => MT + (1 - (lg(Math.max(r, 0.02)) - dom[0]) / (dom[1] - dom[0])) * (VH - MT - MB)

  const lines = useMemo(
    () =>
      shown.map((v) => ({
        v,
        pts: data.series[v.id].map(([h, views]) => ({ h, views, x: X(h), y: Y(views / v.median!) })),
      })),
    [shown, data.series] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const readings = lines.reduce((n, l) => n + l.pts.length, 0)

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * VW
    const my = ((e.clientY - rect.top) / rect.height) * VH
    let best: { d: number; l: (typeof lines)[number]; p: (typeof lines)[number]["pts"][number] } | null = null
    for (const l of lines)
      for (const p of l.pts) {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2
        if (!best || d < best.d) best = { d, l, p }
      }
    if (!best || best.d > 40 ** 2) {
      setHot(null)
      setTip(null)
      return
    }
    setHot(best.l.v.id)
    setTip({
      x: (best.p.x / VW) * 100,
      y: (best.p.y / VH) * 100,
      lines: [best.l.v.title, `${best.l.v.channel}`, `${Math.floor(best.p.h)}h · ${fmtCompact(best.p.views)} views · ${rx(best.p.views / best.l.v.median!)}`],
    })
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          {BANDS.map((b) => (
            <button
              key={b.key}
              onClick={() => { setBand(b.key); setHot(null); setTip(null) }}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-shadow", b.key === band ? "text-white" : "bg-white text-slate-600 shadow-e1 hover:shadow-e2")}
              style={b.key === band ? { backgroundColor: b.color } : undefined}
            >
              {b.label}
            </button>
          ))}
        </span>
        <span className="tabular text-sm text-slate-500">{shown.length} videos · {readings.toLocaleString()} readings</span>
      </div>
      <div className="relative min-h-0 flex-1" onPointerLeave={() => { setHot(null); setTip(null) }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="h-full w-full" preserveAspectRatio="none" onPointerMove={move} onClick={() => hot && router.push(`/v/yt-${hot}`)}>
          {[0.5, 1, 3].map((g) => (
            <g key={g}>
              <line x1={ML} x2={VW - MR} y1={Y(g)} y2={Y(g)} stroke="#cbd5e1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              <text x={ML - 8} y={Y(g) + 3} textAnchor="end" fontSize="12" fill={GRAY} className="tabular">{rx(g)}</text>
            </g>
          ))}
          {[10, 30].filter((g) => g < maxR * 1.2).map((g) => (
            <text key={g} x={ML - 8} y={Y(g) + 3} textAnchor="end" fontSize="12" fill="#cbd5e1" className="tabular">{g}x</text>
          ))}
          {[0, 12, 24, 36, 48, 60, 72].map((h) => (
            <g key={h}>
              <line x1={X(h)} x2={X(h)} y1={VH - MB} y2={VH - MB + 5} stroke="#cbd5e1" vectorEffect="non-scaling-stroke" />
              <text x={X(h)} y={VH - MB + 20} textAnchor="middle" fontSize="12" fill={GRAY} className="tabular">{h}h</text>
            </g>
          ))}
          {lines.map(({ v, pts }) => (
            <polyline
              key={v.id}
              points={pts.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" ")}
              fill="none"
              stroke={active.color}
              strokeWidth={hot === v.id ? 2.5 : 1.3}
              strokeOpacity={hot == null ? 0.55 : hot === v.id ? 1 : 0.12}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  )
}

/* ── 2 · when videos are published, Eastern time ─────────────────────────── */

export function PublishHeatmap({ data }: { data: PatternsData }) {
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const max = Math.max(1, ...data.heat.flat().map((c) => c.n))
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid flex-1 gap-1.5" style={{ gridTemplateRows: "repeat(7, 1fr)" }}>
        {data.heat.map((row, d) => (
          <div key={d} className="grid gap-1.5" style={{ gridTemplateColumns: "3rem repeat(24, 1fr)" }}>
            <span className="tabular self-center text-xs text-slate-500">{DOW[d]}</span>
            {row.map((cell, h) => {
              const pct = cell.n / max
              return (
                <div
                  key={h}
                  title={`${DOW[d]} ${h}:00 ET · ${cell.n} published${cell.n ? ` · ${cell.pushed} above 3x` : ""}`}
                  className={cn("tabular flex items-center justify-center rounded-md text-xs", pct > 0.55 ? "text-white" : "text-slate-600", cell.pushed > 0 && "ring-2 ring-inset ring-[#16a34a]")}
                  style={{ backgroundColor: cell.n ? `color-mix(in oklab, var(--hermes-plum) ${Math.round(12 + pct * 78)}%, white)` : "#f1f5f9" }}
                >
                  {cell.n || ""}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 pl-12" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="tabular text-center text-[11px] text-slate-400">{h % 3 === 0 ? `${h}` : ""}</span>
        ))}
      </div>
      <p className="tabular text-xs text-slate-500">Hour published, Eastern time · green ring = at least one finished above 3x</p>
    </div>
  )
}

/* ── 3 · every video's ratio, channel by channel ─────────────────────────── */

export function ChannelStrips({ data }: { data: PatternsData }) {
  const [tip, setTip] = useState<Tip>(null)
  const chs = useMemo(() => [...data.channels].sort((a, b) => b.pushed / b.n - a.pushed / a.n || b.n - a.n), [data])
  const ROW = 26
  const H = chs.length * ROW + 50
  const W = 1280
  const L = 230
  const R = 90
  const maxR = Math.max(4, ...data.videos.filter((v) => v.ratio != null).map((v) => v.ratio!))
  const X = (r: number) => L + ((lg(Math.max(r, 0.02)) - lg(0.02)) / (lg(maxR * 1.2) - lg(0.02))) * (W - L - R)
  const color = (t: PatternVideo["tier"]) => (t === "breakout" ? GREEN : t === "killed" ? RED : GRAY)
  return (
    <div className="relative h-full overflow-y-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: H / 1.6 }}>
        {[0.5, 1, 3].map((g) => (
          <g key={g}>
            <line x1={X(g)} x2={X(g)} y1={28} y2={H - 16} stroke="#e2e8f0" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            <text x={X(g)} y={18} textAnchor="middle" fontSize="12" fill={GRAY} className="tabular">{rx(g)}</text>
          </g>
        ))}
        {chs.map((c, i) => {
          const y = 40 + i * ROW
          const vs = data.videos.filter((v) => v.channelId === c.id && v.ratio != null)
          return (
            <g key={c.id}>
              <text x={L - 12} y={y + 4} textAnchor="end" fontSize="12.5" fill="#0f172a">{c.name.length > 26 ? `${c.name.slice(0, 25)}…` : c.name}</text>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="#f1f5f9" vectorEffect="non-scaling-stroke" />
              {vs.map((v) => (
                <circle
                  key={v.id}
                  cx={X(v.ratio!)}
                  cy={y}
                  r={5}
                  fill={color(v.tier)}
                  fillOpacity={0.75}
                  onPointerEnter={() => setTip({ x: (X(v.ratio!) / W) * 100, y: (y / H) * 100, lines: [v.title, `${c.name} · ${fmtCompact(v.views)} views · ${rx(v.ratio!)}`] })}
                  onPointerLeave={() => setTip(null)}
                />
              ))}
              <text x={W - R + 10} y={y + 4} fontSize="11.5" fill={GRAY} className="tabular">{c.subs != null ? fmtCompact(c.subs) : "-"} · {c.n}</text>
            </g>
          )
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  )
}

/* ── 4 + 5 · scatters: subscribers vs reach, engagement vs reach ─────────── */

function Scatter({ videos, x, y, xTicks, yTicks, xLabel, yLabel, xFmt, yFmt }: {
  videos: PatternVideo[]
  x: (v: PatternVideo) => number
  y: (v: PatternVideo) => number
  xTicks: number[]
  yTicks: number[]
  xLabel: string
  yLabel: string
  xFmt: (n: number) => string
  yFmt: (n: number) => string
}) {
  const [tip, setTip] = useState<Tip>(null)
  const xs = videos.map(x)
  const ys = videos.map(y)
  const xd: [number, number] = [Math.min(...xs), Math.max(...xs)]
  const yd: [number, number] = [Math.min(...ys), Math.max(...ys)]
  const X = (n: number) => ML + ((n - xd[0]) / (xd[1] - xd[0] || 1)) * (VW - ML - MR)
  const Y = (n: number) => MT + (1 - (n - yd[0]) / (yd[1] - yd[0] || 1)) * (VH - MT - MB - 10)
  const color = (t: PatternVideo["tier"]) => (t === "breakout" ? GREEN : t === "killed" ? RED : GRAY)
  return (
    <div className="relative h-full" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-full w-full" preserveAspectRatio="none">
        {yTicks.filter((t) => t >= yd[0] && t <= yd[1]).map((t) => (
          <g key={`y${t}`}>
            <line x1={ML} x2={VW - MR} y1={Y(t)} y2={Y(t)} stroke="#e2e8f0" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            <text x={ML - 8} y={Y(t) + 3} textAnchor="end" fontSize="12" fill={GRAY} className="tabular">{yFmt(t)}</text>
          </g>
        ))}
        {xTicks.filter((t) => t >= xd[0] && t <= xd[1]).map((t) => (
          <text key={`x${t}`} x={X(t)} y={VH - MB + 20} textAnchor="middle" fontSize="12" fill={GRAY} className="tabular">{xFmt(t)}</text>
        ))}
        <text x={VW - MR} y={VH - 4} textAnchor="end" fontSize="12" fill={GRAY}>{xLabel}</text>
        <text x={ML} y={MT - 2} fontSize="12" fill={GRAY}>{yLabel}</text>
        {videos.map((v) => (
          <circle
            key={v.id}
            cx={X(x(v))}
            cy={Y(y(v))}
            r={6}
            fill={color(v.tier)}
            fillOpacity={0.6}
            onPointerEnter={() => setTip({ x: (X(x(v)) / VW) * 100, y: (Y(y(v)) / VH) * 100, lines: [v.title, `${v.channel} · ${fmtCompact(v.views)} views${v.ratio != null ? ` · ${rx(v.ratio)}` : ""}`] })}
            onPointerLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  )
}

export function SubsScatter({ data }: { data: PatternsData }) {
  const subs = new Map(data.channels.map((c) => [c.id, c.subs]))
  const vs = data.videos.filter((v) => v.ratio != null && (subs.get(v.channelId) ?? null) != null && subs.get(v.channelId)! > 0)
  return (
    <Scatter
      videos={vs}
      x={(v) => lg(subs.get(v.channelId)!)}
      y={(v) => lg(Math.max(v.ratio!, 0.02))}
      xTicks={[2, 3, 4, 5, 6, 7]}
      yTicks={[lg(0.5), lg(1), lg(3), lg(10)]}
      xLabel="channel subscribers"
      yLabel="ratio to channel median"
      xFmt={(t) => fmtCompact(10 ** t)}
      yFmt={(t) => rx(10 ** t)}
    />
  )
}

export function EngagementScatter({ data }: { data: PatternsData }) {
  const vs = data.videos.filter((v) => v.ratio != null && v.likes != null && v.views > 0)
  const rate = (v: PatternVideo) => (v.likes! / v.views) * 1000
  const cap = [...vs.map(rate)].sort((a, b) => a - b)[Math.floor(vs.length * 0.98)] ?? 100
  return (
    <Scatter
      videos={vs}
      x={(v) => lg(Math.max(v.ratio!, 0.02))}
      y={(v) => Math.min(rate(v), cap)}
      xTicks={[lg(0.5), lg(1), lg(3), lg(10)]}
      yTicks={[0, 25, 50, 75, 100].filter((t) => t <= cap)}
      xLabel="ratio to channel median"
      yLabel="likes per 1,000 views"
      xFmt={(t) => rx(10 ** t)}
      yFmt={(t) => String(Math.round(t))}
    />
  )
}
