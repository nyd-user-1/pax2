import { MainBlock, TableBlock } from "@/components/blocks"
import { accounting, asOf } from "@/lib/accounting"
import { BOXES } from "@/lib/production"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

// The standing programs as they are: the two windows in build (Q and P) with their briefs and
// ledger rows, the uniform baseline and what falls outside it, and every measured box run.

const REPO = "https://github.com/nyd-user-1/pax2/blob/main/"
const n = (x: number) => x.toLocaleString("en-US")

const PROGRAMS = [
  { key: "Q", ledger: "Ask-a-video (Q)", brief: "docs/briefs/WINDOW-Q.md", budget: "$5 hard cap", runs: "one spot GPU box, g6e.xlarge class" },
  { key: "P", ledger: "Planner", brief: "docs/briefs/WINDOW-P.md", budget: "$2", runs: "replay of the settled catalog; no new fetch" },
]

const OUTSIDE_LABEL = { transcript: "No transcript", media: "No media in S3", composition: "No composition", index: "Not in the serving index" } as const

export function Programs() {
  const c = accounting.counts
  const runs = BOXES.filter((b) => !b.planned).flatMap((b) => b.runs.map((r) => ({ box: b.name, ...r })))
  return (
    <>
      <MainBlock title="In build" height="auto">
        <div className="grid gap-4 md:grid-cols-2">
          {PROGRAMS.map((p) => {
            const row = accounting.passed.find((m) => m.name === p.ledger)
            return (
              <div key={p.key} className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-400 bg-white/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-pax2-lavender font-semibold text-pax2-blue">{p.key}</span>
                  <h3 className="text-sm font-semibold text-slate-900">{p.ledger}</h3>
                  <span className="ml-auto rounded-full border border-dashed border-slate-400 px-2 py-0.5 text-[11px] font-medium text-slate-500">{row?.last ?? "Staged"}, in build</span>
                </div>
                {row && <p className="text-sm text-slate-700">{row.does}</p>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">Kind</dt>
                  <dd className="text-slate-800">{row?.kind}</dd>
                  <dt className="text-slate-500">Runs on</dt>
                  <dd className="text-slate-800">{p.runs}</dd>
                  <dt className="text-slate-500">Budget</dt>
                  <dd className="text-slate-800">{p.budget}</dd>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-800">{row?.score}</dd>
                </dl>
                <a href={REPO + p.brief} target="_blank" rel="noreferrer" className="w-fit font-mono text-xs text-pax2-blue underline decoration-pax2-light-blue underline-offset-4 hover:text-pax2-light-blue">
                  {p.brief}
                </a>
              </div>
            )
          })}
        </div>
      </MainBlock>

      <MainBlock
        title="Uniform baseline"
        height="auto"
        tools={<span className="ml-1 text-xs text-slate-400">as of {asOf()}</span>}
        rows={[{ group: "Baseline", count: c.baseline }, ...Object.entries(accounting.outside).map(([k, v]) => ({ group: OUTSIDE_LABEL[k as keyof typeof OUTSIDE_LABEL], count: v }))]}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular text-3xl font-semibold text-slate-900">{n(c.baseline)}</span>
            <span className="text-sm text-slate-500">of {n(c.all)} catalog shorts hold a transcript, media in S3, composition and an index embedding</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-pax2-blue" style={{ width: `${(c.baseline / c.all) * 100}%` }} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(accounting.outside).map(([k, v]) => (
              <div key={k} className="flex flex-col rounded-xl border border-slate-200 px-3 py-2.5">
                <span className="tabular text-lg font-semibold text-slate-900">{n(v)}</span>
                <span className="text-xs text-slate-500">{OUTSIDE_LABEL[k as keyof typeof OUTSIDE_LABEL]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">{n(c.all - c.baseline)} shorts fall outside; one short can miss several pieces.</p>
        </div>
      </MainBlock>

      <TableBlock title="Box runs" height="auto" search="Search runs…" name="box-runs" rows={runs.map((r) => ({ box: r.box, run: r.run, date: r.date, did: r.did, cost: r.cost, estimate: !!r.estimate, source: r.source }))}>
        <Table className="min-w-[900px] table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-[15%]">Box</TableHead>
              <TableHead className="w-[20%]">Run</TableHead>
              <TableHead className="w-[10%]">Date</TableHead>
              <TableHead className="w-[30%]">What it did</TableHead>
              <TableHead className="w-[12%]">Cost</TableHead>
              <TableHead className="w-[13%]">Recorded in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={`${r.box}-${r.run}`} data-find>
                <TableCell className="whitespace-normal font-medium text-slate-900">{r.box}</TableCell>
                <TableCell className="whitespace-normal font-mono text-xs text-slate-600">{r.run}</TableCell>
                <TableCell className="tabular text-slate-600">{r.date}</TableCell>
                <TableCell className="whitespace-normal text-slate-700">{r.did}</TableCell>
                <TableCell className="tabular whitespace-normal text-slate-800">
                  {r.cost}
                  {r.estimate && <span className="text-slate-400"> (estimate)</span>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <a href={REPO + r.source} target="_blank" rel="noreferrer" className="font-mono text-xs text-pax2-blue underline decoration-pax2-light-blue underline-offset-4">
                    {r.source.replace(/^docs\//, "")}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableBlock>
    </>
  )
}
