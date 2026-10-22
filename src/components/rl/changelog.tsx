"use client"

import * as React from "react"
import Link from "next/link"
import { Check, CircleCheck, CircleMinus, Copy, Loader2, Search } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// /reinforcement-learning's body: govblock's legislation changelog (apps/web/components/changelog-v2-body.tsx)
// ported 1:1 onto the learning loop. A bill's action is a learning event, the step's title is the event
// (which video, which outcome), the bill text in the titled block beneath is the belief shift (the weights
// the row touched, before and after, and the advice that changed), and the right rail jumps by day.
// Newest first; long blocks fold; twelve entries at first and twelve more each time the end is reached.

export type RLEvent = {
  n: number
  id: string
  title: string
  channel: string
  channelId: string
  family: string
  published: string
  ratio: number
  outcome: number
  arm: { topic: number; length: string; hour: string }
  predicted: [number, number]
  weights: [number, number, number][]
  advice: { topic: [number, number]; length: [string, string]; hour: [string, string] }
}
export type RLData = { replayRows: number; lastReplayed: string; features: string[]; topicNames: Record<number, string>; events: RLEvent[] }

// The reference's caps: twelve to a read, a block folds past fourteen lines or 900 characters.
const PER_READ = 12
const LONG = 14
const LONG_CHARS = 900

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(6)}`
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))

const Ctx = React.createContext<{ data: RLData; shown: RLEvent[]; query: string; setQuery: (q: string) => void; more: () => void; canLoad: boolean } | null>(null)

export function RLProvider({ data, children }: { data: RLData; children: React.ReactNode }) {
  const [query, setQuery] = React.useState("")
  const [depth, setDepth] = React.useState(PER_READ)
  const matched = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.events
    return data.events.filter((e) => [e.title, e.channel, e.family, e.id, data.topicNames[e.arm.topic] ?? "", e.arm.length, e.arm.hour].some((s) => s.toLowerCase().includes(q)))
  }, [data, query])
  const shown = query.trim() ? matched : matched.slice(0, depth)
  const canLoad = !query.trim() && depth < matched.length
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  const value = React.useMemo(() => ({ data, shown, query, setQuery, more, canLoad }), [data, shown, query, more, canLoad])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** The center container: the search under the rule, then a step per event. */
export function RLSteps() {
  const c = React.useContext(Ctx)
  if (!c) return null
  return (
    <div>
      <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-within:border-pax2-blue">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input value={c.query} onChange={(e) => c.setQuery(e.target.value)} placeholder="Search the changelog by video, channel, family, topic, length or hour…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
      </label>
      <div className="mt-8" />
      <Steps />
      <More />
    </div>
  )
}

/** The right rail: the days on the page, each jumping to its first event. */
export function RLIndex() {
  const c = React.useContext(Ctx)
  if (!c?.shown.length) return null
  const days = [...new Map(c.shown.map((e) => [dayKey(e.published), e])).values()]
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="h-6 text-xs font-medium text-slate-500">On This Page</p>
      {days.map((e) => (
        <a key={dayKey(e.published)} href={`#day-${dayKey(e.published)}`} className="text-[0.8rem] text-slate-500 transition-colors hover:text-pax2-blue">
          {fmtDate(e.published)}
        </a>
      ))}
      <More />
    </div>
  )
}

/** The end of the steps and of the index: reaching either reads twelve more. */
function More() {
  const c = React.useContext(Ctx)
  const mark = React.useRef<HTMLDivElement>(null)
  const canLoad = !!c?.canLoad
  const more = c?.more
  React.useEffect(() => {
    const el = mark.current
    if (!el || !canLoad || !more) return
    const o = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && more())
    o.observe(el)
    return () => o.disconnect()
  }, [canLoad, more])
  if (!canLoad) return null
  return (
    <div ref={mark} className="flex h-8 items-center justify-center text-slate-400">
      <Loader2 aria-label="Loading more" className="size-4 animate-spin" />
    </div>
  )
}

