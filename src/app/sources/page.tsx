import sources from "../../../data/sources.json"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Sources" }

type S = { name: string; what: string; use: string; status: "loaded" | "action" | "later"; where?: string; action?: string; link: string; license?: string }

const STATUS: Record<S["status"], { label: string; cls: string }> = {
  loaded: { label: "In PAX", cls: "bg-observed/10 text-observed" },
  action: { label: "Needs a person", cls: "bg-pax-red-soft text-pax-red-deep" },
  later: { label: "Next version", cls: "bg-muted text-muted-foreground" },
}

export default function SourcesPage() {
  const list = sources as S[]
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-pax-ink md:text-5xl">Sources</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Every dataset behind PAX, what it can and cannot say, and where it sits.</p>
      </header>
      <div className="grid gap-3">
        {list.map((s) => (
          <article key={s.name} className="grid gap-2 rounded-3xl border bg-white p-4 md:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <a href={s.link} target="_blank" rel="noreferrer" className="font-medium text-pax-ink hover:underline">
                  {s.name}
                </a>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS[s.status].cls)}>{STATUS[s.status].label}</span>
              </div>
              <p className="text-sm text-foreground/85">{s.what}</p>
              {s.license && <p className="text-xs text-muted-foreground">{s.license}</p>}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p>{s.use}</p>
              {s.action && <p className="text-xs text-pax-red-deep">{s.action}</p>}
              {s.where && <p className="font-mono text-[11px] text-muted-foreground">{s.where}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
