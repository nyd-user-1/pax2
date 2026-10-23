import Link from "next/link"

import { signed, type Test } from "@/lib/trials"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

// What PAX2 reads from each tested video's YouTube upload, set beside what the trial measured: the
// validation table. Public views and the Outlier Score (views over the channel's median) measure reach;
// Resonance is the pre-release probability of outperforming 3x; the persuasion score sums the measured
// effects of the Swayable traits in the transcript. A dash marks what is not measured, with what unlocks it.
export function PredictionVsTrial({ tests }: { tests: Test[] }) {
  const rows = tests.flatMap((t) => t.arms.filter((a) => a.pax2).map((a) => ({ t, a, p: a.pax2! })))
  const dash = (why: string) => (
    <span className="text-slate-300" title={why}>
      —
    </span>
  )
  const views = rows.map((r) => r.p.views)
  const lifts = rows.map((r) => r.a.yes?.lift ?? 0)
  const scored = rows.filter((r) => r.p.persuasion != null)
  return (
    <div className="flex flex-col gap-4">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead>Video</TableHead>
            <TableHead className="text-right">Trial: ballot support</TableHead>
            <TableHead className="text-right">Trial: comprehension</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Outlier Score</TableHead>
            <TableHead className="text-right">Resonance</TableHead>
            <TableHead className="text-right">Persuasion score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ t, a, p }) => (
            <TableRow key={`${t.id}-${a.id}`}>
              <TableCell className="whitespace-normal">
                <Link href={`/v/yt-${a.youtube}`} className="font-medium text-slate-900 hover:text-pax2-blue">
                  {a.name}
                </Link>
                <span className="ml-2 text-[11px] text-slate-400">
                  {t.label} · posted {p.published.slice(5).replace("-", "/")}
                </span>
              </TableCell>
              <TableCell className={cn("tabular text-right font-semibold", a.yes?.sig ? "text-above" : "text-slate-500")}>{signed(a.yes?.lift ?? 0)} pts</TableCell>
              <TableCell className={cn("tabular text-right", a.comprehension?.sig ? "font-semibold text-above" : "text-slate-500")}>{signed(a.comprehension?.lift ?? 0)} pts</TableCell>
              <TableCell className="tabular text-right text-slate-700">{p.views.toLocaleString()}</TableCell>
              <TableCell className={cn("tabular text-right font-semibold", p.outlier >= 3 ? "text-above" : p.outlier < 1 ? "text-below" : "text-slate-700")}>{p.outlier.toFixed(2)}×</TableCell>
              <TableCell className="tabular text-right text-slate-700">{p.resonance != null ? Math.round(p.resonance) : dash("Not in the scored baseline: run the Lab on this video")}</TableCell>
              <TableCell className="tabular text-right text-slate-700" title={p.traits?.map((x) => `${x.label} ${signed(x.diff)}`).join(" · ")}>
                {p.persuasion != null ? `${signed(p.persuasion)} pts` : dash("No coded transcript: run the codebook on this video")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 1 && (
        <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
          <li>
            The trial moved Yes by {Math.min(...lifts)} to {Math.max(...lifts)} points across these {rows.length} videos; their uploads drew {Math.min(...views).toLocaleString()} to {Math.max(...views).toLocaleString()} views ({Math.round(Math.max(...views) / Math.min(...views))}×). In these videos, persuasion and reach did not move together.
          </li>
          {scored.length > 0 && (
            <li>
              The persuasion score, fitted on candidate ads, reads {scored.map((r) => `${signed(r.p.persuasion!)}`).join(" and ")} points where the trial measured {scored.map((r) => signed(r.a.yes?.lift ?? 0)).join(" and ")}. Its scale sits far below these lifts, and {scored.length} videos cannot test its order.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
