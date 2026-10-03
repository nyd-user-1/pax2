import { pct, StandInNote } from "@/components/bits"
import { LoadButton } from "@/components/load-button"
import { WhatIf } from "@/components/what-if"
import { scriptById, takeLabel } from "@/lib/catalog"
import { COMPONENTS, FORMULA_V1, score, spearman, WEIGHT_PRESETS, type Formula } from "@/lib/resonance"
import { board, workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Method" }

const CHOICES: { what: string; kind: "design" | "data"; detail: string }[] = [
  { what: "Three components: Stop, Hold, Act", kind: "design", detail: "Attention earned at the open, attention kept given the length, and something done with it. Each is a rate a partner can check against Ads Manager." },
  { what: "Weights 25 / 40 / 35", kind: "design", detail: "Hold carries most because it is the hardest to buy; Act next because it is the closest platform signal to intent. Tested below against three alternatives." },
  { what: "Evidence weight k (2,000 / 300 / 800)", kind: "design", detail: "How many impressions, viewers or plays the reference average is worth. A take with far more evidence than k is scored on its own rate; one with less leans toward the average." },
  { what: "Minimum 1,000 impressions; limited below 15,000", kind: "design", detail: "Below the minimum a take is not scored; between the two it is scored and flagged." },
  { what: "Reference averages and spreads", kind: "data", detail: "Learned from the first round of results, then frozen as ref-1. Later rounds are scored against it." },
  { what: "The range around each score", kind: "data", detail: "From the counts themselves: 400 draws of each rate consistent with what was recorded." },
]

export default async function MethodPage() {
  const ws = await workspace()
  const { ref, takes } = await board(ws)
  const scored = takes.filter((t) => t.latest && t.latest.score.value != null)
  const variants: { id: string; label: string; f: Formula }[] = [
    ...WEIGHT_PRESETS.map((p) => ({ id: p.id, label: p.label, f: { ...FORMULA_V1, weights: p.weights } })),
    { id: "k-half", label: "Evidence weight × 0.5", f: { ...FORMULA_V1, priorStrength: { stop: 1000, hold: 150, act: 400 } } },
    { id: "k-double", label: "Evidence weight × 2", f: { ...FORMULA_V1, priorStrength: { stop: 4000, hold: 600, act: 1600 } } },
  ]
  const grid = ref
    ? scored.map((t) => ({
        t,
        spend: t.latest!.snapshot.metrics.spend.value ?? 0,
        plays: t.latest!.snapshot.metrics.plays3s.value ?? 0,
        values: variants.map((v) => score(t.latest!.snapshot, t.take, ref, v.f, 200).value ?? 0),
      }))
    : []
  const base = grid.map((g) => g.values[0])
  const rank = (xs: number[]) => {
    const order = [...xs].map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0])
    const r = Array(xs.length).fill(0)
    order.forEach(([, i], k) => (r[i] = k + 1))
    return r
  }
  const baseRank = rank(base)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Resonance 1</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-foreground/85">
          How well a paid video earned and kept the attention of the people it was shown to, and how often they did something with it, compared with a frozen reference set. 50 is the reference average. Higher means more of each, per person reached, not more people reached.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">It is an experimental method. A score built from observed delivery is not a forecast for an unpublished video, a measure of belief change, or proof of what caused the result. Persuasion needs a controlled test; the Reference model page shows what those tests have found.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {COMPONENTS.map((c) => (
          <div key={c.key} className="surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xl text-slate-900">{c.name}</span>
              <span className="text-xs text-muted-foreground">{(FORMULA_V1.weights[c.key] * 100).toFixed(0)}%</span>
            </div>
            <p className="mt-1 text-sm">{c.question}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {c.num} ÷ {c.den}
            </p>
            {ref && <p className="mt-1 text-xs text-muted-foreground">Reference average {pct(ref.pooled[c.key], 2)}</p>}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">Chosen, or learned</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {CHOICES.map((c) => (
            <div key={c.what} className="flex gap-3 surface p-3">
              <span className={cn("h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", c.kind === "design" ? "bg-pax-lavender text-pax-plum" : "bg-observed/10 text-observed")}>{c.kind === "design" ? "Design choice" : "From the data"}</span>
              <div>
                <p className="text-sm font-medium text-pax-ink">{c.what}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <ol className="mt-2 flex max-w-3xl list-decimal flex-col gap-1 pl-5 text-sm text-foreground/85">
          <li>Each component starts as a rate from platform counts.</li>
          <li>The rate is weighted by its evidence: (count + k × reference average) ÷ (total + k).</li>
          <li>It is placed on the reference scale: how many reference spreads above or below the reference average, on the log-odds scale.</li>
          <li>That distance becomes 0–100 as the share of a normal curve below it, so 50 is average and 84 is one spread above.</li>
          <li>Resonance is the weighted sum. A missing component&apos;s weight is shared among the others and the take is flagged.</li>
        </ol>
      </section>

      {!ref ? (
        <section className="rounded-2xl border bg-pax-mist p-6">
          <p className="mb-3 text-sm text-muted-foreground">The sensitivity checks and the what-if need results.</p>
          <LoadButton dataset="round-1" label="Load round 1 results" />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-slate-900">Change an input</h2>
            <WhatIf options={scored.map((t) => ({ label: `${scriptById(t.take.scriptId)!.title.slice(0, 40)} — ${takeLabel(t.take)}`, take: t.take, snapshot: t.latest!.snapshot }))} reference={ref} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-slate-900">Do reasonable changes to the assumptions change the assessment?</h2>
            <div className="overflow-x-auto">
              <table className="tabular w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="[&_th]:pb-2 [&_th]:pr-3 [&_th]:font-normal">
                    <th>Take</th>
                    {variants.map((v) => (
                      <th key={v.id}>{v.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-t [&_td]:py-1.5 [&_td]:pr-3">
                  {grid.map((g, gi) => (
                    <tr key={g.t.take.id}>
                      <td className="max-w-64 truncate">
                        {g.t.take.scriptId} · {takeLabel(g.t.take)}
                      </td>
                      {g.values.map((v, i) => {
                        const r = rank(grid.map((x) => x.values[i]))[gi]
                        return (
                          <td key={i} className={cn(i > 0 && Math.abs(r - baseRank[gi]) >= 3 && "text-pax-plum")}>
                            {v.toFixed(0)} <span className="text-[10px] text-muted-foreground">#{r}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="text-xs text-muted-foreground">
                    <td>Rank agreement with Resonance 1</td>
                    {variants.map((v, i) => (
                      <td key={v.id}>{i === 0 ? "—" : spearman(base, grid.map((g) => g.values[i]))?.toFixed(2)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="max-w-3xl text-xs text-muted-foreground">Rank agreement is 1 when every alternative orders the takes the same way. Ranks that move three or more places are marked.</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-slate-900">What it adds beyond one number</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Resonance vs. spend" value={spearman(base, grid.map((g) => g.spend))} note="Near zero: budget does not buy a score." />
              <Stat label="3-second plays vs. spend" value={spearman(grid.map((g) => g.plays), grid.map((g) => g.spend))} note="A raw count mostly measures budget." />
              <Stat label="Resonance vs. 3-second plays" value={spearman(base, grid.map((g) => g.plays))} note="Ranking by views alone tells a different story." />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-slate-900">Reference scale ref-1</h2>
            <p className="text-sm text-muted-foreground">
              Built {new Date(ref.createdAt).toLocaleString()} from {ref.n} flights in {ref.dataset}. Frozen: later rounds are scored against these numbers, and a revised formula would be published as Resonance 2 beside this one, never in its place.
            </p>
            <div className="tabular grid gap-2 text-xs sm:grid-cols-3">
              {COMPONENTS.map((c) => (
                <div key={c.key} className="rounded-lg bg-muted/50 px-3 py-2">
                  <b className="text-pax-ink">{c.name}</b> · pooled {pct(ref.pooled[c.key], 2)} · centre {ref.mean[c.key].toFixed(2)} · spread {ref.sd[c.key].toFixed(2)}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <StandInNote />
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular font-display text-4xl text-pax-ink">{value == null ? "—" : value.toFixed(2)}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
