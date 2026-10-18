import { Check } from "lucide-react"

import { ProgressBlock, TableBlock } from "@/components/blocks"
import { TabRail } from "@/components/tab-rail"
import { MODEL_TERMS } from "@/lib/model-terms"
import { MODELS, REQUIREMENTS, blockedBy, type Item } from "@/lib/project-management"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Project Management" }

const RATINGS: { key: "importance" | "utility" | "ease"; label: string }[] = [
  { key: "importance", label: "Importance" },
  { key: "utility", label: "Utility" },
  { key: "ease", label: "Ease" },
]
const COLS = {
  plain: "grid-cols-[36px_minmax(200px,260px)_minmax(160px,1fr)_48px_minmax(220px,1.4fr)_minmax(96px,0.5fr)]",
  rated: "grid-cols-[36px_minmax(200px,260px)_minmax(160px,1fr)_48px_72px_72px_72px_minmax(220px,1.4fr)_minmax(96px,0.5fr)]",
}
const plainName = (name: string) => name.replace(/^\d+\. /, "")

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

const Tag = ({ children, tone, title }: { children: React.ReactNode; tone: "block" | "wait"; title?: string }) => (
  <span title={title} className={cn("whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-medium", tone === "block" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200")}>{children}</span>
)

function Row({ b, n, list, rated, today }: { b: Item; n: number; list: Item[]; rated: boolean; today: string }) {
  const done = b.progress >= 100
  const late = !done && today > b.end
  const blocks = blockedBy(list, b.id)
  const waits = [...(b.waits ?? []).map((id) => list.find((x) => x.id === id)?.name.replace(/^\d+\. /, "").replace(/^PAX2 /, "") ?? id), ...(b.waitsOn ? [b.waitsOn] : [])]
  const blocked = !done && (b.waits ?? []).some((id) => (list.find((x) => x.id === id)?.progress ?? 0) < 100) || (!done && !!b.waitsOn)
  const remaining = 100 - b.progress
  return (
    <details data-find className="group border-t border-slate-100">
      <summary className={cn("grid cursor-pointer list-none items-center gap-x-3 py-2 text-xs hover:bg-slate-50 [&::-webkit-details-marker]:hidden", rated ? COLS.rated : COLS.plain)}>
        <span className="tabular text-slate-500">{n}</span>
        <p className="truncate font-medium text-slate-900">{plainName(b.name)}</p>
        <div className={cn("h-3 overflow-hidden rounded-full", done ? "bg-green-100" : late ? "bg-red-100" : "bg-slate-100")} title={`${b.progress}%`}>
          <div className={cn("h-full rounded-full", done ? "bg-green-500" : late ? "bg-red-400" : "bg-pax2-light-blue")} style={{ width: `${b.progress}%` }} />
        </div>
        <div className="flex items-center justify-end gap-1 tabular text-slate-700">
          {done ? <Check className="h-4 w-4 text-green-600" strokeWidth={3} aria-label="Complete" /> : `${b.progress}%`}
        </div>
        {rated && RATINGS.map((r) => <Rating key={r.key} n={b[r.key]} />)}
        <p className={cn("line-clamp-2 leading-snug", done ? "text-slate-400" : "text-slate-600")}>{done ? (b.note ?? "") : b.next}</p>
        <div className="flex flex-wrap gap-1">
          {blocked && <Tag tone="block" title={`Waits on ${waits.join(", ")}`}>Blocked</Tag>}
          {blocks.length > 0 && <Tag tone="wait" title={`Blocks ${blocks.join(", ")}`}>Blocks {blocks.map((n) => n.replace(/ .*/, "")).join(", ")}</Tag>}
        </div>
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
          <span>No.</span>
          <span>Item</span>
          <span>Progress</span>
          <span className="text-right">Done</span>
            {rated && RATINGS.map((r) => <span key={r.key} className="text-center">{r.label}</span>)}
          <span>Next</span>
          <span>Blocked</span>
        </div>
        {list.map((b, i) => (
          <Row key={b.id} b={b} n={i + 1} list={list} rated={rated} today={today} />
        ))}
      </div>
    </div>
  )
}

/** The Specs rows in the Models tab's order, so a model carries one number on both tabs. */
const specsInModelOrder = () => MODELS.map((m) => MODEL_TERMS.find((t) => t.id === m.id)).filter((t): t is (typeof MODEL_TERMS)[number] => !!t)

/** Specs: for each model PAX2 trains or plans to train, what it predicts, the loss it minimizes and the algorithm that runs. */
function Specs() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="text-left text-[10px] uppercase tracking-wide text-slate-400">
          <tr className="[&_th]:py-1 [&_th]:pr-4 [&_th]:font-medium [&_th]:align-bottom">
            <th className="w-[36px]">No.</th>
            <th className="w-[160px]">Item</th>
            <th>Target variable and bounds</th>
            <th>Loss function</th>
            <th>Algorithm or class</th>
          </tr>
        </thead>
        <tbody>
          {specsInModelOrder().map((m, i) => (
            <tr key={m.id} data-find className="border-t border-slate-100 align-top [&_td]:py-2 [&_td]:pr-4 [&_td]:leading-snug">
              <td className="tabular text-slate-500">{i + 1}</td>
              <td className="font-medium text-slate-900">{m.name}</td>
              <td className="text-slate-700">{m.target}</td>
              <td className="text-slate-700">{m.loss}</td>
              <td className="text-slate-700">{m.algorithm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const summary = (list: Item[]) => `${list.filter((b) => b.progress >= 100).length} of ${list.length} complete · ${Math.round(list.reduce((s, b) => s + b.progress, 0) / list.length)}% on average`

const VIEWS = ["requirements", "models", "specs"] as const
type View = (typeof VIEWS)[number]

export default async function ProjectManagementPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  const active: View = VIEWS.includes(view as View) ? (view as View) : "requirements"
  const today = new Date().toISOString().slice(0, 10)
  const rows = (list: Item[]) => list.map((b, i) => ({ no: i + 1, item: plainName(b.name), progress: b.progress, start: b.start, end: b.end, next: b.next, importance: b.importance, utility: b.utility, ease: b.ease }))
  const tabs = [
    { key: "requirements", label: "Requirements", href: "/project-management", count: REQUIREMENTS.length },
    { key: "models", label: "Models", href: "/project-management?view=models", count: MODELS.length },
    { key: "specs", label: "Specs", href: "/project-management?view=specs", count: specsInModelOrder().length },
  ]
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={tabs} active={active} />
      {active === "requirements" && (
        <ProgressBlock title="Requirements" search="Search requirements…" rows={rows(REQUIREMENTS)} name="requirements" height="auto" footer={summary(REQUIREMENTS)}>
          <Rows list={REQUIREMENTS} rated={false} today={today} />
        </ProgressBlock>
      )}
      {active === "models" && (
        <ProgressBlock title="Models" search="Search models…" rows={rows(MODELS)} name="models" height="auto" footer={summary(MODELS)}>
          <Rows list={MODELS} rated today={today} />
        </ProgressBlock>
      )}
      {active === "specs" && (
        <TableBlock title="Specs" search="Search specs…" rows={specsInModelOrder().map(({ name, target, loss, algorithm }, i) => ({ no: i + 1, item: name, target, loss, algorithm }))} name="model-specs" height="auto">
          <Specs />
        </TableBlock>
      )}
    </div>
  )
}
