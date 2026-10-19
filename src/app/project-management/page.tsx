import { Check } from "lucide-react"

import type * as React from "react"

import { ListBlock, ProgressBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { PunchlistRows } from "@/components/punchlist"
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
  // Models carry two more columns (what it does, why it matters) and the baseline under the name.
  model: "grid-cols-[36px_minmax(200px,260px)_minmax(120px,0.8fr)_48px_72px_72px_72px_minmax(200px,1.1fr)_minmax(200px,1.1fr)_minmax(200px,1.1fr)_minmax(96px,0.4fr)]",
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

function Row({ b, n, list, rated, model, today }: { b: Item; n: number; list: Item[]; rated: boolean; model?: boolean; today: string }) {
  const done = b.progress >= 100
  const late = !done && today > b.end
  const blocks = blockedBy(list, b.id)
  const waits = [...(b.waits ?? []).map((id) => list.find((x) => x.id === id)?.name.replace(/^\d+\. /, "").replace(/^PAX2 /, "") ?? id), ...(b.waitsOn ? [b.waitsOn] : [])]
  const blocked = !done && (b.waits ?? []).some((id) => (list.find((x) => x.id === id)?.progress ?? 0) < 100) || (!done && !!b.waitsOn)
  const remaining = 100 - b.progress
  return (
    <details data-find className="group border-t border-slate-100">
      <summary className={cn("grid min-h-24 cursor-pointer list-none items-center gap-x-3 py-2 text-xs hover:bg-slate-50 [&::-webkit-details-marker]:hidden", model ? COLS.model : rated ? COLS.rated : COLS.plain)}>
        <span className="tabular text-slate-500">{n}</span>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{plainName(b.name)}</p>
          {model && b.base && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{b.base}</p>}
        </div>
        <div className={cn("h-3 overflow-hidden rounded-full", done ? "bg-green-100" : late ? "bg-red-100" : "bg-slate-100")} title={`${b.progress}%`}>
          {/* The fill grows from the left on arrival, staggered down the list (pax2.css .grow). */}
          <div className={cn("grow h-full rounded-full", done ? "bg-green-500" : late ? "bg-red-400" : "bg-pax2-light-blue")} style={{ width: `${b.progress}%`, "--i": n } as React.CSSProperties} />
        </div>
        <div className="flex items-center justify-end gap-1 tabular text-slate-700">
          {done ? <Check className="h-4 w-4 text-green-600" strokeWidth={3} aria-label="Complete" /> : `${b.progress}%`}
        </div>
        {rated && RATINGS.map((r) => <Rating key={r.key} n={b[r.key]} />)}
        {model && <p className="line-clamp-3 leading-snug text-slate-700">{b.func}</p>}
        {model && <p className="line-clamp-3 leading-snug text-slate-600">{b.value}</p>}
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

function Rows({ list, rated, model, today }: { list: Item[]; rated: boolean; model?: boolean; today: string }) {
  return (
    <div className="overflow-x-auto">
      <div className={model ? "min-w-[1280px]" : rated ? "min-w-[900px]" : "min-w-[720px]"}>
        <div className={cn("grid items-end gap-x-3 pb-1 text-[10px] uppercase tracking-wide text-slate-400", model ? COLS.model : rated ? COLS.rated : COLS.plain)}>
          <span>No.</span>
          <span>Item</span>
          <span>Progress</span>
          <span className="text-right">Done</span>
            {rated && RATINGS.map((r) => <span key={r.key} className="text-center">{r.label}</span>)}
          {model && <span>Function</span>}
          {model && <span>Value-add</span>}
          <span>Next</span>
          <span>Blocked</span>
        </div>
        {list.map((b, i) => (
          <Row key={b.id} b={b} n={i + 1} list={list} rated={rated} model={model} today={today} />
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
            <tr key={m.id} data-find className="border-t border-slate-100 align-top [&_td]:h-24 [&_td]:py-2 [&_td]:pr-4 [&_td]:leading-snug">
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

// The overnight session of October 19, 2026: what it attempted against what landed.
const PUNCHLIST: { item: string; done: boolean }[] = [
  { item: "/app/home on the ElevenLabs reference: the chat under the headline, ten create tiles, the promo carousel at the foot of the first viewport", done: true },
  { item: "The tiles' hover cells meeting edge to edge, the More menu wearing icon chips, the type at the reference's size", done: true },
  { item: "The promo slides rebuilt with layered light and grain; the pager resting as liquid dots, its chip and arrows surfacing on hover", done: true },
  { item: "The shell header's search, ⌘K from any page, and the announcement banner above it", done: true },
  { item: "Recents and Quickstarts past the fold; a quickstart stages the Studio with a voice, a bed and a look in one click", done: true },
  { item: "The Google OAuth client end to end: consent screen published to production, three redirect URIs, keys on Amplify and the dev server", done: true },
  { item: "/privacy written and shipped; its push carried the night's publish-step commits and built green", done: true },
  { item: "The PAX channel created wearing the curtain-font mark; the grant approved and its refresh token verified in SSM", done: true },
  { item: "The Voter Freedom rule folded into the spec: the back catalog scores as originals and never joins the watch list", done: true },
  { item: "/signin wearing the PAX mark in place of the parallax wordmark", done: true },
  { item: "The take panel's blocks: move arrows on every stack, the review box a true block, the header hover corrected", done: true },
  { item: "The blocks-are-blocks rule written into standing memory", done: true },
  { item: "The first video through the entire loop: a Voter Freedom-scripted proxy, scored an 11% chance of a Hit, published unlisted to the PAX channel, the poller reading it since 06:29 UTC", done: true },
  { item: "The night's interface work committed and pushed", done: true },
  { item: "The onboarding-and-channel-connect lane briefed and handed to a fresh window (docs/briefs/ONBOARDING-CHANNEL-CONNECT.md)", done: true },
  { item: "/signup still wears the old wordmark", done: false },
  { item: "The IPRoyal proxy purchase, blocked on phone verification; Webshare, which signs up by email alone, the fallback", done: false },
  { item: "The 679 catalog audio files through Whisper on the transcription box, then encoder retrain #3 behind them", done: false },
  { item: "The owner's publish banner: a block or a prompt, Brendan's call", done: false },
  { item: "The client secret file still sits in Downloads", done: false },
]

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
    // No gap of its own: each OrderedBlock's mt-5 sets the 20px rhythm, tabs to block and block to block.
    <div className="flex flex-col">
      <TabRail tabs={tabs} active={active} />
      <BlockOrder page="project-management" initial={["board", "punchlist"]}>
        {active === "requirements" && (
          <OrderedBlock id="board" label="Requirements">
          <ProgressBlock title="Requirements" search="Search requirements…" rows={rows(REQUIREMENTS)} name="requirements" height="h-[calc(100dvh-226px)]" footer={summary(REQUIREMENTS)}>
            <Rows list={REQUIREMENTS} rated={false} today={today} />
          </ProgressBlock>
          </OrderedBlock>
        )}
        {active === "models" && (
          <OrderedBlock id="board" label="Models">
          <ProgressBlock title="Models" search="Search models…" rows={rows(MODELS)} name="models" height="h-[calc(100dvh-226px)]" footer={summary(MODELS)}>
            <Rows list={MODELS} rated model today={today} />
          </ProgressBlock>
          </OrderedBlock>
        )}
        {active === "specs" && (
          <OrderedBlock id="board" label="Specs">
          <TableBlock title="Specs" search="Search specs…" rows={specsInModelOrder().map(({ name, target, loss, algorithm }, i) => ({ no: i + 1, item: name, target, loss, algorithm }))} name="model-specs" height="h-[calc(100dvh-226px)]">
            <Specs />
          </TableBlock>
          </OrderedBlock>
        )}
        <OrderedBlock id="punchlist" label="Punchlist">
        <ListBlock
          title="Punchlist"
          height="h-[calc(100dvh-226px)]"
          rows={PUNCHLIST.map((p, i) => ({ no: i + 1, item: p.item, status: p.done ? "Done" : "Open" }))}
          name="punchlist"
          footer="The overnight session, October 19, 2026"
        >
          <PunchlistRows items={PUNCHLIST} storageKey="pax2:punchlist:2026-10-19" />
        </ListBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
