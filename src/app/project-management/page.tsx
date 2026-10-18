import { Check } from "lucide-react"

import { ProgressBlock } from "@/components/blocks"
import { MODELS, REQUIREMENTS, blockedBy, type Item } from "@/lib/project-management"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Project Management" }

const short = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })
const RATINGS: { key: "importance" | "utility" | "ease"; label: string }[] = [
  { key: "importance", label: "Importance" },
  { key: "utility", label: "Utility" },
  { key: "ease", label: "Ease" },
]
const COLS = {
  plain: "grid-cols-[minmax(200px,260px)_minmax(160px,1fr)_48px_minmax(220px,1.4fr)]",
  rated: "grid-cols-[minmax(200px,260px)_minmax(160px,1fr)_48px_72px_72px_72px_minmax(220px,1.4fr)]",
}

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

const Tag = ({ children, tone }: { children: React.ReactNode; tone: "block" | "wait" }) => (
  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", tone === "block" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-600")}>{children}</span>
)

function Row({ b, list, rated, today }: { b: Item; list: Item[]; rated: boolean; today: string }) {
  const done = b.progress >= 100
  const late = !done && today > b.end
  const blocks = blockedBy(list, b.id)
  const waits = [...(b.waits ?? []).map((id) => list.find((x) => x.id === id)?.name.replace(/^\d+\. /, "").replace(/^PAX2 /, "") ?? id), ...(b.waitsOn ? [b.waitsOn] : [])]
  const remaining = 100 - b.progress
  return (
    <details data-find className="group border-t border-slate-100">
      <summary className={cn("grid cursor-pointer list-none items-center gap-x-3 py-2 text-xs hover:bg-slate-50 [&::-webkit-details-marker]:hidden", rated ? COLS.rated : COLS.plain)}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
            <span className="truncate">{b.name}</span>
            {blocks.length > 0 && <Tag tone="block">Blocks {blocks.join(", ")}</Tag>}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {short(b.start)} to {short(b.end)}
            {waits.length > 0 && <> · waits on {waits.join(", ")}</>}
          </p>
        </div>
        <div className={cn("h-3 overflow-hidden rounded-full", done ? "bg-green-100" : late ? "bg-red-100" : "bg-slate-100")} title={`${b.progress}%`}>
          <div className={cn("h-full rounded-full", done ? "bg-green-500" : late ? "bg-red-400" : "bg-pax2-light-blue")} style={{ width: `${b.progress}%` }} />
        </div>
        <div className="flex items-center justify-end gap-1 tabular text-slate-700">
          {done ? <Check className="h-4 w-4 text-green-600" strokeWidth={3} aria-label="Complete" /> : `${b.progress}%`}
        </div>
        {rated && RATINGS.map((r) => <Rating key={r.key} n={b[r.key]} />)}
        <p className={cn("line-clamp-2 leading-snug", done ? "text-slate-400" : "text-slate-600")}>{done ? (b.note ?? "") : b.next}</p>
      </summary>
      {b.steps.length > 0 && (
        <div className="mb-2 ml-2 rounded-md bg-slate-50 px-3 py-2 text-xs">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Of the {remaining}% that remains</p>
          <ol className="space-y-1">
            {b.steps.map((s, i) => (
              <li key={i} className="grid grid-cols-[40px_1fr] gap-x-2 sm:grid-cols-[40px_1fr_minmax(160px,0.5fr)]">
                <span className="tabular text-right font-medium text-slate-700">{s.share}%</span>
                <span className="text-slate-800">
                  {s.what}
                  {s.blocker && <> <Tag tone="block">Blocker</Tag></>}
                </span>
                <span className="text-slate-500 sm:text-right">{s.effort}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </details>
  )
}

function Rows({ list, rated, today }: { list: Item[]; rated: boolean; today: string }) {
  return (
    <div className="overflow-x-auto">
      <div className={rated ? "min-w-[900px]" : "min-w-[720px]"}>
        <div className={cn("grid items-end gap-x-3 pb-1 text-[10px] uppercase tracking-wide text-slate-400", rated ? COLS.rated : COLS.plain)}>
          <span>Item</span>
          <span>Progress</span>
          <span className="text-right">Done</span>
          {rated && RATINGS.map((r) => <span key={r.key} className="text-center">{r.label}</span>)}
          <span>Next</span>
        </div>
        {list.map((b) => (
          <Row key={b.id} b={b} list={list} rated={rated} today={today} />
        ))}
      </div>
    </div>
  )
}

const summary = (list: Item[]) => `${list.filter((b) => b.progress >= 100).length} of ${list.length} complete · ${Math.round(list.reduce((s, b) => s + b.progress, 0) / list.length)}% on average`

export default function ProjectManagementPage() {
  const today = new Date().toISOString().slice(0, 10)
  const rows = (list: Item[]) => list.map((b) => ({ item: b.name, progress: b.progress, start: b.start, end: b.end, next: b.next, importance: b.importance, utility: b.utility, ease: b.ease }))
  return (
    <div className="flex flex-col gap-4">
      <ProgressBlock title="Requirements" search="Search requirements…" rows={rows(REQUIREMENTS)} name="requirements" height="auto" footer={summary(REQUIREMENTS)}>
        <Rows list={REQUIREMENTS} rated={false} today={today} />
      </ProgressBlock>
      <ProgressBlock title="Models" search="Search models…" rows={rows(MODELS)} name="models" height="auto" footer={summary(MODELS)}>
        <Rows list={MODELS} rated today={today} />
      </ProgressBlock>
    </div>
  )
}
