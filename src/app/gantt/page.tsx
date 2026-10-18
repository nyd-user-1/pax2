import Link from "next/link"
import { Check } from "lucide-react"

import { MODELS, REQUIREMENTS, type Bar } from "@/lib/gantt"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Gantt" }

const short = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })
const RATINGS: { key: "importance" | "utility" | "ease"; label: string }[] = [
  { key: "importance", label: "Importance" },
  { key: "utility", label: "Utility" },
  { key: "ease", label: "Ease" },
]

function Rating({ n }: { n?: number }) {
  if (!n) return <span className="text-slate-300">-</span>
  return (
    <span className="flex justify-center gap-0.5" aria-label={`${n} of 5`} title={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= n ? "bg-pax2-blue" : "bg-slate-200")} />
      ))}
    </span>
  )
}

function Row({ b, cols, today, rated }: { b: Bar; cols: string; today: string; rated: boolean }) {
  const done = b.progress >= 100
  const late = !done && today > b.end
  return (
    <div className={cn("grid items-center gap-x-3 border-t border-slate-100 py-2 text-xs", cols)}>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{b.name}</p>
        <p className="truncate text-[11px] text-slate-500">
          {short(b.start)} to {short(b.end)}
          {b.waits?.length ? ` · waits on ${b.waits.join(", ")}` : ""}
        </p>
      </div>
      <div className={cn("h-3 overflow-hidden rounded-full", done ? "bg-green-100" : late ? "bg-red-100" : "bg-slate-100")} title={`${b.progress}%`}>
        <div className={cn("h-full rounded-full", done ? "bg-green-500" : late ? "bg-red-400" : "bg-pax2-light-blue")} style={{ width: `${b.progress}%` }} />
      </div>
      <div className="flex items-center justify-end gap-1 tabular text-slate-700">
        {done ? <Check className="h-4 w-4 text-green-600" strokeWidth={3} aria-label="Complete" /> : `${b.progress}%`}
      </div>
      {rated && RATINGS.map((r) => <Rating key={r.key} n={b[r.key]} />)}
      <p className={cn("line-clamp-2 leading-snug", done ? "text-slate-400" : "text-slate-600")}>{done ? b.note ?? "" : b.next}</p>
    </div>
  )
}

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  const models = view === "models"
  const bars = models ? MODELS : REQUIREMENTS
  const today = new Date().toISOString().slice(0, 10)
  const complete = bars.filter((b) => b.progress >= 100).length
  const mean = Math.round(bars.reduce((s, b) => s + b.progress, 0) / bars.length)
  const cols = models
    ? "grid-cols-[minmax(200px,260px)_minmax(160px,1fr)_48px_72px_72px_72px_minmax(220px,1.4fr)]"
    : "grid-cols-[minmax(200px,260px)_minmax(160px,1fr)_48px_minmax(220px,1.4fr)]"
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
          {complete} of {bars.length} complete · {mean}% on average
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 pb-2">
        <div className={models ? "min-w-[900px]" : "min-w-[720px]"}>
          <div className={cn("grid items-end gap-x-3 pt-2 text-[10px] uppercase tracking-wide text-slate-400", cols)}>
            <span>Item</span>
            <span>Progress</span>
            <span className="text-right">Done</span>
            {models && RATINGS.map((r) => <span key={r.key} className="text-center">{r.label}</span>)}
            <span>Next</span>
          </div>
          {bars.map((b) => (
            <Row key={b.id} b={b} cols={cols} today={today} rated={models} />
          ))}
        </div>
      </div>
    </div>
  )
}
