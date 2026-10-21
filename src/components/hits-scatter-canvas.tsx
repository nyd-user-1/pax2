"use client"

import * as React from "react"

import { ChartBlock } from "@/components/blocks"
import { TIER } from "@/components/hits-tier"
import type { Tier } from "@/lib/lab"

// The scatter's client half: the dots, the landing charts' video tooltip on hover (green, grey or red
// to match the dot), and the search that keeps matching dots and fades the rest.

export type ScatterPoint = { id: string; title: string; channel: string; published: string; views: number; ratio: number; tier: Tier }

const R_MIN = Math.log10(0.04)
const R_MAX = Math.log10(120)
const W = 1100
const H = 460
const L = 44
const B = 28
const y = (ratio: number) => 10 + (1 - (Math.log10(Math.max(0.04, Math.min(120, ratio))) - R_MIN) / (R_MAX - R_MIN)) * (H - B - 10)
const fmt = (r: number) => (r >= 10 ? r.toFixed(0) : r.toFixed(1))

export function ScatterCanvas({ points, query = "" }: { points: ScatterPoint[]; query?: string }) {
  const box = React.useRef<HTMLDivElement>(null)
  const [tip, setTip] = React.useState<{ p: ScatterPoint; x: number; y: number; flip: boolean } | null>(null)
  const times = points.map((v) => Date.parse(v.published))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const x = (iso: string) => L + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - L - 12)
  const start = new Date(t0)
  const ticks: string[] = []
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 6) * 6 + 6, 1)); d.getTime() <= t1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, 1))) ticks.push(d.toISOString())
  const needle = query.trim().toLowerCase()
  const hit = (p: ScatterPoint) => !needle || p.title.toLowerCase().includes(needle) || p.channel.toLowerCase().includes(needle)
  // The tooltip sits beside the dot, measured on screen, since the drawing scales to its box.
  const show = (p: ScatterPoint, el: SVGCircleElement) => {
    const b = box.current?.getBoundingClientRect()
    const c = el.getBoundingClientRect()
    if (!b) return
    const cx = c.left + c.width / 2 - b.left
    setTip({ p, x: cx, y: c.top + c.height / 2 - b.top, flip: cx > b.width * 0.7 })
  }
  return (
    <div ref={box} className="relative size-full" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Every video's views over its channel's median, by publish date">
        {[0.1, 0.5, 1, 3, 10, 100].map((g) => (
          <g key={g}>
            <line x1={L} y1={y(g)} x2={W - 12} y2={y(g)} stroke={g === 1 ? "#94a3b8" : "#cbd5e1"} strokeWidth={g === 1 ? 1.5 : 1} strokeDasharray={g === 0.5 || g === 3 ? "3 4" : g === 1 ? undefined : "1 5"} />
            <text x={L - 8} y={y(g) + 3.5} textAnchor="end" fontSize="11" fill="#64748b" className="tabular">
              {g}x
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
            {new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
          </text>
        ))}
        {points.map((v) => {
          const on = hit(v)
          return (
            <a key={v.id} href={`/v/yt-${v.id}`} aria-label={`${v.title}, ${fmt(v.ratio)}x its channel's median`}>
              <circle
                cx={x(v.published)}
                cy={y(v.ratio)}
                r={tip?.p.id === v.id ? 6.5 : 4.5}
                fill={TIER[v.tier].dot}
                fillOpacity={on ? (tip?.p.id === v.id ? 1 : 0.75) : 0.08}
                stroke={tip?.p.id === v.id ? "#fff" : "none"}
                strokeWidth={2}
                onMouseEnter={(e) => show(v, e.currentTarget)}
                className="cursor-pointer transition-[fill-opacity,r]"
              />
            </a>
          )
        })}
      </svg>
      {tip && (
        <div
          className={`pointer-events-none absolute z-10 flex w-40 flex-col gap-1 rounded-lg p-1 shadow-e3 ${TIER[tip.p.tier].tip}`}
          style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? "calc(-100% - 14px)" : "14px"}, -50%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${tip.p.id}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-md object-cover" />
          <p className="truncate px-0.5 pb-0.5 text-[11px] font-semibold leading-snug">{tip.p.title}</p>
        </div>
      )}
    </div>
  )
}

/** The Outliers block on /tracking: the scatter with its own search, which fades the dots it doesn't match. */
export function OutliersBlock({ points, rows, height }: { points: ScatterPoint[]; rows: Record<string, unknown>[]; height: string }) {
  const [q, setQ] = React.useState("")
  return (
    <ChartBlock title="Outliers" id="outliers" name="outliers" search="Search videos…" searchValue={q} onSearch={setQ} rows={rows} height={height}>
      <ScatterCanvas points={points} query={q} />
    </ChartBlock>
  )
}
