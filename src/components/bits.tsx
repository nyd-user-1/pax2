import { cn } from "@/ui/lib/utils"
import type { Kind, Provenance } from "@/lib/types"

const KIND: Record<Kind, { label: string; cls: string }> = {
  observed: { label: "Observed", cls: "bg-observed/10 text-observed ring-observed/25" },
  interpretation: { label: "Interpretation", cls: "bg-interpretation/10 text-interpretation ring-interpretation/25" },
  hypothesis: { label: "Hypothesis to test", cls: "bg-hypothesis/10 text-hypothesis ring-hypothesis/25" },
}

export function KindChip({ kind }: { kind: Kind }) {
  const k = KIND[kind]
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", k.cls)}>{k.label}</span>
}

const SOURCE: Record<Provenance, string> = {
  platform: "Platform",
  library: "Ad library",
  "stand-in": "Stand-in",
  ai: "AI-assessed",
  coded: "Hand-coded",
  derived: "Measured",
}

export function SourceBadge({ source, className }: { source: Provenance; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
        source === "stand-in" && "bg-hermes-red-soft text-hermes-red-deep",
        source === "ai" && "bg-hypothesis/10 text-hypothesis",
        source === "platform" && "bg-observed/10 text-observed",
        (source === "derived" || source === "coded" || source === "library") && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {SOURCE[source]}
    </span>
  )
}

/** A 0–100 bar with the score's range drawn behind its point. */
export function RangeBar({ value, low, high, className }: { value: number | null; low: number | null; high: number | null; className?: string }) {
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-muted", className)}>
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border" style={{ left: 0 }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/15" />
      {low != null && high != null && <div className="grow absolute inset-y-0 rounded-full bg-hermes-plum/20" style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }} />}
      {value != null && <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-hermes-plum shadow" style={{ left: `${value}%` }} />}
    </div>
  )
}

export function ScoreFigure({ value, low, high, status, size = "lg" }: { value: number | null; low: number | null; high: number | null; status: string; size?: "lg" | "sm" }) {
  if (status === "unscorable" || value == null) return <span className={cn("text-muted-foreground", size === "lg" ? "text-2xl" : "text-sm")}>Not scored</span>
  return (
    <span className="tabular inline-flex items-baseline gap-1.5">
      <span className={cn("font-display text-hermes-ink", size === "lg" ? "text-5xl" : "text-2xl")}>{value.toFixed(0)}</span>
      <span className={cn("text-muted-foreground", size === "lg" ? "text-sm" : "text-xs")}>
        {low!.toFixed(0)}–{high!.toFixed(0)}
      </span>
    </span>
  )
}

export function StandInNote({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-lg border border-hermes-red/20 bg-hermes-red-soft/50 px-3 py-2 text-xs leading-relaxed text-hermes-red-deep", className)}>
      Stand-in records until the partner&apos;s export arrives: the takes are synthetic readings of the library scripts and the paid results are generated in Meta&apos;s export format. Upload the real export on Reviews and every screen recalculates from it.
    </p>
  )
}

export const fmt = (n: number | null | undefined, d = 0) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }))
export const pct = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`)
export const ts = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
