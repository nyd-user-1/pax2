import Link from "next/link"
import { Check } from "lucide-react"

import { MODELS, RANGE, RANGE_DAYS, REQUIREMENTS, dayIndex, type Bar } from "@/lib/gantt"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Gantt" }

const MONTHS = [
  { label: "October", start: "2026-10-01", days: 31 },
  { label: "November", start: "2026-11-01", days: 30 },
  { label: "December", start: "2026-12-01", days: 31 },
]

const pct = (days: number) => `${(days / RANGE_DAYS) * 100}%`
const short = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })

function Row({ b, today }: { b: Bar; today: number }) {
  const left = dayIndex(b.start)
  const width = Math.max(1, dayIndex(b.end) - left + 1)
  const done = b.progress >= 100
  const late = !done && today > left + width
  return (
    <div className="grid grid-cols-[minmax(200px,260px)_1fr_56px_minmax(220px,1.2fr)] items-center gap-x-3 border-t border-slate-100 py-2 text-xs">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{b.name}</p>
        <p className="truncate text-[11px] text-slate-500">
          {short(b.start)} to {short(b.end)}
          {b.waits?.length ? ` · waits on ${b.waits.join(", ")}` : ""}
        </p>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-y-0 w-px bg-pax2-light-blue/60" style={{ left: pct(today) }} aria-hidden />
        <div
          className={cn("absolute inset-y-0.5 overflow-hidden rounded-sm", done ? "bg-green-100" : late ? "bg-red-100" : "bg-slate-100")}
          style={{ left: pct(left), width: pct(width) }}
          title={`${b.progress}%`}
        >
          <div className={cn("h-full", done ? "bg-green-500" : late ? "bg-red-400" : "bg-pax2-light-blue")} style={{ width: `${b.progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 tabular text-slate-700">
        {done ? <Check className="h-4 w-4 text-green-600" strokeWidth={3} aria-label="Complete" /> : `${b.progress}%`}
      </div>
      <p className={cn("line-clamp-2 leading-snug", done ? "text-slate-400" : "text-slate-600")}>{done ? b.note ?? "" : b.next}</p>
    </div>
  )
}

function Chart({ bars, today }: { bars: Bar[]; today: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 pb-2">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[minmax(200px,260px)_1fr_56px_minmax(220px,1.2fr)] items-end gap-x-3 pt-2 text-[10px] uppercase tracking-wide text-slate-400">
          <span>Item</span>
          <div className="relative flex h-5">
            {MONTHS.map((m) => (
              <span key={m.label} className="border-l border-slate-200 pl-1" style={{ width: pct(m.days) }}>
                {m.label}
              </span>
            ))}
          </div>
          <span className="text-right">Done</span>
          <span>Next</span>
        </div>
        {bars.map((b) => (
          <Row key={b.id} b={b} today={today} />
        ))}
      </div>
    </div>
  )
}

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  const models = view === "models"
  const bars = models ? MODELS : REQUIREMENTS
  const today = Math.min(RANGE_DAYS - 1, Math.max(0, dayIndex(new Date().toISOString().slice(0, 10))))
  const complete = bars.filter((b) => b.progress >= 100).length
  const mean = Math.round(bars.reduce((s, b) => s + b.progress, 0) / bars.length)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { href: "/gantt", label: "Requirements", on: !models },
          { href: "/gantt?view=models", label: "Models", on: models },
        ].map((t) => (
          <Link key={t.label} href={t.href} className={cn("rounded-full px-3 py-1 text-sm", t.on ? "bg-pax2-blue text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
            {t.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {complete} of {bars.length} complete · {mean}% on average · {short(RANGE.start)} to {short(RANGE.end)}
        </span>
      </div>
      <Chart bars={bars} today={today} />
    </div>
  )
}
