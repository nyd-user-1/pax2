"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, ChevronUp, Plus, Server } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/nova/tooltip"
import { cn } from "@/ui/lib/utils"

export type FlowStep = { id: string; name: string; service: string; makes: string; feeds: string; rate: string; done: number; spent: string }
export type FlowData = {
  videos: { id: string; title: string; label: string }[]
  uploads: number
  lastRun: string | null
  running: boolean
  steps: FlowStep[]
  total: number
  spentTotal: string
  example: string
}

// The pipeline as a diagram: what starts it (left), the box that runs the four checks (middle),
// where the results land (right). Connectors are measured from the cards, so they follow any card
// that opens or closes.

function Count({ n, on }: { n: number | string; on: boolean }) {
  return <span className={cn("ml-1 flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-xs", on ? "bg-pax-lavender text-pax-plum" : "bg-slate-100 text-slate-500")}>{n}</span>
}

function Section({ title, children, href }: { title?: string; children: React.ReactNode; href?: string }) {
  const body = (
    <section className="px-3 py-2.5">
      {title && (
        <header className="relative mb-1 flex items-center">
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          {href && <ArrowRight data-arrow className="absolute right-0 size-3.5 translate-x-1 text-slate-400 opacity-0 transition-all duration-200" />}
        </header>
      )}
      {children}
    </section>
  )
  return href ? (
    <Link href={href} className="block hover:bg-slate-50 hover:[&_[data-arrow]]:translate-x-0 hover:[&_[data-arrow]]:opacity-100">
      {body}
    </Link>
  ) : (
    body
  )
}

function Group({ title, count, open: start = false, headRef, width = "w-[280px]", children }: { title: string; count: number | string; open?: boolean; headRef: (el: HTMLButtonElement | null) => void; width?: string; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(start)
  const on = typeof count === "string" || count > 0
  return (
    <div className={cn("rounded-xl border border-black/15 bg-slate-50 p-1", open && children ? "pb-0" : "", width)}>
      <button ref={headRef} type="button" onClick={() => setOpen(!open)} className="flex h-10 w-full items-center rounded-lg bg-white px-3 font-medium text-slate-900 shadow-md shadow-black/[0.07] ring-1 ring-black/15 hover:bg-slate-50">
        {title}
        <Count n={count} on={on} />
        <ChevronDown className={cn("ml-auto size-4 text-slate-600 transition-transform", open && "rotate-180")} />
      </button>
      {open && children && <div className="-mx-1 -mb-0.5 divide-y divide-slate-200 pt-0.5">{children}</div>}
    </div>
  )
}

function Row({ left, pill }: { left: React.ReactNode; pill: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-slate-800">{left}</p>
      <div className="grow border-b border-slate-200" />
      <span className="inline-flex shrink-0 items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-500 ring-1 ring-slate-200">{pill}</span>
    </div>
  )
}

function FlowMap({ from, to, href }: { from: string; to: string; href?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] items-center gap-2 py-0.5">
      <span className="truncate text-sm text-slate-800">{from}</span>
      <ArrowRight className="size-3.5 text-slate-400" />
      {href ? (
        <Link href={href} className="truncate rounded px-1.5 py-0.5 text-right text-sm text-slate-800 underline decoration-pax-plum underline-offset-4 hover:bg-slate-100">
          {to}
        </Link>
      ) : (
        <span className="truncate px-1.5 text-right text-sm text-slate-800">{to}</span>
      )}
    </div>
  )
}

type Pt = { x: number; y: number }

