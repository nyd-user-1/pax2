import type { Tier } from "@/lib/lab"

// The three outcomes' colors, shared by the scatter (server and client halves) and the tables.
export const TIER: Record<Tier, { label: string; chip: string; dot: string; tip: string }> = {
  breakout: { label: "Pushed", chip: "bg-above-soft text-above", dot: "#16a34a", tip: "bg-green-600 text-white" },
  baseline: { label: "Baseline", chip: "bg-slate-100 text-slate-500", dot: "#94a3b8", tip: "bg-slate-400 text-white" },
  killed: { label: "Killed", chip: "bg-below-soft text-below", dot: "#dc2626", tip: "bg-pax2-red text-white" },
}
