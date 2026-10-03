import build from "../../../data/build.json"
import { FreshReview } from "@/components/fresh-review"
import { workspace } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Build" }

type Item = { title: string; detail?: string; owner?: string }
type Build = { updated: string; budget: { cap: number; spent: { item: string; usd: number }[] }; columns: { id: string; title: string; items: Item[] }[]; resources: { name: string; id: string }[] }

const TONE: Record<string, string> = { done: "border-observed/30", running: "border-pax-plum/40", you: "border-amber-300", next: "border-border" }

export default async function BuildPage() {
  const b = build as Build
  const ws = await workspace()
  const spent = b.budget.spent.reduce((t, s) => t + s.usd, 0)
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-pax-ink md:text-5xl">Build</h1>
          <p className="text-sm text-muted-foreground">Updated {b.updated}</p>
        </div>
        <div className="rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground">AWS spend against the ${b.budget.cap} cap (estimated)</p>
          <p className="tabular font-display text-4xl text-pax-ink">${spent.toFixed(2)}</p>
          <div className="mt-2 h-1.5 w-56 rounded-full bg-muted">
            <div className="h-full rounded-full bg-pax-plum" style={{ width: `${Math.min(100, (spent / b.budget.cap) * 100)}%` }} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        {b.columns.map((c) => (
          <div key={c.id} className={cn("flex flex-col gap-2 rounded-2xl border-2 p-4", TONE[c.id])}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium text-pax-ink">{c.title}</h2>
              <span className="tabular text-xs text-muted-foreground">{c.items.length}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {c.items.map((i) => (
                <li key={i.title} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium leading-snug">{i.title}</p>
                  {i.detail && <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl text-pax-ink">Spend</h2>
          <ul className="tabular flex flex-col text-sm">
            {b.budget.spent.map((s) => (
              <li key={s.item} className="flex justify-between border-t py-1.5">
                <span>{s.item}</span>
                <span>${s.usd.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl text-pax-ink">Resources</h2>
          <ul className="flex flex-col text-sm">
            {b.resources.map((r) => (
              <li key={r.name} className="flex justify-between gap-3 border-t py-1.5">
                <span>{r.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border p-4">
        <h2 className="font-medium text-pax-ink">Review workspace</h2>
        <p className="text-sm text-muted-foreground">
          This browser is reading workspace <span className="font-mono">{ws}</span>. A fresh one starts the loop from round 1 without touching any earlier record.
        </p>
        <FreshReview />
      </section>
    </div>
  )
}
