"use client"

import * as React from "react"

// The video page's radar: reference rings at 25, 50 (the channel's middle, dashed) and 75, a dot at
// each axis's tip, and each axis's name and values in a tooltip on hover instead of crowding the chart.
// On load the shapes sweep in around the circle, a hand turning like a clock's.

export type RadarAxis = { key: string; label: string }
export type RadarShape = { name: string; values: Record<string, number>; stroke: string; fill: string; dashed?: boolean }

const C = 120
const R = 100
const SWEEP_MS = 1200

const polar = (i: number, n: number, r: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const
}
const ring = (n: number, r: number) => Array.from({ length: n }, (_, i) => polar(i, n, r).join(",")).join(" ")

/** The wedge from twelve o'clock clockwise through `t` of the turn. */
function wedge(t: number) {
  if (t >= 1) return `M${C - 150},${C - 150}h300v300h-300z`
  const a = -Math.PI / 2 + t * 2 * Math.PI
  const big = t > 0.5 ? 1 : 0
  return `M${C},${C} L${C},${C - 150} A150,150 0 ${big} 1 ${C + 150 * Math.cos(a)},${C + 150 * Math.sin(a)} Z`
}

/** The hover target for axis i: the sector halfway to each neighbor. */
function sector(i: number, n: number) {
  const step = (2 * Math.PI) / n
  const a0 = -Math.PI / 2 + (i - 0.5) * step
  const a1 = a0 + step
  const r = R + 14
  return `M${C},${C} L${C + r * Math.cos(a0)},${C + r * Math.sin(a0)} A${r},${r} 0 0 1 ${C + r * Math.cos(a1)},${C + r * Math.sin(a1)} Z`
}

export function Radar({ axes, shapes, label, size = 300 }: { axes: RadarAxis[]; shapes: RadarShape[]; label: string; size?: number }) {
  const n = axes.length
  const mask = React.useId().replace(/:/g, "")
  const [t, setT] = React.useState(0)
  const [hot, setHot] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setT(1)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / SWEEP_MS)
      setT(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const hand = -Math.PI / 2 + t * 2 * Math.PI
  const tip = hot != null ? polar(hot, n, R) : null

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: size }} onMouseLeave={() => setHot(null)}>
      <svg viewBox="0 0 240 240" className="h-auto w-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <mask id={mask}>
            <path d={wedge(t)} fill="#fff" />
          </mask>
        </defs>
        {[25, 50, 75, 100].map((p) => (
          <polygon key={p} points={ring(n, (R * p) / 100)} fill="none" stroke={p === 50 ? "#94a3b8" : "#e2e8f0"} strokeDasharray={p === 50 ? "3 3" : undefined} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = polar(i, n, R)
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={hot === i ? "#64748b" : "#e2e8f0"} />
        })}
        <g mask={`url(#${mask})`}>
          {shapes.map((s) => (
            <polygon key={s.name} points={axes.map((a, i) => polar(i, n, (R * Math.max(2, s.values[a.key] ?? 50)) / 100).join(",")).join(" ")} fill={s.fill} stroke={s.stroke} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
          ))}
        </g>
        {t < 1 && <line x1={C} y1={C} x2={C + R * Math.cos(hand)} y2={C + R * Math.sin(hand)} stroke="#1e3a8a" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />}
        {axes.map((a, i) => {
          const [x, y] = polar(i, n, R)
          return <circle key={a.key} cx={x} cy={y} r={hot === i ? 4 : 3} fill={hot === i ? "#1e3a8a" : "#cbd5e1"} />
        })}
        {axes.map((a, i) => (
          <path key={a.key} d={sector(i, n)} fill="transparent" onMouseEnter={() => setHot(i)} className="cursor-default">
            <title>{a.label}</title>
          </path>
        ))}
      </svg>
      {hot != null && tip && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-foreground px-3 py-1.5 text-xs leading-snug text-background shadow-md"
          style={{ left: `${(tip[0] / 240) * 100}%`, top: `${(tip[1] / 240) * 100}%` }}
        >
          <p className="font-semibold">{axes[hot].label}</p>
          {shapes.map((s) => (
            <p key={s.name} className="tabular">
              {s.name}: {s.values[axes[hot].key] ?? "—"}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
