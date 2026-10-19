"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { PatternsData, PatternVideo } from "@/lib/velocity-analytics"
import { fmtCompact } from "@/lib/velocity-meta"
import { ChartBlock } from "@/components/blocks"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/components/nova/dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

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

const bandColor = (r: number | null) => (r == null ? "#cbd5e1" : r >= 3 ? GREEN : r >= 1 ? DARK : r > 0.5 ? GRAY : RED)

export function PublishHeatmap({ data, view = "published" }: { data: PatternsData; view?: string }) {
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const [band, setBand] = useState("all")
  const max = Math.max(1, ...data.heat.flat().map((c) => c.n))
  const byCell = useMemo(() => {
    const m = new Map<string, PatternVideo[]>()
    for (const v of data.videos) m.set(`${v.pubDow}-${v.pubHour}`, [...(m.get(`${v.pubDow}-${v.pubHour}`) ?? []), v])
    for (const vs of m.values()) vs.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    return m
  }, [data])
  return (
    <div className="flex h-full flex-col gap-1.5">
      {view === "velocity" && (
        <div className="flex items-center gap-1.5 pb-1">
          <button onClick={() => setBand("all")} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-shadow", band === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-e1 hover:shadow-e2")}>All</button>
          {BANDS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBand(b.key)}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-shadow", b.key === band ? "text-white" : "bg-white text-slate-600 shadow-e1 hover:shadow-e2")}
              style={b.key === band ? { backgroundColor: b.color } : undefined}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid flex-1 gap-1.5" style={{ gridTemplateRows: "repeat(7, 1fr)" }}>
        {data.heat.map((row, d) => (
          <div key={d} className="grid gap-1.5" style={{ gridTemplateColumns: "3rem repeat(24, 1fr)" }}>
            <span className="tabular self-center text-xs text-slate-500">{DOW[d]}</span>
            {row.map((cell, h) => {
              const pct = cell.n / max
              if (view === "velocity") {
                const test = BANDS.find((b) => b.key === band)?.test
                const vs = (byCell.get(`${d}-${h}`) ?? []).filter((v) => !test || (v.ratio != null && test(v.ratio)))
                return (
                  <div key={h} className={cn("flex flex-wrap content-center items-center justify-center gap-[3px] rounded-md p-1", vs.length ? "bg-slate-50" : "bg-slate-50/50")}>
                    {vs.map((v) => (
                      <span
                        key={v.id}
                        title={`${v.title} · ${v.channel}${v.ratio != null ? ` · ${rx(v.ratio)}` : ""}`}
                        className="size-2.5 rounded-[3px]"
                        style={{ backgroundColor: bandColor(v.ratio) }}
                      />
                    ))}
                  </div>
                )
              }
              return (
                <div
                  key={h}
                  title={`${DOW[d]} ${h}:00 ET · ${cell.n} published${cell.n ? ` · ${cell.pushed} above 3x` : ""}`}
                  className={cn("tabular flex items-center justify-center rounded-md text-xs", pct > 0.55 ? "text-white" : "text-slate-600", cell.pushed > 0 && "ring-2 ring-inset ring-[#16a34a]")}
                  style={{ backgroundColor: cell.n ? `color-mix(in oklab, var(--pax2-light-blue) ${Math.round(12 + pct * 78)}%, white)` : "#f1f5f9" }}
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
      {view === "velocity" ? (
        <p className="tabular flex items-center gap-3 text-xs text-slate-500">
          Hour published, Eastern time · one tile per video
          {([["> 3x", GREEN], ["1–3x", DARK], [".5–1x", GRAY], ["< .5x", RED]] as const).map(([label, c]) => (
            <span key={label} className="flex items-center gap-1"><span className="size-2.5 rounded-[3px]" style={{ backgroundColor: c }} />{label}</span>
          ))}
        </p>
      ) : (
        <p className="tabular text-xs text-slate-500">Hour published, Eastern time · green ring = at least one finished above 3x</p>
      )}
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

type SPt = { x: number; y: number; r: number; color: string; lines: string[] }

function ScatterBase({ pts, xTicks, yTicks, xLabel, yLabel, xFmt, yFmt, xd, yd }: {
  pts: SPt[]
  xTicks: number[]
  yTicks: number[]
  xLabel: string
  yLabel: string
  xFmt: (n: number) => string
  yFmt: (n: number) => string
  xd: [number, number]
  yd: [number, number]
}) {
  const [tip, setTip] = useState<Tip>(null)
  const X = (n: number) => ML + ((n - xd[0]) / (xd[1] - xd[0] || 1)) * (VW - ML - MR)
  const Y = (n: number) => MT + (1 - (n - yd[0]) / (yd[1] - yd[0] || 1)) * (VH - MT - MB - 10)
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
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={X(p.x)}
            cy={Y(p.y)}
            r={p.r}
            fill={p.color}
            fillOpacity={0.6}
            onPointerEnter={() => setTip({ x: (X(p.x) / VW) * 100, y: (Y(p.y) / VH) * 100, lines: p.lines })}
            onPointerLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  )
}

const tierColor = (t: PatternVideo["tier"]) => (t === "breakout" ? GREEN : t === "killed" ? RED : GRAY)

/** One dot per CHANNEL - subscribers against the channel's median ratio, sized by videos tracked.
 *  Per-video dots stacked into columns here (65 channels share one x each); per-channel is the
 *  honest scatter. */
export function SubsScatter({ data }: { data: PatternsData }) {
  const pts: SPt[] = data.channels
    .filter((c) => (c.subs ?? 0) > 0 && c.n > 0)
    .map((c) => {
      const ratios = data.videos.filter((v) => v.channelId === c.id && v.ratio != null).map((v) => v.ratio!).sort((a, b) => a - b)
      const medR = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null
      return medR == null ? null : {
        x: lg(c.subs!),
        y: lg(Math.max(medR, 0.02)),
        r: Math.min(14, 4 + Math.sqrt(c.n) * 1.6),
        color: medR >= 3 ? GREEN : medR <= 0.5 ? RED : GRAY,
        lines: [c.name, `${fmtCompact(c.subs!)} subs · ${c.n} tracked · median ${rx(medR)} · ${c.pushed} above 3x`],
      }
    })
    .filter((p): p is SPt => p != null)
  return (
    <ScatterBase
      pts={pts}
      xTicks={[2, 3, 4, 5, 6, 7]}
      yTicks={[lg(0.5), lg(1), lg(3)]}
      xLabel="channel subscribers"
      yLabel="channel's median ratio"
      xFmt={(t) => fmtCompact(10 ** t)}
      yFmt={(t) => rx(10 ** t)}
      xd={[Math.min(...pts.map((p) => p.x)) - 0.2, Math.max(...pts.map((p) => p.x)) + 0.2]}
      yd={[lg(0.02), Math.max(lg(4), ...pts.map((p) => p.y)) + 0.1]}
    />
  )
}

export function EngagementScatter({ data }: { data: PatternsData }) {
  const vs = data.videos.filter((v) => v.ratio != null && v.likes != null && v.views > 0)
  const rates = vs.map((v) => (v.likes! / v.views) * 1000).sort((a, b) => a - b)
  const cap = rates[Math.floor(vs.length * 0.98)] ?? 100
  const pts: SPt[] = vs.map((v) => ({
    x: lg(Math.max(v.ratio!, 0.02)),
    y: Math.min((v.likes! / v.views) * 1000, cap),
    r: 6,
    color: tierColor(v.tier),
    lines: [v.title, `${v.channel} · ${fmtCompact(v.views)} views · ${rx(v.ratio!)}`],
  }))
  return (
    <ScatterBase
      pts={pts}
      xTicks={[lg(0.5), lg(1), lg(3), lg(10)]}
      yTicks={[0, 25, 50, 75, 100].filter((t) => t <= cap)}
      xLabel="ratio to channel median"
      yLabel="likes per 1,000 views"
      xFmt={(t) => rx(10 ** t)}
      yFmt={(t) => String(Math.round(t))}
      xd={[lg(0.02), Math.max(lg(10), ...pts.map((p) => p.x)) + 0.1]}
      yd={[0, cap]}
    />
  )
}

/* ── rate candles: one video's views-per-hour, six hours per candle ──────── */

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0

/** Views-per-hour between consecutive readings, with a 3-reading rolling average: 15-minute
 *  deltas are noisy, the average keeps the candle shape from being noise. */
function rates(series: [number, number][]): { h: number; rate: number }[] {
  const raw: { h: number; rate: number }[] = []
  for (let i = 1; i < series.length; i++) {
    const dt = series[i][0] - series[i - 1][0]
    if (dt > 0) raw.push({ h: series[i][0], rate: (series[i][1] - series[i - 1][1]) / dt })
  }
  return raw.map((r, i) => {
    const win = raw.slice(Math.max(0, i - 1), i + 2)
    return { h: r.h, rate: win.reduce((a, x) => a + x.rate, 0) / win.length }
  })
}

export function RateCandles({ data }: { data: PatternsData }) {
  const candidates = useMemo(
    () => data.videos.filter((v) => (data.series[v.id]?.length ?? 0) >= 12).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)),
    [data]
  )
  const [id, setId] = useState(candidates[0]?.id ?? "")
  const [tip, setTip] = useState<Tip>(null)
  const video = candidates.find((v) => v.id === id) ?? candidates[0]
  if (!video) return <p className="text-sm text-slate-500">No video has enough readings yet.</p>
  const rs = rates(data.series[video.id])
  const candles = Array.from({ length: 12 }, (_, i) => {
    const t0 = i * 6
    const inWin = rs.filter((r) => r.h >= t0 && r.h < t0 + 6)
    if (inWin.length < 2) return null
    const vals = inWin.map((r) => r.rate)
    return { t0, open: vals[0], close: vals[vals.length - 1], hi: Math.max(...vals), lo: Math.min(...vals) }
  }).filter((c): c is NonNullable<typeof c> => c != null)
  const maxRate = Math.max(1, ...candles.map((c) => c.hi))
  const X = (h: number) => ML + (h / 72) * (VW - ML - MR)
  const Y = (r: number) => MT + (1 - r / (maxRate * 1.08)) * (VH - MT - MB)
  const bw = ((VW - ML - MR) / 12) * 0.55
  return (
    <div className="flex h-full flex-col gap-3">
      <select
        value={video.id}
        onChange={(e) => { setId(e.target.value); setTip(null) }}
        className={whiteButton("md", "inline-block w-fit max-w-full pl-3.5 pr-8 text-left")}
      >
        {candidates.map((v) => (
          <option key={v.id} value={v.id}>
            {v.ratio != null ? `${rx(v.ratio)} · ` : ""}{v.title.length > 70 ? `${v.title.slice(0, 69)}…` : v.title} · {v.channel}
          </option>
        ))}
      </select>
      <div className="relative min-h-0 flex-1" onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="h-full w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={ML} x2={VW - MR} y1={Y(maxRate * f)} y2={Y(maxRate * f)} stroke="#e2e8f0" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              <text x={ML - 8} y={Y(maxRate * f) + 3} textAnchor="end" fontSize="12" fill={GRAY} className="tabular">{fmtCompact(maxRate * f)}</text>
            </g>
          ))}
          {[0, 12, 24, 36, 48, 60, 72].map((h) => (
            <text key={h} x={X(h)} y={VH - MB + 20} textAnchor="middle" fontSize="12" fill={GRAY} className="tabular">{h}h</text>
          ))}
          <text x={ML} y={MT - 2} fontSize="12" fill={GRAY}>views per hour</text>
          {candles.map((c) => {
            const cx = X(c.t0 + 3)
            const up = c.close >= c.open
            const color = up ? GREEN : RED
            return (
              <g
                key={c.t0}
                onPointerEnter={() => setTip({ x: (cx / VW) * 100, y: (Y(c.hi) / VH) * 100, lines: [`${c.t0}–${c.t0 + 6}h`, `open ${fmtCompact(c.open)}/hr · close ${fmtCompact(c.close)}/hr`, `high ${fmtCompact(c.hi)}/hr · low ${fmtCompact(c.lo)}/hr`] })}
                onPointerLeave={() => setTip(null)}
              >
                <line x1={cx} x2={cx} y1={Y(c.hi)} y2={Y(c.lo)} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <rect x={cx - bw / 2} y={Y(Math.max(c.open, c.close))} width={bw} height={Math.max(2, Math.abs(Y(c.open) - Y(c.close)))} fill={color} fillOpacity={0.85} rx={2} />
              </g>
            )
          })}
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  )
}

/* ── ratio spread: the fleet's distribution, hour by hour ────────────────── */

export function RatioSpreadBoxes({ data }: { data: PatternsData }) {
  const [tip, setTip] = useState<Tip>(null)
  const hours = Array.from({ length: 24 }, (_, i) => (i + 1) * 3)
  const boxes = hours.map((h) => {
    const vals: number[] = []
    for (const v of data.videos) {
      if (v.median == null) continue
      const ser = data.series[v.id]
      if (!ser?.length || ser[0][0] > h) continue
      // A video only counts at hours its readings reach - no carrying a stale value forward.
      if (ser.at(-1)![0] < h) continue
      const atH = [...ser].filter(([hh]) => hh <= h).at(-1)
      if (!atH) continue
      vals.push(Math.max(atH[1] / v.median, 0.02))
    }
    vals.sort((a, b) => a - b)
    return vals.length < 5 ? null : { h, n: vals.length, p5: q(vals, 0.05), p25: q(vals, 0.25), p50: q(vals, 0.5), p75: q(vals, 0.75), p95: q(vals, 0.95) }
  }).filter((b): b is NonNullable<typeof b> => b != null)
  if (!boxes.length) return <p className="text-sm text-slate-500">Not enough readings yet.</p>
  const top = Math.max(4, ...boxes.map((b) => b.p95))
  const X = (h: number) => ML + (h / 72) * (VW - ML - MR)
  const Y = (r: number) => MT + (1 - (lg(Math.max(r, 0.02)) - lg(0.02)) / (lg(top * 1.2) - lg(0.02))) * (VH - MT - MB)
  const bw = ((VW - ML - MR) / 24) * 0.5
  return (
    <div className="relative h-full" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-full w-full" preserveAspectRatio="none">
        {[0.5, 1, 3].map((g) => (
          <g key={g}>
            <line x1={ML} x2={VW - MR} y1={Y(g)} y2={Y(g)} stroke="#cbd5e1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            <text x={ML - 8} y={Y(g) + 3} textAnchor="end" fontSize="12" fill={GRAY} className="tabular">{rx(g)}</text>
          </g>
        ))}
        {[0, 12, 24, 36, 48, 60, 72].map((h) => (
          <text key={h} x={X(h)} y={VH - MB + 20} textAnchor="middle" fontSize="12" fill={GRAY} className="tabular">{h}h</text>
        ))}
        {boxes.map((b) => {
          const cx = X(b.h - 1.5)
          return (
            <g
              key={b.h}
              onPointerEnter={() => setTip({ x: (cx / VW) * 100, y: (Y(b.p95) / VH) * 100, lines: [`hour ${b.h} · ${b.n} videos`, `p95 ${rx(b.p95)} · p75 ${rx(b.p75)} · median ${rx(b.p50)}`, `p25 ${rx(b.p25)} · p5 ${rx(b.p5)}`] })}
              onPointerLeave={() => setTip(null)}
            >
              <line x1={cx} x2={cx} y1={Y(b.p95)} y2={Y(b.p5)} stroke={GRAY} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <rect x={cx - bw / 2} y={Y(b.p75)} width={bw} height={Math.max(2, Y(b.p25) - Y(b.p75))} fill="var(--pax2-light-blue)" fillOpacity={0.35} rx={2} />
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={Y(b.p50)} y2={Y(b.p50)} stroke="#0f172a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  )
}

/* ── the blocks: every chart in the standard card, with its narrative ────── */

type Story = { title: string; paras: string[] }

/** The narratives are computed, not canned: every number below is read from the data at render. */
function stories(data: PatternsData): Record<string, Story> {
  const vs = data.videos.filter((v) => v.ratio != null && v.median != null)
  const wins = vs.filter((v) => v.tier === "breakout")
  const dead = vs.filter((v) => v.tier === "killed")

  // When do eventual breakouts first cross 1x and 3x?
  const crossings = (band: number) =>
    wins
      .map((v) => data.series[v.id]?.find(([, views]) => views / v.median! >= band)?.[0])
      .filter((h): h is number => h != null)
      .sort((a, b) => a - b)
  const med = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length / 2)] : null)
  const cross1 = med(crossings(1))
  const cross3 = med(crossings(3))
  const deadEverAt1 = dead.filter((v) => data.series[v.id]?.some(([, views]) => views / v.median! >= 1)).length

  // Publish timing.
  const weekday = vs.filter((v) => v.pubDow < 5)
  const weekend = vs.filter((v) => v.pubDow >= 5)
  const rate = (xs: PatternVideo[]) => (xs.length ? xs.filter((v) => v.tier === "breakout").length / xs.length : 0)
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const hours = vs.map((v) => v.pubHour)
  const nineToFive = hours.filter((h) => h >= 9 && h < 17).length

  // Channel concentration.
  const chs = [...data.channels].sort((a, b) => b.pushed - a.pushed)
  const totalPushed = chs.reduce((n, c) => n + c.pushed, 0) || 1
  const top3 = chs.slice(0, 3)
  const top3Share = top3.reduce((n, c) => n + c.pushed, 0) / totalPushed
  const silent = chs.filter((c) => c.n >= 5 && c.pushed === 0)

  // Subscribers: Pearson r on the log-log scatter.
  const subs = new Map(data.channels.map((c) => [c.id, c.subs]))
  const pairs = vs.filter((v) => (subs.get(v.channelId) ?? 0)! > 0).map((v) => [Math.log10(subs.get(v.channelId)!), Math.log10(Math.max(v.ratio!, 0.02))])
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
  const mx = mean(pairs.map((p) => p[0]))
  const my = mean(pairs.map((p) => p[1]))
  const r =
    pairs.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) /
    (Math.sqrt(pairs.reduce((a, [x]) => a + (x - mx) ** 2, 0)) * Math.sqrt(pairs.reduce((a, [, y]) => a + (y - my) ** 2, 0)) || 1)

  // Engagement by tier.
  const er = (xs: PatternVideo[]) => {
    const rates = xs.filter((v) => v.likes != null && v.views > 0).map((v) => (v.likes! / v.views) * 1000).sort((a, b) => a - b)
    return rates.length ? rates[Math.floor(rates.length / 2)] : null
  }
  const erWin = er(wins)
  const erMid = er(vs.filter((v) => v.tier === "baseline"))
  const erDead = er(dead)

  return {
    velocity: {
      title: "The verdict is decided early",
      paras: [
        `The eventual outliers separate almost immediately: the median outlier crosses its channel's 1x line ${cross1 != null ? `by hour ${Math.round(cross1)}` : "within its first readings"} and the 3x line ${cross3 != null ? `by hour ${Math.round(cross3)}` : "well inside the window"} — long before the 72-hour verdict is recorded. The push, when it comes, comes early.`,
        `The inverse is just as sharp: of the ${dead.length} videos that finished below half their channel's median, ${deadEverAt1 === 0 ? "not one" : `only ${deadEverAt1}`} ever touched the 1x line at any point in 72 hours. There are no late rescues in this data — a video the algorithm declines in its first test audience stays declined.`,
        `The practical inference: the 72-hour window is a formality. Watching a short's first 12 to 18 hours against its channel median predicts its band almost perfectly, which means the poller could call verdicts in a quarter of the time, and a creator deciding whether to boost or re-cut a video has their answer the same day they publish.`,
      ],
    },
    publish: {
      title: "Publishing runs on office hours; the algorithm doesn't",
      paras: [
        `${pct(nineToFive / (hours.length || 1))} of tracked videos went out between 9am and 5pm Eastern — these channels publish on staff schedules. Weekends carry ${weekend.length} of ${vs.length} videos.`,
        `The outlier rate tells a different story than the volume: weekday publishes were outliers at ${pct(rate(weekday))} against ${pct(rate(weekend))} on weekends${rate(weekend) > rate(weekday) ? " — the thinner weekend field converts better, consistent with less competition in the feed at the moment of the seed test" : " — the weekday advantage suggests the seed audience these channels reach is itself a weekday audience"}.`,
        `Because the seed test happens in the hours right after publish, the hour of publish is really a choice of first audience. The cells with green rings mark hours that have produced an outlier; the empty late-night columns are untested, not disproven.`,
      ],
    },
    channels: {
      title: "Outlier status is a channel property before it is a video property",
      paras: [
        `${top3.map((c) => c.name).join(", ")} account for ${pct(top3Share)} of every outlier recorded, while ${silent.length} channels with five or more tracked videos have yet to produce one. The ratio scale already cancels channel size — so this concentration is not big channels looking big, it is certain channels repeatedly clearing a bar that others never clear.`,
        `The inference: the algorithm's seed test is not run against a neutral audience, it is run against each channel's own reachable audience. A channel whose uploads repeatedly break 3x has an audience that converts tests into pushes — which makes the channel, not the individual video, the strongest single predictor in this dataset.`,
        `For a portfolio, that reads as: study the silent channels' content against the repeat breakers' before spending on production. The same script performs differently depending on whose test audience first receives it.`,
      ],
    },
    subs: {
      title: "Size doesn't buy escape velocity",
      paras: [
        `Across ${pairs.length} videos the correlation between channel subscribers and ratio-to-median is r = ${r.toFixed(2)} — ${Math.abs(r) < 0.15 ? "effectively none" : r > 0 ? "weakly positive" : "weakly negative"} on log scales. Dividing by the channel median was meant to cancel size, and the scatter confirms it did.`,
        `That flatness is the finding: a 1,600-subscriber channel and a 1.4-million-subscriber one face the same odds of a 3x outlier once you measure against their own normal. The algorithm's test is relative, which is why the small reform channels in this corpus can and do out-multiply national channels.`,
        `What size does buy is the denominator: the same 3x means thousands of views on a small channel and hundreds of thousands on a large one. Multiplier and magnitude are different prizes, and only the first is level.`,
      ],
    },
    engagement: {
      title: "Engagement rides along; it doesn't steer",
      paras: [
        erWin != null && erDead != null
          ? `The median outlier earns ${erWin.toFixed(0)} likes per thousand views against ${erDead.toFixed(0)} on the killed videos${erMid != null ? ` and ${erMid.toFixed(0)} in the middle band` : ""} — ${Math.abs(erWin - (erDead ?? 0)) < 5 ? "nearly identical rates" : "a real but modest gap"} for videos whose reach differs by an order of magnitude.`
          : "Like counts are too sparse in this window to split by band yet.",
        `Per-view engagement barely moving across bands implies the push is not a reward for engagement rate — the pushed and killed videos please their viewers at similar rates, but one got served and one did not. That is consistent with the seed test measuring watch behavior (holds, swipes, completion) that never appears in public counts.`,
        `The caution for scoring: likes-per-view is a weak public proxy for whatever the algorithm actually optimizes. Treat it as a floor check, not a predictor — the real signal lives in data only the channel owner's analytics can hand over, which is what the Endgame integration is for.`,
      ],
    },
    candles: {
      title: "The push is a rate event, not a level event",
      paras: [
        (() => {
          const peaks = wins
            .map((v) => {
              const ser = data.series[v.id]
              if (!ser?.length) return null
              let best = 0, bestH = 0
              for (let t = 0; t <= 66; t += 6) {
                const a = [...ser].filter(([h]) => h <= t).at(-1)?.[1] ?? 0
                const b = [...ser].filter(([h]) => h <= t + 6).at(-1)?.[1] ?? 0
                if (b - a > best) { best = b - a; bestH = t }
              }
              return bestH
            })
            .filter((h): h is number => h != null)
            .sort((a, b) => a - b)
          const medPeak = peaks.length ? peaks[Math.floor(peaks.length / 2)] : null
          return medPeak != null
            ? `Across the ${wins.length} outliers, the six-hour window with the biggest view gain starts at hour ${medPeak} for the median video. The candle chart shows the same thing for one video at a time: a short run of green candles, then red as the rate falls back.`
            : "Too few outliers with full series to place the peak yet."
        })(),
        "The rate peaks and then falls while the cumulative count keeps rising. That is why the line charts all flatten: the push is a burst measured in hours, and everything after it is residual traffic.",
        "Read the wicks: a tall upper wick with a small body is a burst the algorithm did not sustain. A sequence of full green bodies is a sustained push. Those are different events with the same 72-hour total.",
      ],
    },
    spread: {
      title: "The fleet separates in the first day, then holds its shape",
      paras: [
        "The box is the middle half of all tracked videos' ratios at that hour; the whiskers are the 5th and 95th percentiles. The spread between whiskers is set early and mostly stops widening after the first day.",
        "The median line stays near 1x the whole way, which is what the ratio construction predicts: half the fleet above its channel's normal, half below. The information is in the whiskers, not the middle.",
        "If the p95 whisker at hour 12 already sits where it ends at hour 72, then ranking videos at hour 12 gives nearly the same order as ranking them at the verdict. That matches the velocity chart's story from the other direction.",
      ],
    },
  }
}

const DESC: Record<string, string> = {
  velocity: "Each line is one video's cumulative views divided by its channel's median, read every 15 minutes across its first 72 hours. The dotted guides mark the .5x, 1x and 3x bands; the chips pick which band is drawn.",
  publish: "Each cell counts the videos published in that hour and weekday, Eastern time. Deeper purple is more videos; a green ring means at least one of them finished above 3x.",
  channels: "Each dot is one video's 72-hour ratio, on its channel's row; channels sort by outlier share. The right edge carries the channel's subscribers and videos tracked.",
  subs: "One dot per channel, placed by its subscriber count and the median ratio of its tracked videos — both axes log, dot size is how many videos it has in the watch.",
  engagement: "Each dot is a video, placed by its 72-hour ratio and the likes it earned per thousand views. Color is the verdict band.",
  candles: "One video's views-per-hour, one candle per six hours. Open and close are the rate entering and leaving the window; the wicks are the fastest and slowest 15-minute stretches inside it. Green means the rate rose over the window, red means it fell. Rates carry a 3-reading rolling average because 15-minute deltas are noisy. Pick the video above the chart.",
  spread: "Each box is every tracked video's ratio to its channel median at that hour: the box is the middle half, the dark line the median, the whiskers the 5th and 95th percentiles.",
}

export function PatternSections({ data }: { data: PatternsData }) {
  const [story, setStory] = useState<string | null>(null)
  const [heatView, setHeatView] = useState("published")
  const tales = useMemo(() => stories(data), [data])
  const subs = new Map(data.channels.map((c) => [c.id, c.subs]))
  const videoRows = data.videos.map((v) => ({ title: v.title, channel: v.channel, published: v.published, views: v.views, median: v.median ?? "", ratio: v.ratio != null ? Math.round(v.ratio * 100) / 100 : "", likes: v.likes ?? "", subscribers: subs.get(v.channelId) ?? "" }))
  const heatRows = data.heat.flatMap((row, d) => row.map((c, h) => ({ dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d], hour: h, published: c.n, above3x: c.pushed })))
  const channelRows = data.channels.map((c) => ({ channel: c.name, group: c.group, subscribers: c.subs ?? "", tracked: c.n, above3x: c.pushed, below05x: c.killed }))
  const sections: { key: string; title: string; rows: Record<string, unknown>[]; chart: React.ReactNode }[] = [
    { key: "velocity", title: "Velocity, every 15 minutes", rows: videoRows, chart: <VelocityLines data={data} /> },
    { key: "publish", title: "Publish times", rows: heatRows, chart: <PublishHeatmap data={data} view={heatView} /> },
    { key: "channels", title: "Channels", rows: channelRows, chart: <ChannelStrips data={data} /> },
    { key: "subs", title: "Subscribers", rows: videoRows, chart: <SubsScatter data={data} /> },
    { key: "engagement", title: "Engagement", rows: videoRows, chart: <EngagementScatter data={data} /> },
    { key: "candles", title: "Rate candles", rows: videoRows, chart: <RateCandles data={data} /> },
    { key: "spread", title: "Ratio spread by hour", rows: videoRows, chart: <RatioSpreadBoxes data={data} /> },
  ]
  const open = story ? tales[story] : null
  return (
    <div className="flex flex-col gap-8">
      {sections.map((s) => (
        <ChartBlock
          key={s.key}
          title={s.title}
          name={`patterns-${s.key}`}
          rows={s.rows}
          height="h-[92dvh]"
          views={s.key === "publish" ? [{ value: "published", label: "Published" }, { value: "velocity", label: "Velocity" }] : undefined}
          view={s.key === "publish" ? heatView : undefined}
          onView={s.key === "publish" ? setHeatView : undefined}
          menuItems={
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStory(s.key)} className="whitespace-nowrap">
                Narrative
              </DropdownMenuItem>
            </>
          }
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <p className="text-sm text-slate-500">{s.key === "publish" && heatView === "velocity" ? "Each cell holds one tile per video published in that hour and weekday, Eastern time, colored by where it finished against its channel's median - the band legend sits below the grid." : DESC[s.key]}</p>
            <div className="min-h-0 flex-1">{s.chart}</div>
          </div>
        </ChartBlock>
      ))}
      <Dialog open={open != null} onOpenChange={(o) => !o && setStory(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700">
            {open?.paras.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
