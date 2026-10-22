import { TableBlock } from "@/components/blocks"
import { accounting, asOf, type LedgerRow } from "@/lib/accounting"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

// The model ledger, promoted from the accounting page's Models tab: every fitted model, passed or
// failed, numbered continuously, read from data/generated/accounting.json at render.

function Status({ s }: { s: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", s === "Live" ? "bg-pax2-lavender text-pax2-blue" : "border border-dashed border-slate-400 text-slate-600")}>{s}</span>
}

function Ledger({ title, rows, from, last }: { title: string; rows: LedgerRow[]; from: number; last: "Status" | "Why it failed" }) {
  return (
    <TableBlock
      title={title}
      height="auto"
      search="Search models…"
      name={`models-${title.toLowerCase()}`}
      rows={rows.map((r, i) => ({ n: from + i, model: r.name, kind: r.kind, does: r.does, inputs: r.inputs, score: r.score, [last === "Status" ? "status" : "why"]: r.last }))}
      tools={<span className="ml-1 text-xs text-slate-400">as of {asOf()}</span>}
    >
      <Table className="min-w-[1080px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[4%]" />
            <TableHead className="w-[15%]">Model</TableHead>
            <TableHead className="w-[12%]">Kind</TableHead>
            <TableHead className="w-[20%]">What it does</TableHead>
            <TableHead className="w-[18%]">Inputs</TableHead>
            <TableHead className="w-[16%]">Score</TableHead>
            <TableHead className="w-[15%]">{last}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.name} data-find>
              <TableCell className="tabular align-top text-slate-400">{from + i}</TableCell>
              <TableCell className="whitespace-normal align-top font-medium text-slate-900">{r.name}</TableCell>
              <TableCell className="whitespace-normal align-top text-slate-600">{r.kind}</TableCell>
              <TableCell className="whitespace-normal align-top text-slate-700">{r.does}</TableCell>
              <TableCell className="whitespace-normal align-top text-slate-600">{r.inputs}</TableCell>
              <TableCell className="tabular whitespace-normal align-top text-slate-800">{r.score}</TableCell>
              <TableCell className="whitespace-normal align-top text-slate-700">{last === "Status" ? <Status s={r.last} /> : r.last}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableBlock>
  )
}

export function PassedModels() {
  return <Ledger title="Passed" rows={accounting.passed} from={1} last="Status" />
}

export function FailedModels() {
  return <Ledger title="Failed" rows={accounting.failed} from={accounting.passed.length + 1} last="Why it failed" />
}
