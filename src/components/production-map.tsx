"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Database } from "lucide-react"

import { Group } from "@/components/pipeline-flow"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/nova/tooltip"
import { cn } from "@/ui/lib/utils"

// The production map in /pipeline's card dress: what writes (left), where it lands (middle), what
// reads it (right). Every connector carries a label (the S3 prefix or table it writes or reads);
// connectors are measured from the cards, so they follow any card that opens or closes. A planned
// card and its connector draw dashed.

export type MapNode = { id: string; title: string; count: number | string; planned?: boolean; edge: string; body: React.ReactNode }
type Pt = { x: number; y: number }
type Path = { d: string; label: string; at: Pt; anchor: "start" | "end"; planned: boolean }

export function ProductionMap({ left, right, mid }: { left: MapNode[]; right: MapNode[]; mid: { title: string; body: React.ReactNode } }) {
  const box = React.useRef<HTMLDivElement>(null)
  const lefts = React.useRef<(HTMLButtonElement | null)[]>([])
  const rights = React.useRef<(HTMLButtonElement | null)[]>([])
  const head = React.useRef<HTMLElement>(null)
  const [paths, setPaths] = React.useState<Path[]>([])
  const [tall, setTall] = React.useState(false)

  const draw = React.useCallback(() => {
    const c = box.current?.getBoundingClientRect()
    const m = head.current?.getBoundingClientRect()
    if (!c || !m) return
    const at = (r: DOMRect, side: "l" | "r"): Pt => ({ x: (side === "r" ? r.right : r.left) - c.left, y: r.top + r.height / 2 - c.top })
    const into = at(m, "l")
    const out = at(m, "r")
    const r = 8
    const elbow = (a: Pt, b: Pt, jx: number) => {
      if (Math.abs(a.y - b.y) < 1) return `M${a.x},${a.y} L${b.x - 6},${b.y}`
      const dir = b.y > a.y ? 1 : -1
      const rr = Math.min(r, Math.abs(a.y - b.y) / 2)
      return `M${a.x},${a.y} L${jx - rr},${a.y} Q${jx},${a.y} ${jx},${a.y + dir * rr} L${jx},${b.y - dir * rr} Q${jx},${b.y} ${jx + rr},${b.y} L${b.x - 6},${b.y}`
    }
    const ps: Path[] = []
    left.forEach((n, i) => {
      const el = lefts.current[i]
      if (!el) return
      const a = at(el.getBoundingClientRect(), "r")
      a.x += 5
      // Converging lines: the label rides at the source end, where each line is still its own.
      ps.push({ d: elbow(a, into, (a.x + into.x) / 2), label: n.edge, at: { x: a.x + 6, y: a.y - 6 }, anchor: "start", planned: !!n.planned })
    })
    right.forEach((n, i) => {
      const el = rights.current[i]
      if (!el) return
      const b = at(el.getBoundingClientRect(), "l")
      b.x -= 5
      const o = { ...out, x: out.x + 5 }
      // Diverging lines: the label rides at the target end.
      ps.push({ d: elbow(o, b, (o.x + b.x) / 2), label: n.edge, at: { x: b.x - 10, y: b.y - 6 }, anchor: "end", planned: !!n.planned })
    })
    setPaths(ps)
  }, [left, right])

  React.useLayoutEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (box.current) {
      ro.observe(box.current)
      box.current.querySelectorAll("[data-node]").forEach((n) => ro.observe(n))
    }
    return () => ro.disconnect()
  }, [draw])

  return (
    <div className="relative">
      <div className={cn("overflow-x-auto px-4 py-12 transition-[max-height] duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tall ? "max-h-[3000px]" : "max-h-[560px]")}>
        <div ref={box} className="relative mx-auto flex w-max items-start gap-40">
          <ul data-node className="flex w-[280px] flex-col gap-3">
            {left.map((n, i) => (
              <li key={n.id}>
                <Group title={n.title} count={n.count} planned={n.planned} headRef={(el) => (lefts.current[i] = el)}>
                  {n.body}
                </Group>
              </li>
            ))}
          </ul>

          <div data-node className="w-[300px] rounded-xl border border-slate-200 bg-white/60 p-1">
            <div className="relative rounded-lg bg-white shadow-lg shadow-black/[0.07] ring-1 ring-slate-200">
              <header ref={head} className="flex h-10 items-center gap-1.5 px-2.5">
                <Database className="size-4 text-slate-700" />
                <p className="truncate font-medium text-slate-900">{mid.title}</p>
              </header>
              <div className="divide-y divide-slate-200 overflow-hidden rounded-b-lg border-t border-slate-200">{mid.body}</div>
            </div>
          </div>

          <ul data-node className="flex w-[300px] flex-col gap-3">
            {right.map((n, i) => (
              <li key={n.id}>
                <Group title={n.title} count={n.count} planned={n.planned} width="w-[300px]" headRef={(el) => (rights.current[i] = el)}>
                  {n.body}
                </Group>
              </li>
            ))}
          </ul>

          <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <marker id="pax2-map-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fill-slate-400" />
              </marker>
            </defs>
            {paths.map((p, i) => (
              <g key={i}>
                <path d={p.d} fill="none" strokeWidth={2} strokeDasharray={p.planned ? "5 4" : undefined} className="stroke-slate-400" markerEnd="url(#pax2-map-arrow)" />
                <text x={p.at.x} y={p.at.y} textAnchor={p.anchor} className="fill-slate-500 font-mono text-[10px]">
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <Tooltip>
          <TooltipTrigger onClick={() => setTall(!tall)} aria-label={tall ? "Collapse diagram" : "Expand diagram"} className="flex rounded-lg px-1.5 text-slate-500 hover:bg-black/5">
            {tall ? <ChevronUp className="size-[18px]" /> : <ChevronDown className="size-[18px]" />}
          </TooltipTrigger>
          <TooltipContent className="bg-white text-slate-800 shadow-e2 ring-1 ring-slate-200 [&>:last-child]:bg-white [&>:last-child]:fill-white">{tall ? "Collapse" : "Expand"}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
