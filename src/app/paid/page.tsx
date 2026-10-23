import Link from "next/link"
import { redirect } from "next/navigation"

import { TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { currentUser } from "@/lib/auth"
import { ledger, pieces, rankMoves, sensitivity, singleMeasures } from "@/lib/paid-analysis"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Paid results" }

// The partner's paid export, every video scored: Paid Resonance 1 against the whole batch, and version 2,
// which also measures each video against the videos reported the same date, with starts restated at the
// batch's delivery mix. Then what the assumptions change, what the score adds beyond one plain measure, and
// which choices are design and which are learned. Entry: the Library's Paid results card.
// Paid Resonance is the paid-attention score (src/lib/resonance.ts), not the pre-release Resonance of the
// video pages.
const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
const range = (lo: number | null, hi: number | null) => (lo == null || hi == null ? "—" : `${Math.round(lo)}–${Math.round(hi)}`)

export default async function PaidPage() {
  if (!(await currentUser())) redirect("/signin?next=/paid")
  const ps = pieces().slice().sort((a, b) => (b.v1.value ?? 0) - (a.v1.value ?? 0))
  const moves = rankMoves((p) => p.v2)
  const sens = sensitivity()
  const single = singleMeasures()
  const led = ledger()
  const comp = (p: (typeof ps)[number], k: string) => p.v1.components.find((c) => c.key === k)?.score
  return (
    <BlockOrder page="paid" initial={["scores", "version2", "assumptions", "single", "ledger"]}>
      <OrderedBlock id="scores" label="Paid results">
        <TableBlock title="Paid results" search="Search videos…" rows={ps.map((p) => ({ video: p.title, youtube: p.id, reported: p.window, spend: Math.round(p.totals.spend), impressions: p.totals.impressions, starts: p.totals.starts, engage: comp(p, "stop") ?? null, interest: comp(p, "hold") ?? null, paid_resonance_1: p.v1.value, paid_resonance_2: p.v2.value, rank_move: moves[p.id] }))} name="paid-results">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Video</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Engage</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Act</TableHead>
                <TableHead className="text-right">Paid Resonance 1</TableHead>
                <TableHead className="text-right">Paid Resonance 2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ps.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/paid/${p.id}`} className="font-medium text-slate-900 hover:text-pax2-blue">
                      {p.title}
                    </Link>
                    <div className="text-[11px] text-slate-400">{p.counted.map((c) => `${c.id}${c.cut === "edit" ? " (edit)" : ""}`).join(", ")}</div>
                  </TableCell>
                  <TableCell className="tabular text-slate-600">{p.window}</TableCell>
                  <TableCell className="tabular text-right text-slate-600">{money(p.totals.spend)}</TableCell>
                  <TableCell className="tabular text-right text-slate-600">{p.totals.impressions.toLocaleString()}</TableCell>
                  <TableCell className="tabular text-right">{Math.round(comp(p, "stop") ?? 0)}</TableCell>
                  <TableCell className="tabular text-right">{Math.round(comp(p, "hold") ?? 0)}</TableCell>
                  <TableCell className="text-right text-xs text-slate-400">missing</TableCell>
                  <TableCell className="tabular text-right">
                    <span className="font-display text-lg text-pax2-blue">{Math.round(p.v1.value ?? 0)}</span> <span className="text-[11px] text-slate-400">{range(p.v1.low, p.v1.high)}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    <span className="font-semibold text-slate-800">{Math.round(p.v2.value ?? 0)}</span>{" "}
                    <span className={cn("text-[11px]", moves[p.id] > 0 ? "text-above" : moves[p.id] < 0 ? "text-below" : "text-slate-400")}>{moves[p.id] ? `${signed(moves[p.id])} rank` : "same rank"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      </OrderedBlock>

      <OrderedBlock id="version2" label="Version 2: window and delivery mix">
        <TableBlock title="Version 2: window and delivery mix" rows={ps.map((p) => ({ video: p.title, reported: p.window, window_cohort: p.cohort, observed_starts: p.observedStarts, expected_starts_at_batch_mix: Math.round(p.expectedStarts), mix_only: p.mixOnly.value, window_only: p.windowOnly.value, paid_resonance_2: p.v2.value }))} name="paid-version-2">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Video</TableHead>
                <TableHead>Reported with</TableHead>
                <TableHead className="text-right">Starts observed</TableHead>
                <TableHead className="text-right">Expected at batch mix</TableHead>
                <TableHead className="text-right">Mix only</TableHead>
                <TableHead className="text-right">Window only</TableHead>
                <TableHead className="text-right">Both (v2)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ps.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-normal font-medium text-slate-900">{p.title}</TableCell>
                  <TableCell className="tabular text-slate-600">
                    {p.window} · {p.cohort} videos{p.cohort < 6 && p.sets.length === 1 ? ` · one ad set (${p.sets[0]})` : ""}
                  </TableCell>
                  <TableCell className="tabular text-right">{p.observedStarts.toLocaleString()}</TableCell>
                  <TableCell className="tabular text-right text-slate-600">{Math.round(p.expectedStarts).toLocaleString()}</TableCell>
                  <TableCell className="tabular text-right">{Math.round(p.mixOnly.value ?? 0)}</TableCell>
                  <TableCell className="tabular text-right">{Math.round(p.windowOnly.value ?? 0)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{Math.round(p.v2.value ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      </OrderedBlock>

      <OrderedBlock id="assumptions" label="Assumptions">
        <TableBlock title="Assumptions" rows={sens.map((s) => ({ change: s.label, kind: s.kind, rank_agreement: Number(s.rho.toFixed(2)), largest_move: s.maxMove, video: s.mover?.title ?? null }))} name="paid-assumptions">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Change from version 1</TableHead>
                <TableHead className="text-right">Rank agreement</TableHead>
                <TableHead className="text-right">Largest move</TableHead>
                <TableHead>Video that moves most</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sens.map((s) => (
                <TableRow key={s.label}>
                  <TableCell className="font-medium text-slate-900">{s.label}</TableCell>
                  <TableCell className="tabular text-right">{s.rho.toFixed(2)}</TableCell>
                  <TableCell className="tabular text-right">{s.maxMove ? `${s.maxMove} ranks` : "none"}</TableCell>
                  <TableCell className="whitespace-normal text-slate-600">{s.mover ? `${s.mover.title} (${signed(s.mover.by)})` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      </OrderedBlock>

      <OrderedBlock id="single" label="Against one measure">
        <TableBlock title="Against one measure" rows={single.map((s) => ({ measure: s.label, rank_agreement: Number(s.rho.toFixed(2)), most_apart: s.gap.title, resonance_rank: s.gap.resRank, measure_rank: s.gap.measureRank }))} name="paid-single-measures">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Measure</TableHead>
                <TableHead className="text-right">Rank agreement</TableHead>
                <TableHead>Where they part most</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {single.map((s) => (
                <TableRow key={s.label}>
                  <TableCell className="font-medium text-slate-900">{s.label}</TableCell>
                  <TableCell className="tabular text-right">{s.rho.toFixed(2)}</TableCell>
                  <TableCell className="whitespace-normal text-slate-600">
                    {s.gap.title}: rank {s.gap.resRank} on Paid Resonance, {s.gap.measureRank} on this measure
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      </OrderedBlock>

      <OrderedBlock id="ledger" label="Design or learned">
        <TableBlock title="Design or learned" search="Search choices…" rows={led} name="paid-design-or-learned">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-[40%]">Choice</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {led.map((l) => (
                <TableRow key={l.what}>
                  <TableCell className="whitespace-normal font-medium text-slate-900">{l.what}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", l.kind === "design" ? "bg-pax2-lavender text-pax2-blue" : "bg-above-soft text-above")}>{l.kind === "design" ? "Design" : "Learned"}</span>
                  </TableCell>
                  <TableCell className="tabular whitespace-normal text-slate-700">{l.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
