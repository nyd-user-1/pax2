"use client"

import * as React from "react"

import { RangeBar } from "@/components/bits"
import { COMPONENTS, FORMULA_V1, score, type Reference } from "@/lib/resonance"
import type { MetricKey, Snapshot, Take } from "@/lib/types"

const KNOBS: { key: MetricKey; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "plays3s", label: "3-second plays" },
  { key: "avgWatchSec", label: "Average watch time (s)" },
  { key: "shares", label: "Shares" },
  { key: "spend", label: "Spend ($)" },
]

/** Change one input and watch the score, its components and its range respond. */
export function WhatIf({ options, reference }: { options: { label: string; take: Take; snapshot: Snapshot }[]; reference: Reference }) {
  const [i, setI] = React.useState(0)
  const base = options[i]
  const [mult, setMult] = React.useState<Record<string, number>>({})
  const snap: Snapshot = React.useMemo(() => {
    const m = { ...base.snapshot.metrics }
    for (const k of KNOBS) if (mult[k.key] != null && m[k.key].value != null) m[k.key] = { ...m[k.key], value: m[k.key].value! * mult[k.key] }
    return { ...base.snapshot, id: `${base.snapshot.id}~whatif`, metrics: m }
  }, [base, mult])
  const before = React.useMemo(() => score(base.snapshot, base.take, reference), [base, reference])
  const after = React.useMemo(() => score(snap, base.take, reference), [snap, base, reference])
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-3">
        <select className="rounded-lg border bg-background px-2 py-1.5 text-sm" value={i} onChange={(e) => (setI(Number(e.target.value)), setMult({}))}>
          {options.map((o, j) => (
            <option key={o.label} value={j}>
              {o.label}
            </option>
          ))}
        </select>
        {KNOBS.map((k) => (
          <label key={k.key} className="flex flex-col gap-1 text-xs">
            <span className="flex justify-between text-muted-foreground">
              <span>{k.label}</span>
              <span className="tabular">
                ×{(mult[k.key] ?? 1).toFixed(2)} = {((base.snapshot.metrics[k.key].value ?? 0) * (mult[k.key] ?? 1)).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            </span>
            <input type="range" min={0.1} max={3} step={0.05} value={mult[k.key] ?? 1} onChange={(e) => setMult((m) => ({ ...m, [k.key]: Number(e.target.value) }))} className="accent-[var(--hermes-plum)]" />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Spend moves nothing: it is a delivery condition. Doubling impressions and plays together leaves the rates alone and only narrows the range.</p>
      </div>
      <div className="flex flex-col gap-4">
        {[
          { l: "As recorded", s: before },
          { l: "With your changes", s: after },
        ].map(({ l, s }) => (
          <div key={l} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">{l}</span>
              <span className="tabular font-display text-3xl text-hermes-ink">{s.value?.toFixed(1) ?? "Not scored"}</span>
            </div>
            {s.value != null && <RangeBar value={s.value} low={s.low} high={s.high} />}
            <div className="tabular grid grid-cols-3 gap-2 text-xs">
              {s.components.map((c) => (
                <div key={c.key} className="rounded bg-muted/50 px-2 py-1">
                  {COMPONENTS.find((x) => x.key === c.key)!.name} {c.score?.toFixed(0) ?? "—"}
                </div>
              ))}
            </div>
            {s.status !== "scored" && <p className="text-xs text-muted-foreground">{s.reasons.at(-1)}</p>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Formula {FORMULA_V1.version}, reference {reference.id}.</p>
      </div>
    </div>
  )
}
