// Tier metadata and formatting shared by server pages and the client curve.
// Kept free of data imports so the client bundle carries no dataset JSON.

export type Tier = "breakout" | "baseline" | "killed"

export const CURVE_TIER: Record<Tier, { label: string; chip: string; line: string }> = {
  breakout: { label: "> 3x", chip: "bg-above-soft text-above", line: "#16a34a" },
  baseline: { label: "< 3x", chip: "bg-slate-100 text-slate-500", line: "#94a3b8" },
  killed: { label: "< .5x", chip: "bg-below-soft text-below", line: "#dc2626" },
}

export const fmtCompact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