/** The belief shift as the block's printed text, and the lines where the advice moved. */
function printed(e: RLEvent, data: RLData) {
  const topic = (c: number) => `${c} ${data.topicNames[c] ? `(${data.topicNames[c]})` : ""}`.trim()
  const lines = [
    `event     ${e.n.toLocaleString("en-US")} of ${data.replayRows.toLocaleString("en-US")}, replay`,
    `video     ${e.id}  ${e.title}`,
    `channel   ${e.channel} · ${e.family}`,
    `arm       topic ${topic(e.arm.topic)} · length ${e.arm.length} · hour ${e.arm.hour} ET`,
    `reward    ${e.outcome} (settled ratio ${e.ratio.toFixed(2)}x; 1 at 3x or more)`,
    `belief    P(outperform 3x)  before ${e.predicted[0].toFixed(4)}  after ${e.predicted[1].toFixed(4)}`,
    "",
    `weights   ${pad("feature", 44)}${pad("before", 12)}${pad("after", 12)}change`,
    ...e.weights.map(([j, b, a]) => `          ${pad(data.features[j] ?? String(j), 44)}${pad(b.toFixed(6), 12)}${pad(a.toFixed(6), 12)}${signed(a - b)}`),
    "",
    `advice    ${pad("factor", 10)}${pad("before", 30)}after`,
  ]
  const changed = new Set<number>()
  const adv: [string, string, string][] = [
    ["topic", topic(e.advice.topic[0]), topic(e.advice.topic[1])],
    ["length", e.advice.length[0], e.advice.length[1]],
    ["hour", `${e.advice.hour[0]} ET`, `${e.advice.hour[1]} ET`],
  ]
  for (const [name, b, a] of adv) {
    lines.push(`          ${pad(name, 10)}${pad(b, 30)}${a}${a === b ? "" : "   shifted"}`)
    if (a !== b) changed.add(lines.length)
  }
  return { code: lines.join("\n"), changed }
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-pax2-blue"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function CodeLines({ code, highlighted }: { code: string; highlighted: Set<number> }) {
  return (
    <pre className="min-w-0 overflow-x-auto py-3.5 font-mono text-[12.5px] leading-6">
      <code className="grid min-w-full">
        {code.split("\n").map((line, i) => (
          <span key={i} className={cn("flex", highlighted.has(i + 1) && "relative bg-pax2-lavender/70 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-pax2-blue")}>
            <span className="sticky left-0 inline-block w-12 shrink-0 pr-4 text-right text-slate-400 select-none">{i + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre pr-4">{line || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  )
}

/** The titled block; past the fold it folds, with one Expand in the caption and a fade over the fold. */
function CodeBlock({ title, code, highlighted, icon }: { title: string; code: string; highlighted: Set<number>; icon: React.ReactNode }) {
  const long = code.split("\n").length > LONG || code.length > LONG_CHARS
  const [open, setOpen] = React.useState(false)
  return (
    <figure className="relative mt-6 mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
      <figcaption className="flex h-9 items-center gap-2 border-b border-slate-200 px-3 font-mono text-[13px] text-slate-500">
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {long && (
          <>
            <button type="button" onClick={() => setOpen((o) => !o)} className="h-7 rounded-md px-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-pax2-blue">
              {open ? "Collapse" : "Expand"}
            </button>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-200" />
          </>
        )}
        <CopyButton value={code} />
      </figcaption>
      <div className={cn("relative", long && !open && "max-h-72 overflow-hidden")}>
        <CodeLines code={code} highlighted={highlighted} />
        {long && !open && <button type="button" aria-label="Expand" onClick={() => setOpen(true)} className="absolute inset-x-0 bottom-0 h-20 cursor-pointer bg-gradient-to-b from-transparent to-slate-50" />}
      </div>
    </figure>
  )
}

/** Three ticks, opposite the title: topic, length and hour, filled where this event moved the advice. */
function ShiftMarker({ e }: { e: RLEvent }) {
  const ticks = (["topic", "length", "hour"] as const).map((k) => ({ k, moved: e.advice[k][0] !== e.advice[k][1] }))
  const moved = ticks.filter((t) => t.moved).map((t) => t.k)
  return (
    <span role="img" aria-label={moved.length ? `Advice shifted on ${moved.join(", ")}` : "No advice shifted"} className="inline-flex shrink-0 items-center gap-1">
      {ticks.map((t) => (
        <span key={t.k} title={`${t.k}${t.moved ? ": shifted" : ""}`} className="flex h-5 items-center">
          <span className={cn("h-1.5 w-5 rounded-full", t.moved ? "bg-pax2-blue" : "bg-slate-200")} />
        </span>
      ))}
    </span>
  )
}

function Steps() {
  const c = React.useContext(Ctx)!
  const { data, shown } = c
  const firstOfDay = new Set<number>()
  const seen = new Set<string>()
  for (const e of shown) if (!seen.has(dayKey(e.published))) (seen.add(dayKey(e.published)), firstOfDay.add(e.n))
  return (
    <>
      {!shown.length && <p className="py-10 text-sm text-slate-500">{c.query.trim() ? `Nothing matching “${c.query.trim()}”.` : "Nothing on file."}</p>}
      <div className="mb-12 md:ml-4 md:border-l md:border-slate-200 md:pl-8">
        {!c.query.trim() && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-400 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Epoch marker</span>
            <span>· replay ends at row {data.replayRows.toLocaleString("en-US")}, last replayed {fmtDate(data.lastReplayed)}; a client&apos;s own publishes land above it</span>
          </div>
        )}
        {shown.map((e, i) => {
          const { code, changed } = printed(e, data)
          const up = e.outcome === 1
          const Icon = up ? CircleCheck : CircleMinus
          return (
            <React.Fragment key={e.n}>
              <h3 id={firstOfDay.has(e.n) ? `day-${dayKey(e.published)}` : `event-${e.n}`} className={cn("flex scroll-mt-24 items-center justify-between gap-4 text-2xl font-semibold tracking-tight text-slate-900 md:relative", i === 0 && c.query.trim() ? "mt-0" : "mt-16")}>
                <span className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/logos/channels/${e.channelId}.jpg`} alt="" onError={(ev) => (ev.currentTarget.style.visibility = "hidden")} className="mr-2 inline-block size-9 rounded-full bg-slate-100 object-cover align-middle md:absolute md:mt-[2px] md:ml-[-56px]" />
                  <Link href={`/v/yt-${e.id}`} className="hover:text-pax2-blue">
                    {fmtDate(e.published)} · {e.title || e.id}
                  </Link>
                </span>
                <ShiftMarker e={e} />
              </h3>
              <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-700">{e.channel}</h4>
              <p className="mt-2 line-clamp-2 font-medium text-slate-800">
                Topic {data.topicNames[e.arm.topic] ?? e.arm.topic} · {e.arm.length} · {e.arm.hour} ET
              </p>
              <div role="status" className={cn("mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm", up ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-slate-300 bg-slate-100 text-slate-700")}>
                <Icon aria-label={up ? "Outperformed 3x" : "Did not reach 3x"} className="size-4 shrink-0" />
                <p className="m-0 min-w-0 font-medium">
                  {up ? "Outperformed 3x" : "Did not reach 3x"} · {e.ratio.toFixed(2)}x the channel median · {e.family} · {fmtDate(e.published)}
                </p>
              </div>
              <hr className="mt-4 border-0 border-t border-slate-200" />
              <CodeBlock title={`replay/${e.n}/${e.id}.txt`} code={code} highlighted={changed} icon={<span className="size-2 shrink-0 rounded-full bg-pax2-blue" />} />
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