export function PipelineFlow({ d }: { d: FlowData }) {
  const box = React.useRef<HTMLDivElement>(null)
  const lefts = React.useRef<(HTMLButtonElement | null)[]>([])
  const rights = React.useRef<(HTMLButtonElement | null)[]>([])
  const mid = React.useRef<HTMLElement>(null)
  const [paths, setPaths] = React.useState<string[]>([])
  const [tall, setTall] = React.useState(false)

  const draw = React.useCallback(() => {
    const c = box.current?.getBoundingClientRect()
    const m = mid.current?.getBoundingClientRect()
    if (!c || !m) return
    const at = (r: DOMRect, side: "l" | "r"): Pt => ({ x: (side === "r" ? r.right : r.left) - c.left, y: r.top + r.height / 2 - c.top })
    const into = at(m, "l")
    const out = at(m, "r")
    const r = 8
    const elbow = (a: Pt, b: Pt, jx: number) => {
      if (Math.abs(a.y - b.y) < 1) return `M${a.x},${a.y} L${b.x - 6},${b.y}`
      const dir = b.y > a.y ? 1 : -1
      return `M${a.x},${a.y} L${jx - r},${a.y} Q${jx},${a.y} ${jx},${a.y + dir * r} L${jx},${b.y - dir * r} Q${jx},${b.y} ${jx + r},${b.y} L${b.x - 6},${b.y}`
    }
    const ps: string[] = []
    for (const el of lefts.current) {
      if (!el) continue
      const a = at(el.getBoundingClientRect(), "r")
      a.x += 5
      ps.push(elbow(a, into, (a.x + into.x) / 2))
    }
    for (const el of rights.current) {
      if (!el) continue
      const b = at(el.getBoundingClientRect(), "l")
      b.x -= 5
      const o = { ...out, x: out.x + 5 }
      ps.push(elbow(o, b, (o.x + b.x) / 2))
    }
    setPaths(ps)
  }, [])

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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={cn("overflow-x-auto px-4 py-12 transition-[max-height] duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tall ? "max-h-[2000px]" : "max-h-[420px]")}>
        <div ref={box} className="relative mx-auto flex w-max items-start gap-16">
          {/* What starts a run */}
          <ul data-node className="flex w-[280px] flex-col gap-3">
            <li>
              <Group title="Rendered videos" count={d.videos.length} open headRef={(el) => (lefts.current[0] = el)}>
                <Section title="Made by">
                  <p className="text-sm text-slate-800">The render job on the worker box: Polly voices over Mixkit footage</p>
                </Section>
                <Section title="Videos">
                  <ul className="flex flex-col">
                    {d.videos.map((v) => (
                      <li key={v.id}>
                        <Link href={`/v/${v.id}`} scroll={false} className="-mx-1.5 flex justify-between gap-2 rounded px-1.5 py-0.5 text-sm hover:bg-slate-100">
                          <span className="truncate text-slate-800">{v.title}</span>
                          <span className="shrink-0 text-slate-500">{v.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              </Group>
            </li>
            <li>
              <Group title="Volunteer uploads" count={d.uploads} headRef={(el) => (lefts.current[1] = el)}>
                <Section>
                  <Row left="Starts a run" pill="Not connected yet" />
                </Section>
                <Section>
                  <Link href="/record" className="-mx-1.5 flex items-center justify-between rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-slate-100">
                    Record a video <Plus className="size-4" />
                  </Link>
                </Section>
              </Group>
            </li>
            <li>
              <Group title="Started by hand" count={d.lastRun ? 1 : 0} headRef={(el) => (lefts.current[2] = el)}>
                <Section title="Last run">
                  <p className="text-sm text-slate-800">{d.lastRun ?? "Never"}</p>
                </Section>
                <Section>
                  <p className="text-sm text-slate-500">A command sent to the worker box. Until uploads are connected, every run starts this way.</p>
                </Section>
              </Group>
            </li>
          </ul>

          {/* The box that runs the checks */}
          <div data-node className="w-[300px] rounded-xl border border-slate-200 bg-white/60 p-1">
            <div className="relative rounded-lg bg-white shadow-lg shadow-black/[0.07] ring-1 ring-slate-200">
              <header ref={mid} className="flex h-10 items-center gap-1.5 px-2.5">
                <Server className="size-4 text-slate-700" />
                <p className="truncate font-medium text-slate-900">pax-worker</p>
                <span className={cn("mr-0.5 ml-auto size-3.5 shrink-0 rounded-full border-[3px]", d.running ? "animate-pulse border-blue-100 bg-blue-500" : "border-slate-100 bg-slate-400")} title={d.running ? "Running" : "Idle"} />
              </header>
              <div className="divide-y divide-slate-200 overflow-hidden rounded-b-lg border-t border-slate-200">
                <Section title="Checks">
                  <div className="flex flex-col gap-1.5">
                    {d.steps.map((s) => (
                      <Row key={s.id} left={s.name} pill={`${s.done} of ${d.total}`} />
                    ))}
                  </div>
                </Section>
                <Section title="Box">
                  <div className="flex flex-col gap-1.5">
                    <Row left="Size" pill="t4g.large" />
                    <Row left="Stops itself" pill="after 30 idle minutes" />
                  </div>
                </Section>
              </div>
            </div>
          </div>

          {/* Where results land */}
          <ul data-node className="flex w-[340px] flex-col gap-3">
            <li>
              <Group title="Shows up in" count={d.steps.length} open width="w-[340px]" headRef={(el) => (rights.current[0] = el)}>
                <Section title="Version page">
                  {d.steps.map((s) => (
                    <FlowMap key={s.id} from={s.name} to={s.feeds} href={`/v/${d.example}`} />
                  ))}
                </Section>
              </Group>
            </li>
            <li>
              <Group title="Services" count={d.steps.length} width="w-[340px]" headRef={(el) => (rights.current[1] = el)}>
                {d.steps.map((s) => (
                  <Section key={s.id} title={s.service}>
                    <p className="text-sm text-slate-800">{s.makes}.</p>
                    <p className="mt-0.5 text-xs text-slate-500">{s.rate}</p>
                  </Section>
                ))}
              </Group>
            </li>
            <li>
              <Group title="Spent" count={d.spentTotal} width="w-[340px]" headRef={(el) => (rights.current[2] = el)}>
                <Section>
                  <div className="flex flex-col gap-1.5">
                    {d.steps.map((s) => (
                      <Row key={s.id} left={s.name} pill={s.spent} />
                    ))}
                  </div>
                </Section>
              </Group>
            </li>
          </ul>

          <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <marker id="pax-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fill-slate-400" />
              </marker>
            </defs>
            {paths.map((p, i) => (
              <path key={i} d={p} fill="none" strokeWidth={2} className="stroke-slate-400" markerEnd={i === 0 || i >= 3 ? "url(#pax-arrow)" : undefined} />
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
